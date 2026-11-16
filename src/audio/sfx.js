// Synthesized sound effects (Web Audio API, no audio files) and haptics.
// Everything is guarded: without Web Audio or vibration the game stays silent.

const VIBRATION = {
  death: [120],
  pop: [30],
  crush: [60],
  levelClear: [40, 60, 40],
};

export function createSfx({ isMuted }) {
  let ctx = null;
  let master = null;
  let alarm = null;
  let noise = null;
  let lastDig = 0;

  function ensure() {
    if (ctx) return ctx;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = isMuted() ? 0 : 0.5;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
    return ctx;
  }

  /** Call from a user gesture (tap, click, key) to satisfy autoplay rules. */
  function unlock() {
    const c = ensure();
    if (c && c.state !== 'running') c.resume().catch(() => {});
  }

  const live = () => ctx && ctx.state === 'running' && !isMuted();

  function tone({ type = 'square', from, to = from, dur = 0.1, vol = 0.3, at = 0, slide = 'exp' }) {
    if (!live()) return;
    try {
      const t = ctx.currentTime + at;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(from, t);
      if (to !== from) {
        if (slide === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
        else o.frequency.linearRampToValueAtTime(to, t + dur);
      }
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch { /* ignore audio errors */ }
  }

  function burst({ dur = 0.1, vol = 0.2, freq = 1200, q = 1, at = 0 }) {
    if (!live()) return;
    try {
      if (!noise) {
        const len = Math.floor(ctx.sampleRate * 0.5);
        noise = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = noise.getChannelData(0);
        let s = 12345;
        for (let i = 0; i < len; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = (s / 0x3fffffff) - 1; }
      }
      const t = ctx.currentTime + at;
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(master);
      src.start(t);
      src.stop(t + dur + 0.02);
    } catch { /* ignore */ }
  }

  const seq = (notes, step, opts) => notes.forEach((f, i) => tone({ from: f, dur: step * 0.9, at: i * step, ...opts }));

  function vibrate(kind) {
    if (isMuted()) return;
    try { if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(VIBRATION[kind]); } catch { /* unsupported */ }
  }

  function startAlarm() {
    if (!live() || alarm) return;
    try {
      const o = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = 660;
      lfo.type = 'square';
      lfo.frequency.value = 4;
      lfoGain.gain.value = 110;
      g.gain.value = 0.05;
      lfo.connect(lfoGain).connect(o.frequency);
      o.connect(g).connect(master);
      o.start(); lfo.start();
      alarm = { o, lfo, g };
    } catch { alarm = null; }
  }

  function stopAlarm() {
    if (!alarm) return;
    try {
      const t = ctx.currentTime;
      alarm.g.gain.setTargetAtTime(0, t, 0.01);
      alarm.o.stop(t + 0.06);
      alarm.lfo.stop(t + 0.06);
    } catch { /* already stopped */ }
    alarm = null;
  }

  function handle(e) {
    switch (e.type) {
      case 'dig': {
        const now = ctx ? ctx.currentTime : 0;
        if (now - lastDig > 0.07) { burst({ dur: 0.05, vol: 0.14, freq: 500 + Math.random() * 300, q: 0.8 }); lastDig = now; }
        break;
      }
      case 'hose':
        burst({ dur: 0.12, vol: 0.12, freq: 2400, q: 0.6 });
        tone({ type: 'triangle', from: 300, to: 520, dur: 0.1, vol: 0.08 });
        break;
      case 'inflate':
        tone({ type: 'sine', from: 220 + e.stage * 140, to: 320 + e.stage * 180, dur: 0.14, vol: 0.25 });
        burst({ dur: 0.1, vol: 0.08, freq: 1800 });
        break;
      case 'pop':
        burst({ dur: 0.18, vol: 0.35, freq: 900, q: 0.5 });
        tone({ type: 'square', from: 900, to: 140, dur: 0.16, vol: 0.18 });
        vibrate('pop');
        break;
      case 'wobble':
        for (let i = 0; i < 4; i++) burst({ dur: 0.05, vol: 0.12, freq: 260, q: 2, at: i * 0.12 });
        break;
      case 'land':
        burst({ dur: 0.25, vol: 0.4, freq: 120, q: 0.7 });
        tone({ type: 'sine', from: 110, to: 45, dur: 0.25, vol: 0.3 });
        break;
      case 'crush':
        seq([523, 659, 784], 0.06, { type: 'square', vol: 0.16 });
        vibrate('crush');
        break;
      case 'charge':
        tone({ type: 'sawtooth', from: 120, to: 260, dur: 0.55, vol: 0.07, slide: 'lin' });
        break;
      case 'flame':
        burst({ dur: 0.5, vol: 0.25, freq: 700, q: 0.4 });
        tone({ type: 'sawtooth', from: 180, to: 90, dur: 0.45, vol: 0.1 });
        break;
      case 'gemSpawn':
        seq([1175, 1568], 0.07, { type: 'triangle', vol: 0.18 });
        break;
      case 'gem':
        seq([988, 1319, 1760], 0.07, { type: 'triangle', vol: 0.25 });
        break;
      case 'extraLife':
        seq([523, 659, 784, 1047, 784, 1047], 0.07, { type: 'square', vol: 0.18 });
        break;
      case 'death':
        stopAlarm();
        vibrate('death');
        break;
      case 'deathAnim':
        tone({ type: 'triangle', from: 880, to: 110, dur: 1.0, vol: 0.22 });
        tone({ type: 'square', from: 160, to: 70, dur: 0.15, vol: 0.18, at: 1.05 });
        break;
      case 'levelClear':
        stopAlarm();
        seq([392, 494, 587, 784, 988], 0.09, { type: 'triangle', vol: 0.25 });
        vibrate('levelClear');
        break;
      case 'gameStart':
        seq([262, 330, 392, 330, 440, 523], 0.1, { type: 'square', vol: 0.15 });
        break;
      case 'fleeEnd':
      case 'pause':
      case 'quit':
      case 'gameOver':
        stopAlarm();
        break;
      default:
        break;
    }
  }

  return {
    unlock,
    handle,
    setMuted(m) {
      if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.5, ctx.currentTime, 0.01);
      if (m) stopAlarm();
    },
    /** Keep the flee alarm in step with the game (call every frame). */
    syncAlarm(active) { if (active) startAlarm(); else stopAlarm(); },
    get alarmOn() { return !!alarm; },
    suspend() { stopAlarm(); try { ctx?.suspend(); } catch { /* ignore */ } },
    resume() { try { if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); } catch { /* ignore */ } },
    get context() { return ctx; },
  };
}
