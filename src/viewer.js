// Visor 3D: escena, carga del modelo, capas (despiece), selección, controles animados y cámara.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import gsap from 'gsap';
import { CONFIG } from './config.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const v3 = (a) => new THREE.Vector3(...a);
const SVGNS = 'http://www.w3.org/2000/svg';
const LABEL = 28;   // diámetro de la etiqueta en px
const GAP = 6;      // separación mínima entre etiquetas
// Convierte un vector del mundo al espacio local del padre (solo rotación/escala)
const toParent = (obj) => new THREE.Matrix3().setFromMatrix4(obj.parent.matrixWorld.clone().invert());

export class Viewer {
  constructor(el, parts, controlNames = []) {
    this.el = el;
    this.parts = parts;
    this.controlNames = controlNames;
    this.t = 0;
    this.sel = new Set();
    this.hovered = null;
    this.isolated = false;
    this.entries = new Map();   // piezas
    this.ctrls = new Map();     // controles (botones, palancas, tapas…)
    this.meshOwner = new Map(); // malla → pieza
    this.meshCtrl = new Map();  // malla → control
    this.groups = new Map();    // número → etiqueta compartida
    this.pulse = null;
    this.listeners = {};
    this.dirty = true;

    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.domElement.setAttribute('aria-hidden', 'true');
    el.appendChild(r.domElement);

    // Capa de etiquetas: círculos numerados con línea guía hacia su pieza.
    // Se acomodan para que nunca se monten entre sí ni tapen los controles del visor.
    this.labelLayer = document.createElement('div');
    this.labelLayer.className = 'labels-layer';
    this.leaders = document.createElementNS(SVGNS, 'svg');
    this.leaders.setAttribute('class', 'leaders');
    this.leaders.setAttribute('aria-hidden', 'true');
    this.labelLayer.appendChild(this.leaders);
    el.appendChild(this.labelLayer);
    this.labelsOn = true;

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(-3, 5, 4);
    this.scene.add(key);

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.05, 100);
    this.camera.position.copy(v3(CONFIG.defaultView.pos));

