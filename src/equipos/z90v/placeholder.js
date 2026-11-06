// MODELO PROVISIONAL (bloques) de la Sony PXW-Z90V
// Ocupa el lugar del modelo final mientras se termina en Blender.
// Cada pieza y cada control llevan el MISMO nombre que deberán tener en z90.glb.
//
// Distribución tomada del tutorial del CPMA (Universidad Autónoma de Occidente):
//  - Lado izquierdo: pantalla LCD (bisagra adelante). Detrás de ella, el panel con
//    encendido, WHITE BALANCE, MENU y la tapa de las tarjetas SD.
//  - Abajo a la izquierda: botones IRIS, ISO y SHUTTER.
//  - Junto al lente (izquierda): botón AF/MF e interruptor FOCUS/ZOOM.
//  - Atrás: batería, visor, selector ND e interruptor AUTO/MANUAL (lado izquierdo),
//    botón REC y palanca de mando (lado derecho).
//  - Asa: dos entradas XLR, interruptores INPUT, palanca de zoom y otro botón REC.
//
// Ejes: el lente apunta hacia -X, arriba es +Y, el lado IZQUIERDO del operador mira hacia +Z.
// Los controles que giran o se mueven tienen su origen (pivote) en su eje o bisagra.

import * as THREE from 'three';

