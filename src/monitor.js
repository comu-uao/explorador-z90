// Pantalla simulada: imita la información que muestra la LCD de la Z90V en cada paso de la práctica.
// Estado: bateria, pantalla, encendida, tarjeta, formato, manual, iris, nd, wb, zoom, foco, audio, rec

const KEYS = ['bateria', 'pantalla', 'encendida', 'tarjeta', 'formato', 'manual', 'iris', 'nd', 'wb', 'zoom', 'foco', 'audio', 'rec'];

export class Monitor {
  constructor(el) {
    this.el = el;
    el.innerHTML = `
      <p class="mon-cap">Pantalla de la cámara</p>
      <div class="mon-screen">
        <div class="scene" aria-hidden="true">
          <div class="sky"></div><div class="sun"></div>
          <div class="hill h1"></div><div class="hill h2"></div>
          <div class="tree"><i></i></div>
          <div class="person"><i></i></div>
          <div class="tint"></div>
        </div>
        <div class="hud" aria-hidden="true">
          <div class="hud-top"><span class="bat"><i></i><i></i><i></i></span><span class="st"></span></div>
          <div class="hud-fmt"><span class="fmt"></span><span class="hmode"></span></div>
          <div class="hud-audio"><span class="ch">CH1</span><b></b><span class="ch">CH2</span><b></b></div>
          <div class="hud-bottom"><span class="nd"></span><span class="f"></span><span class="iso"></span><span class="wbt"></span></div>
        </div>
        <p class="msg"></p>
      </div>
      <p class="mon-live" role="status"></p>`;
    this.$ = (s) => el.querySelector(s);
    this.timer = null;
    this.secs = 0;
  }

  set(s) {
    const d = this.el.dataset;
    for (const k of KEYS) d[k] = String(!!s[k]);
    const on = s.pantalla && s.bateria && s.encendida;
    const msg = !s.pantalla ? 'Pantalla cerrada' : !on ? 'Cámara apagada' : '';
    this.$('.msg').textContent = msg;
    this.$('.fmt').textContent = s.formato ? 'AVCHD 1080/60i' : 'XAVC HD';
    this.$('.hmode').textContent = s.manual ? 'MANUAL' : 'AUTO';
    this.$('.nd').textContent = s.nd ? 'ND1' : 'ND —';
    this.$('.f').textContent = s.iris ? 'F4.0' : 'A F5.6';
    this.$('.iso').textContent = s.iris ? 'ISO320' : 'A ISO400';
    this.$('.wbt').textContent = s.wb ? 'WB A' : 'AWB';
    this.$('.mon-live').textContent = msg || (s.rec ? 'Grabando' : '');
    clearInterval(this.timer);
    if (s.rec) {
      this.secs = 0;
      this.tick();
      this.timer = setInterval(() => { this.secs++; this.tick(); }, 1000);
    } else {
      this.$('.st').textContent = s.tarjeta ? 'STBY' : 'SIN TARJETA';
    }
  }

  tick() {
    const m = String(Math.floor(this.secs / 60)).padStart(2, '0');
    const sec = String(this.secs % 60).padStart(2, '0');
    this.$('.st').textContent = `● REC 00:${m}:${sec}`;
  }

  stop() { clearInterval(this.timer); }
}