    this.orbit = new OrbitControls(this.camera, r.domElement);
    this.orbit.target.copy(v3(CONFIG.defaultView.target));
    this.orbit.enableDamping = true;
    this.orbit.minDistance = 1.5;
    this.orbit.maxDistance = 14;
    this.orbit.addEventListener('change', () => (this.dirty = true));

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    new ResizeObserver(() => this.resize()).observe(el);
    this.resize();
    this.bindPointer();
    this.loop();
  }

  on(ev, cb) { (this.listeners[ev] ??= []).push(cb); }
  emit(ev, ...a) { (this.listeners[ev] || []).forEach((f) => f(...a)); }

  // Corre el centro del encuadre (fracción del ancho/alto) para dejar libre una zona del visor
  setFocusShift(fx = 0, fy = 0) { this.shift = { fx, fy }; this.resize(); }

  resize() {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    let s = this.shift || { fx: 0, fy: 0 };
    // en pantallas verticales la zona libre queda arriba: se corre solo en vertical
    if ((s.fx || s.fy) && w / h < 1) s = { fx: 0, fy: 0.16 };
    if (s.fx || s.fy) this.camera.setViewOffset(w, h, -s.fx * w, s.fy * h, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  // Render bajo demanda: solo dibuja cuando algo cambió (ahorra batería)
  loop() {
    requestAnimationFrame(() => this.loop());
    const moved = this.orbit.update();
    if (this.pulse) this.updatePulse();
    if (moved || this.dirty) {
      this.renderer.render(this.scene, this.camera);
      this.layoutLabels();
      this.dirty = false;
    }
  }

  // ---------- Carga del modelo ----------
  async load(source, name = 'modelo') {
    const url = source instanceof File ? URL.createObjectURL(source) : source;
    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath(CONFIG.dracoPath);
    loader.setDRACOLoader(draco);
    try {
      const gltf = await loader.loadAsync(url, (e) => this.emit('progress', e.total ? e.loaded / e.total : null));
      this.setModel(gltf.scene, { provisional: false, name });
      this.modeloFinal = !(source instanceof File);
    } finally {
      if (source instanceof File) URL.revokeObjectURL(url);
    }
  }

  usePlaceholder(build) {
    this.modeloFinal = false;
    this.setModel(build(), { provisional: true, name: 'provisional' });
  }

  // Vuelve a leer los títulos de las piezas (al cambiar de idioma)
  refreshTitles() {
    for (const g of this.groups.values()) {
      const p = g.members[0].part;
      g.btn.title = p.titulo;
      g.btn.setAttribute('aria-label', p.titulo);
    }
  }

  // Exporta el modelo armado como GLB, escalado a su tamaño real en metros (para realidad aumentada)
  async exportarGLB(largo = 0.36) {
    if (!this.root) throw new Error('sin modelo');
    const prev = { t: this.t, sel: [...this.sel], iso: this.isolated, pulse: this.pulse };
    this.pulse = null;
    this.sel = new Set(); this.isolated = false;
    this.setExplode(0);
    this.applyStyles();
    this.root.updateMatrixWorld(true);
    const clon = this.root.clone(true);
    clon.position.set(0, 0, 0);
    clon.scale.set(1, 1, 1);
    clon.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(clon);
    const size = box.getSize(new THREE.Vector3());
    const k = largo / Math.max(size.x, size.y, size.z);
    clon.scale.setScalar(k);
    clon.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(clon);
    const c = b2.getCenter(new THREE.Vector3());
    clon.position.set(-c.x, -b2.min.y, -c.z);   // apoyada sobre el piso, centrada
    const escena = new THREE.Scene();
    escena.add(clon);
    const glb = await new GLTFExporter().parseAsync(escena, { binary: true });
    this.sel = new Set(prev.sel); this.isolated = prev.iso; this.pulse = prev.pulse;
    this.setExplode(prev.t);
    this.applyStyles();
    this.dirty = true;
    return new Blob([glb], { type: 'model/gltf-binary' });
  }

  setModel(obj, { provisional, name }) {
    this.clearModel();

    // Normaliza: lado mayor = CONFIG.modelSize, centrado en el origen
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    obj.scale.multiplyScalar(CONFIG.modelSize / Math.max(size.x, size.y, size.z));
    obj.updateMatrixWorld(true);
    box.setFromObject(obj);
    obj.position.sub(box.getCenter(new THREE.Vector3()));
    obj.updateMatrixWorld(true);
    this.root = obj;
    this.scene.add(obj);

    const missingParts = [];
    this.groups = new Map();
    for (const p of this.parts) {
      const o = obj.getObjectByName(p.mesh);
      if (!o) { missingParts.push(p); continue; }
      const bbox = new THREE.Box3().setFromObject(o);
      const dirWorld = v3(p.explode);
      const entry = {
        part: p, obj: o, base: o.position.clone(), bbox, center: bbox.getCenter(new THREE.Vector3()),
        dirWorld, localDir: dirWorld.clone().applyMatrix3(toParent(o)), mats: [], ctrl: null,
      };
      o.traverse((m) => {
        if (!m.isMesh) return;
        m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone();
        [].concat(m.material).forEach((mt) => entry.mats.push({
          mt, emissive: mt.emissive?.clone(), ei: mt.emissiveIntensity,
          opacity: mt.opacity, transparent: mt.transparent, depthWrite: mt.depthWrite,
        }));
        this.meshOwner.set(m, p.id);
      });

      const line = document.createElementNS(SVGNS, 'line');
      const dot = document.createElementNS(SVGNS, 'circle');
      dot.setAttribute('r', '4');
      this.leaders.append(line, dot);
      Object.assign(entry, { line, dot, showLabel: false });
      this.entries.set(p.id, entry);

      // Una sola etiqueta numerada por grupo (las piezas del mismo paso comparten número)
      let g = this.groups.get(p.n);
      if (!g) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'lbl';
        btn.textContent = p.n;
        btn.title = p.titulo;
        btn.setAttribute('aria-label', p.titulo);
        btn.addEventListener('click', () => this.emit('pick', { part: p.id, control: null }));
        btn.addEventListener('pointerenter', () => { this.hovered = p.id; this.applyStyles(); this.emit('hover', p.id); });
        btn.addEventListener('pointerleave', () => { this.hovered = null; this.applyStyles(); this.emit('hover', null); });
        this.labelLayer.appendChild(btn);
        g = { btn, members: [] };
        this.groups.set(p.n, g);
      }
      g.members.push(entry);
    }

    const missingCtrls = [];
    for (const name of this.controlNames) {
      const o = obj.getObjectByName(name);
      if (!o) { missingCtrls.push(name); continue; }
      const c = {
        name, obj: o, basePos: o.position.clone(), baseQuat: o.quaternion.clone(), baseScale: o.scale.clone(),
        lin: toParent(o), axis: new THREE.Vector3(1, 0, 0), st: { x: 0, y: 0, z: 0, ang: 0, vis: 1 }, part: null,
      };
      const owner = [...this.entries.values()].find((e) => e.obj === o);
      if (owner) { c.part = owner; owner.ctrl = c; }
      o.traverse((m) => { if (m.isMesh) this.meshCtrl.set(m, name); });
      this.ctrls.set(name, c);
    }

    this.setExplode(this.t);
    this.applyStyles();
    this.emit('loaded', { provisional, name, missingParts, missingCtrls });
  }

  clearModel() {
    if (!this.root) return;
    this.setPulse(null);
    for (const c of this.ctrls.values()) gsap.killTweensOf(c.st);
    for (const e of this.entries.values()) { e.line.remove(); e.dot.remove(); }
    for (const g of this.groups?.values() || []) g.btn.remove();
    this.root.traverse((m) => {
      if (!m.isMesh) return;
      m.geometry?.dispose();
      [].concat(m.material).forEach((mt) => mt?.dispose());
    });
    this.scene.remove(this.root);
    this.entries.clear(); this.ctrls.clear(); this.meshOwner.clear(); this.meshCtrl.clear();
    this.root = null;
  }

  hasControl(name) { return this.ctrls.has(name); }

  // ---------- Capas (despiece) ----------
  setExplode(t) {
    this.t = t;
    for (const e of this.entries.values()) {
      if (e.ctrl) this.applyCtrl(e.ctrl);
      else e.obj.position.copy(e.base).addScaledVector(e.localDir, t);
    }
    if (this.root) { this.root.updateMatrixWorld(true); this.modelBox = new THREE.Box3().setFromObject(this.root); }
    this.refreshLabels();
    this.dirty = true;
  }

  stopExplode() { if (this._ex) this._ex.kill(); }

  animateExplode(to, dur = CONFIG.tweenDuration) {
    if (this._ex) this._ex.kill();
    const s = { t: this.t };
    this._ex = gsap.to(s, {
      t: to, duration: reduceMotion() ? 0 : dur, ease: 'power2.inOut',
      onUpdate: () => { this.setExplode(s.t); this.emit('explode', s.t); },
    });
  }

  // ---------- Selección ----------
  select(ids) { this.sel = new Set(ids || []); this.applyStyles(); }
  setIsolate(on) { this.isolated = on; this.applyStyles(); }

  applyStyles() {
    const accent = new THREE.Color(CONFIG.highlight);
    const any = this.sel.size > 0;
    for (const [id, e] of this.entries) {
      const sel = this.sel.has(id);
      const hov = id === this.hovered && !sel;
      const dim = this.isolated && any && !sel;
      for (const o of e.mats) {
        const m = o.mt;
        if (m.emissive) {
          if (sel || hov) { m.emissive.copy(accent); m.emissiveIntensity = sel ? 0.4 : 0.18; }
          else { m.emissive.copy(o.emissive); m.emissiveIntensity = o.ei; }
        }
        m.transparent = dim || o.transparent;
        m.opacity = dim ? 0.12 : o.opacity;
        m.depthWrite = dim ? false : o.depthWrite;
        m.needsUpdate = true;
      }
    }
    this.refreshLabels();
    this.dirty = true;
  }

  refreshLabels() {
    const any = this.sel.size > 0;
    for (const [id, e] of this.entries) {
      const dim = this.isolated && any && !this.sel.has(id);
      e.showLabel = this.labelsOn && (this.t > 0.12 || this.sel.has(id)) && !dim;
      e.line.classList.toggle('on', this.sel.has(id));
      e.dot.classList.toggle('on', this.sel.has(id));
    }
    for (const g of this.groups?.values() || []) g.btn.classList.toggle('on', g.members.some((e) => this.sel.has(e.part.id)));
    this.dirty = true;
  }

  setLabelsEnabled(on) { this.labelsOn = on; this.refreshLabels(); }

  // Coloca las etiquetas hacia afuera de cada pieza y resuelve choques:
  // ninguna etiqueta se monta sobre otra, sobre el punto de otra pieza ni sobre los controles.
  layoutLabels() {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    const base = this.el.getBoundingClientRect();
    const obstacles = [...this.el.parentElement.querySelectorAll('[data-obstacle]')]
      .filter((o) => o.offsetParent !== null)
      .map((o) => { const r = o.getBoundingClientRect(); return { l: r.left - base.left - 6, t: r.top - base.top - 6, r: r.right - base.left + 6, b: r.bottom - base.top + 6 }; });
    const v = new THREE.Vector3();
    const inView = (x, y) => x >= 4 && x <= w - 4 && y >= 4 && y <= h - 4;
    // 1. Puntos de cada pieza visible
    const anchors = [];
    for (const e of this.entries.values()) {
      e.anchor = null;
      if (e.showLabel) {
        v.copy(e.center).addScaledVector(e.dirWorld, this.t).project(this.camera);
        const ax = ((v.x + 1) / 2) * w, ay = ((1 - v.y) / 2) * h;
        if (v.z < 1 && inView(ax, ay)) { e.anchor = { x: ax, y: ay }; anchors.push(e.anchor); }
      }
      e.line.style.display = e.dot.style.display = e.anchor ? '' : 'none';
    }
    // 2. Una etiqueta por grupo, ubicada a partir del promedio de sus puntos
    const items = [];
    for (const g of this.groups.values()) {
      const pts = g.members.filter((e) => e.anchor);
      g.btn.hidden = !pts.length;
      if (!pts.length) continue;
      const ax = pts.reduce((a, e) => a + e.anchor.x, 0) / pts.length;
      const ay = pts.reduce((a, e) => a + e.anchor.y, 0) / pts.length;
      items.push({ g, pts, ax, ay });
    }
    if (!items.length) return;

    // Contorno del modelo en pantalla: las etiquetas se ubican por fuera, así no tapan las piezas
    const R = 46, S = LABEL + GAP, half = LABEL / 2 + 4, M = 34;
    let rect = null;
    if (this.modelBox && !this.modelBox.isEmpty()) {
      const b = this.modelBox;
      let l = Infinity, t = Infinity, r = -Infinity, bt = -Infinity;
      for (let i = 0; i < 8; i++) {
        v.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(this.camera);
        const x = ((v.x + 1) / 2) * w, y = ((1 - v.y) / 2) * h;
        l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); bt = Math.max(bt, y);
      }
      // si el modelo no cabe (acercamiento), se usa el borde del visor
      rect = { l: Math.max(half, l - M), t: Math.max(half, t - M), r: Math.min(w - half, r + M), b: Math.min(h - half, bt + M) };
    }
    const fits = rect && rect.r - rect.l > 4 * LABEL && rect.b - rect.t > 4 * LABEL;
    const cx = rect ? (rect.l + rect.r) / 2 : w / 2, cy = rect ? (rect.t + rect.b) / 2 : h / 2;
    for (const it of items) {
      let dx = it.ax - cx, dy = it.ay - cy, d = Math.hypot(dx, dy);
      if (d < 1) { dx = 0.7; dy = -0.7; d = 1; }
      const ux = dx / d, uy = dy / d;
      if (fits) {
        // punto donde el rayo desde el centro cruza el contorno ampliado
        const kx = ux > 0 ? (rect.r - cx) / ux : ux < 0 ? (rect.l - cx) / ux : Infinity;
        const ky = uy > 0 ? (rect.b - cy) / uy : uy < 0 ? (rect.t - cy) / uy : Infinity;
        const k = Math.min(kx, ky);
        it.tx = cx + ux * k; it.ty = cy + uy * k;
      } else {
        it.tx = it.ax + ux * R; it.ty = it.ay + uy * R;
      }
      it.x = it.tx; it.y = it.ty;
    }
    for (let k = 0; k < 60; k++) {
      for (let i = 0; i < items.length; i++) {
        const a = items[i];
        for (let j = i + 1; j < items.length; j++) {
          const b = items[j];
          let dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
          if (d < S) {
            if (d < 0.01) { dx = Math.cos(i + j); dy = Math.sin(i + j); d = 1; }
            const push = (S - d) / 2;
            a.x += (dx / d) * push; a.y += (dy / d) * push;
            b.x -= (dx / d) * push; b.y -= (dy / d) * push;
          }
        }
        // no tapar el punto de ninguna pieza
        for (const o of anchors) {
          let dx = a.x - o.x, dy = a.y - o.y, d = Math.hypot(dx, dy);
          const min = half + 4;
          if (d < min) { if (d < 0.01) { dx = 1; dy = 0; d = 1; } a.x += (dx / d) * (min - d); a.y += (dy / d) * (min - d); }
        }
        a.x += (a.tx - a.x) * 0.05; a.y += (a.ty - a.y) * 0.05;
        a.x = Math.min(w - half, Math.max(half, a.x));
        a.y = Math.min(h - half, Math.max(half, a.y));
        // fuera de los controles del visor
        for (const r of obstacles) {
          if (a.x > r.l - half && a.x < r.r + half && a.y > r.t - half && a.y < r.b + half) {
            const opts = [[r.l - half, a.y], [r.r + half, a.y], [a.x, r.t - half], [a.x, r.b + half]]
              .filter(([x, y]) => x >= half && x <= w - half && y >= half && y <= h - half);
            if (!opts.length) continue;
            opts.sort((p, q) => Math.hypot(p[0] - a.x, p[1] - a.y) - Math.hypot(q[0] - a.x, q[1] - a.y));
            [a.x, a.y] = opts[0];
          }
        }
      }
    }
    // 3. Dibuja etiquetas, líneas guía (una por pieza del grupo) y puntos
    for (const it of items) {
      const { g, pts, x, y } = it;
      g.btn.style.transform = `translate(${(x - LABEL / 2).toFixed(1)}px, ${(y - LABEL / 2).toFixed(1)}px)`;
      for (const e of pts) {
        const { x: ax, y: ay } = e.anchor;
        const d = Math.hypot(x - ax, y - ay) || 1;
        const ex = x - ((x - ax) / d) * (LABEL / 2), ey = y - ((y - ay) / d) * (LABEL / 2);
        e.line.setAttribute('x1', ax.toFixed(1)); e.line.setAttribute('y1', ay.toFixed(1));
        e.line.setAttribute('x2', ex.toFixed(1)); e.line.setAttribute('y2', ey.toFixed(1));
        e.dot.setAttribute('cx', ax.toFixed(1)); e.dot.setAttribute('cy', ay.toFixed(1));
      }
    }
  }

  // ---------- Controles animados (modo Uso de la cámara) ----------
  applyCtrl(c) {
    const off = new THREE.Vector3(c.st.x, c.st.y, c.st.z).applyMatrix3(c.lin);
    c.obj.position.copy(c.basePos).add(off);
    if (c.part) c.obj.position.addScaledVector(c.part.localDir, this.t);
    const axis = c.axis.clone().applyMatrix3(c.lin).normalize();
    c.obj.quaternion.setFromAxisAngle(axis, THREE.MathUtils.degToRad(c.st.ang)).multiply(c.baseQuat);
    c.obj.scale.copy(c.baseScale).multiplyScalar(Math.max(c.st.vis, 0.0001));
    c.obj.visible = c.st.vis > 0.01;
    this.dirty = true;
  }

  // Devuelve todos los controles a como vienen en el modelo
  resetControls() {
    for (const c of this.ctrls.values()) {
      gsap.killTweensOf(c.st);
      Object.assign(c.st, { x: 0, y: 0, z: 0, ang: 0, vis: 1 });
      this.applyCtrl(c);
    }
  }

  // Estado inicial de la práctica (campo "de" de cada acción)
  setInitial(actions) {
    for (const a of actions) {
      const c = this.ctrls.get(a.objeto);
      if (!c) continue;
      if (a.eje) c.axis.set(...a.eje);
      if (a.tipo === 'mover' && a.de) Object.assign(c.st, { x: a.de[0], y: a.de[1], z: a.de[2] });
      if (a.tipo === 'girar' && a.de != null) c.st.ang = a.de;
      if (a.tipo === 'mostrar') c.st.vis = 0;
      this.applyCtrl(c);
    }
  }

  // Ejecuta las animaciones de un paso. instant = aplicar el resultado sin animar.
  runActions(actions, instant = false) {
    const tl = gsap.timeline({ paused: true });
    const used = [];
    for (const a of actions) {
      const c = this.ctrls.get(a.objeto);
      if (!c) continue;
      used.push(c);
      const at = a.retraso || 0;
      const upd = () => this.applyCtrl(c);
      if (a.tipo === 'mover') {
        tl.to(c.st, { x: a.a[0], y: a.a[1], z: a.a[2], duration: 0.7, ease: 'power2.inOut', onUpdate: upd }, at);
      } else if (a.tipo === 'girar') {
        c.axis.set(...a.eje);
        tl.to(c.st, { ang: a.a, duration: 0.9, ease: 'power2.inOut', onUpdate: upd }, at);
      } else if (a.tipo === 'pulsar') {
        const d = a.dist ?? 0.035;
        tl.to(c.st, { x: a.eje[0] * d, y: a.eje[1] * d, z: a.eje[2] * d, duration: 0.15, ease: 'power1.in', onUpdate: upd }, at);
        tl.to(c.st, { x: 0, y: 0, z: 0, duration: 0.25, ease: 'power1.out', onUpdate: upd }, at + 0.3);
      } else if (a.tipo === 'ocultar') {
        tl.to(c.st, { vis: 0, duration: 0.45, ease: 'power2.in', onUpdate: upd }, at);
      } else if (a.tipo === 'mostrar') {
        tl.to(c.st, { vis: 1, duration: 0.45, ease: 'power2.out', onUpdate: upd }, at);
      }
    }
    if (instant || reduceMotion()) {
      tl.progress(1);
      used.forEach((c) => this.applyCtrl(c));
      return Promise.resolve();
    }
    return new Promise((res) => { tl.eventCallback('onComplete', res); tl.play(); });
  }

  // Parpadeo para señalar qué hay que tocar
  setPulse(name, fallbackPart = null) {
    const prev = this.pulse;
    this.pulse = null;
    if (prev) this.applyStyles();
    const obj = this.ctrls.get(name)?.obj || this.entries.get(fallbackPart)?.obj;
    if (!obj) return;
    const mats = [];
    obj.traverse((m) => { if (m.isMesh) [].concat(m.material).forEach((mt) => mt.emissive && mats.push(mt)); });
    this.pulse = { mats, color: new THREE.Color(CONFIG.highlight) };
  }

  updatePulse() {
    const k = 0.15 + 0.55 * (0.5 + 0.5 * Math.sin(performance.now() / 230));
    for (const m of this.pulse.mats) { m.emissive.copy(this.pulse.color); m.emissiveIntensity = k; }
    this.dirty = true;
  }

  // ---------- Puntero ----------
  bindPointer() {
    const c = this.renderer.domElement;
    let down = null;
    c.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
    c.addEventListener('pointerup', (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved < 6) this.emit('pick', this.pick(e));
    });
    c.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || e.buttons) return;
      const id = this.pick(e).part;
      if (id !== this.hovered) {
        this.hovered = id;
        c.style.cursor = id ? 'pointer' : '';
        this.applyStyles();
        this.emit('hover', id);
      }
    });
    c.addEventListener('pointerleave', () => {
      if (!this.hovered) return;
      this.hovered = null;
      this.applyStyles();
      this.emit('hover', null);
    });
  }

  pick(e) {
    const none = { part: null, control: null };
    if (!this.root) return none;
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    for (const h of this.raycaster.intersectObject(this.root, true)) {
      if (!h.object.visible) continue;
      const part = this.meshOwner.get(h.object);
      if (!part) continue;
      if (this.isolated && this.sel.size && !this.sel.has(part)) continue;
      return { part, control: this.meshCtrl.get(h.object) || null };
    }
    return none;
  }

  // ---------- Cámara ----------
  flyTo(pos, target, dur = CONFIG.tweenDuration) {
    const d = reduceMotion() ? 0 : dur;
    gsap.killTweensOf(this.camera.position);
    gsap.killTweensOf(this.orbit.target);
    this.orbit.enabled = false;
    gsap.to(this.camera.position, { x: pos.x, y: pos.y, z: pos.z, duration: d, ease: 'power2.inOut', onUpdate: () => (this.dirty = true) });
    gsap.to(this.orbit.target, {
      x: target.x, y: target.y, z: target.z, duration: d, ease: 'power2.inOut',
      onUpdate: () => (this.dirty = true),
      onComplete: () => (this.orbit.enabled = true),
    });
  }

  narrow() { return this.camera.aspect < 1 ? 1.45 : 1; }

  // Enfoca un grupo de piezas con el despiece t
  focusParts(ids, t = this.t, vista = [2, 1.5, 3]) {
    const box = new THREE.Box3();
    for (const id of ids) {
      const e = this.entries.get(id);
      if (e) box.union(e.bbox.clone().translate(e.dirWorld.clone().multiplyScalar(t)));
    }
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3());
    this.flyTo(c.clone().add(v3(vista).multiplyScalar(CONFIG.vistaEscala * this.narrow())), c);
  }

  // Enfoca un control (o la pieza de respaldo si el control no existe)
  focusControl(name, vista = [2, 1, 2.5], fallbackPart = null) {
    const obj = this.ctrls.get(name)?.obj || this.entries.get(fallbackPart)?.obj;
    if (!obj) return;
    const c = new THREE.Box3().setFromObject(obj).getCenter(new THREE.Vector3());
    this.flyTo(c.clone().add(v3(vista).multiplyScalar(CONFIG.vistaControles * this.narrow())), c);
  }

  // t: despiece para el que se encuadra (por capas el modelo ocupa más, así que la cámara se aleja)
  reset(t = this.t) {
    const target = v3(CONFIG.defaultView.target);
    const k = this.narrow() * (1 + 0.55 * t);
    this.flyTo(v3(CONFIG.defaultView.pos).sub(target).multiplyScalar(k).add(target), target);
  }
}
