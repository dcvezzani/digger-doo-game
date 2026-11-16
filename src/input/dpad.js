// Optional on-screen controls: D-pad arrows move Doo while pressed; the PUMP
// button pumps on touch down and repeats while held.
import { NONE } from '../core/constants.js';

export function attachDpad(root, pumpBtn, { onHeld, onPump, onAnyInput }) {
  let current = NONE;
  for (const btn of root.querySelectorAll('.dpad-btn')) {
    const dir = Number(btn.dataset.dir);
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      onAnyInput?.();
      try { btn.releasePointerCapture?.(e.pointerId); } catch { /* not captured */ }
      btn.classList.add('pressed');
      current = dir;
      onHeld(dir);
    });
    const release = () => {
      btn.classList.remove('pressed');
      if (current === dir) { current = NONE; onHeld(NONE); }
    };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointerleave', release);
    btn.addEventListener('pointercancel', release);
  }
  pumpBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    onAnyInput?.();
    pumpBtn.classList.add('pressed');
    onPump(true);
  });
  const up = () => { if (pumpBtn.classList.contains('pressed')) { pumpBtn.classList.remove('pressed'); onPump(false); } };
  pumpBtn.addEventListener('pointerup', up);
  pumpBtn.addEventListener('pointerleave', up);
  pumpBtn.addEventListener('pointercancel', up);
}
