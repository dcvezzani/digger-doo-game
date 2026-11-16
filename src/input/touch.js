// Touch / pointer controls. The first pointer steers: drag to set the held
// direction, lift to stop; a drag-free touch is a tap. Every other pointer
// that goes down while the first is held is a pump finger.
import { createSwipe } from '../core/swipe.js';
import { NONE } from '../core/constants.js';

export const isUiTarget = (el) => !!(el && el.closest && el.closest('button, .panel, #dpad'));

export function attachTouch(target, { onHeld, onPump, onTap, onAnyInput, threshold }) {
  const swipe = createSwipe(threshold);
  let steerId = null;
  const pumpIds = new Set();

  const down = (e) => {
    onAnyInput?.();
    if (isUiTarget(e.target)) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (steerId === null) {
      steerId = e.pointerId;
      swipe.start(e.clientX, e.clientY);
    } else if (!pumpIds.has(e.pointerId)) {
      pumpIds.add(e.pointerId);
      onPump(true);
    }
  };
  const move = (e) => {
    if (e.pointerId !== steerId) return;
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    for (const ev of events.length ? events : [e]) {
      const d = swipe.move(ev.clientX, ev.clientY);
      if (d !== NONE) onHeld(d);
    }
  };
  const up = (e) => {
    if (pumpIds.delete(e.pointerId)) { if (pumpIds.size === 0) onPump(false); return; }
    if (e.pointerId !== steerId) return;
    steerId = null;
    const tap = swipe.end();
    onHeld(NONE);
    if (tap) onTap();
  };
  const cancel = (e) => {
    if (pumpIds.delete(e.pointerId)) { if (pumpIds.size === 0) onPump(false); return; }
    if (e.pointerId !== steerId) return;
    steerId = null;
    swipe.cancel();
    onHeld(NONE);
  };

  target.addEventListener('pointerdown', down);
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', up);
  target.addEventListener('pointercancel', cancel);

  // Block page gestures: scrolling, pull-to-refresh, pinch and double-tap zoom.
  const stop = (e) => { if (e.cancelable) e.preventDefault(); };
  target.addEventListener('touchmove', stop, { passive: false });
  target.addEventListener('gesturestart', stop);
  target.addEventListener('dblclick', stop);
  target.addEventListener('contextmenu', stop);
}