export function buildPlaceholder() {
  const root = new THREE.Group();
  root.name = 'Z90V_Provisional';

  const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.15, ...o });
  const body = mat(0x30353c);
  const dark = mat(0x1c1f24);
  const rubber = mat(0x121316, { roughness: 0.9, metalness: 0 });
  const ridge = mat(0x34373c, { roughness: 0.8 });
  const metal = mat(0x8a9099, { metalness: 0.7, roughness: 0.35 });
  const light = mat(0xd9d2c3, { roughness: 0.5 });
  const red = mat(0xc0162f, { roughness: 0.4 });
  const glass = mat(0x2e3338, { roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.85 });
  const chip = mat(0x5a2a30, { metalness: 0.6, roughness: 0.3 });
  const door = mat(0x3c424a);
  const card = mat(0xf2efed, { roughness: 0.4 });
  const hoodMat = mat(0x1c1f24, { side: THREE.DoubleSide });

  const box = (w, h, d, m, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    return mesh;
  };
  const cylX = (r1, r2, len, m, x = 0, y = 0, z = 0, open = false) => {
    const g = new THREE.CylinderGeometry(r1, r2, len, 48, 1, open);
    g.rotateZ(Math.PI / 2);
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    return mesh;
  };
  const cylY = (r, len, m, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 24), m);
    mesh.position.set(x, y, z);
    return mesh;
  };
  const cylZ = (r, len, m, x = 0, y = 0, z = 0) => {
    const g = new THREE.CylinderGeometry(r, r, len, 24);
    g.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    return mesh;
  };
  const group = (name, [x, y, z], ...children) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    children.forEach((c) => g.add(c));
    return g;
  };
  const part = (name, ...children) => {
    const g = group(name, [0, 0, 0], ...children);
    root.add(g);
    return g;
  };
  const btn = (name, x, y, z, m = metal) => group(name, [x, y, z], cylZ(0.045, 0.04, m));

  // ---- Cuerpo ----
  part('Cuerpo',
    box(2.0, 1.15, 1.0, body, 0.35, 0, 0),
    cylX(0.47, 0.47, 0.06, metal, -0.66, 0, 0),
    // panel lateral izquierdo (queda tapado por la pantalla cerrada)
    box(1.15, 0.62, 0.02, dark, 0.38, 0.12, 0.51),
    btn('Btn_Encendido', 0.0, 0.32, 0.53, light),
    btn('Btn_WB', 0.0, 0.14, 0.53),
    btn('Btn_Menu', 0.16, 0.14, 0.53),
    cylZ(0.04, 0.04, metal, 0.0, -0.03, 0.53),
    cylZ(0.04, 0.04, metal, 0.16, -0.03, 0.53),
    // fila de exposición abajo a la izquierda
    btn('Btn_Iris', -0.42, -0.42, 0.53),
    btn('Btn_ISO', -0.24, -0.42, 0.53),
    btn('Btn_Shutter', -0.06, -0.42, 0.53),
    // controles traseros del lado izquierdo
    box(0.12, 0.62, 0.02, dark, 1.23, -0.12, 0.51),
    group('Selector_ND', [1.23, 0.04, 0.53], box(0.07, 0.12, 0.04, light)),
    group('Interruptor_Auto', [1.23, -0.3, 0.53], box(0.07, 0.1, 0.04, metal)),
    // controles traseros del lado derecho
    group('Btn_REC_Trasero', [1.23, 0.25, -0.53], cylZ(0.055, 0.04, red)),
    group('Palanca_Mando', [1.23, 0.02, -0.54], cylZ(0.07, 0.04, metal), cylZ(0.03, 0.05, dark, 0, 0, -0.03)),
    // correa de agarre (lado derecho)
    box(0.75, 0.6, 0.08, rubber, 0.67, 0, -0.54),
  );

  // ---- Lente ----
  part('Lente_Zeiss',
    cylX(0.42, 0.42, 1.0, dark, -1.15, 0, 0),
    group('Anillo_Lente', [-1.36, 0, 0],
      cylX(0.445, 0.445, 0.2, rubber),
      ...Array.from({ length: 10 }, (_, k) => {
        const a = (k / 10) * Math.PI * 2;
        const m = box(0.18, 0.025, 0.04, ridge, 0, 0.45 * Math.cos(a), 0.45 * Math.sin(a));
        m.rotation.x = a;
        return m;
      }),
    ),
    cylX(0.445, 0.445, 0.1, rubber, -0.95, 0, 0),
    cylX(0.36, 0.36, 0.02, glass, -1.655, 0, 0),
    // costado izquierdo del lente: AF/MF e interruptor FOCUS/ZOOM
    box(0.22, 0.42, 0.06, body, -0.8, 0, 0.43),
    group('Btn_AF', [-0.8, 0.1, 0.47], cylZ(0.045, 0.04, metal)),
    group('Selector_Anillo', [-0.8, -0.1, 0.47], box(0.06, 0.1, 0.04, light)),
  );

  part('Parasol',
    cylX(0.64, 0.46, 0.45, hoodMat, -1.88, 0, 0, true),
    box(0.1, 0.05, 0.08, light, -1.76, 0.55, -0.06),
  );

  part('Filtro_ND', box(0.04, 0.62, 0.62, glass, -0.58, 0, 0));

  part('Sensor_CMOS',
    box(0.06, 0.44, 0.6, chip, -0.46, 0, 0),
    box(0.04, 0.58, 0.74, metal, -0.41, 0, 0),
  );

  // ---- Pantalla LCD: pivote en la bisagra delantera, cerrada contra el lado izquierdo ----
  root.add(group('Pantalla_LCD', [-0.2, 0.12, 0.56],
    box(1.15, 0.62, 0.06, dark, 0.575, 0, 0.03),
    box(1.05, 0.54, 0.012, glass, 0.575, 0, -0.004),
  ));

  part('Visor_OLED',
    box(0.5, 0.32, 0.36, body, 1.6, 0.35, 0),
    cylX(0.14, 0.14, 0.16, rubber, 1.93, 0.35, 0),
  );

  part('Bateria', box(0.4, 0.68, 0.8, dark, 1.56, -0.18, 0));

  // ---- Asa ----
  part('Asa_XLR',
    box(1.7, 0.16, 0.22, body, 0.35, 1.0, 0),
    box(0.14, 0.42, 0.18, body, -0.35, 0.75, 0),
    box(0.14, 0.42, 0.18, body, 1.05, 0.75, 0),
    box(0.42, 0.36, 0.4, dark, -0.7, 0.95, 0),
    cylX(0.07, 0.07, 0.04, metal, -0.92, 0.95, 0.1),
    cylX(0.07, 0.07, 0.04, metal, -0.92, 0.95, -0.1),
    group('Selector_Audio', [-0.7, 0.95, 0.215], box(0.07, 0.05, 0.03, light, -0.06, 0.06, 0), box(0.07, 0.05, 0.03, light, -0.06, -0.06, 0)),
    group('Palanca_Zoom', [0.55, 1.105, 0], box(0.16, 0.05, 0.1, metal)),
    group('Btn_REC', [0.95, 1.1, 0], cylY(0.055, 0.045, red)),
  );

  part('Microfono', cylX(0.07, 0.07, 0.45, rubber, -0.4, 0.65, 0.3));

  // ---- Tarjetas SD: en el panel lateral, detrás de la pantalla ----
  part('Ranuras_SD',
    group('Tarjeta_SD', [0.66, 0.12, 0.47], box(0.26, 0.3, 0.02, card)),
    group('Tapa_SD', [0.66, 0.12, 0.53],
      box(0.36, 0.42, 0.03, door),
      box(0.26, 0.04, 0.012, rubber, 0, 0.08, 0.02),
      box(0.26, 0.04, 0.012, rubber, 0, -0.08, 0.02),
    ),
  );

  part('Conectores',
    box(0.6, 0.35, 0.03, dark, -0.1, -0.25, -0.515),
    cylZ(0.055, 0.05, metal, -0.28, -0.25, -0.54),
    box(0.12, 0.07, 0.03, metal, -0.08, -0.25, -0.54),
    cylZ(0.035, 0.05, metal, 0.1, -0.25, -0.54),
  );

  return root;
}
