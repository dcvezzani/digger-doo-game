// Keyboard: arrows + WASD move while held (most recent key wins); Space / X
// pump (held = repeat); Enter confirms; P / Escape pause; M sound.
import { UP, LEFT, DOWN, RIGHT, NONE } from '../core/constants.js';

export const DIR_KEYS = {
  ArrowUp: UP, ArrowLeft: LEFT, ArrowDown: DOWN, ArrowRight: RIGHT,
  KeyW: UP, KeyA: LEFT, KeyS: DOWN, KeyD: RIGHT,
};
const PUMP_KEYS = new Set(['Space', 'KeyX']);

/** Pure held-key stack: the most recently pressed key still held wins. */
export function createKeyStack() {
  const stack = [];
  return {
    press(code) { const i = stack.indexOf(code); if (i >= 0) stack.splice(i, 1); stack.push(code); return this.dir; },
    release(code) { const i = stack.indexOf(code); if (i >= 0) stack.splice(i, 1); return this.dir; },
    clear() { stack.length = 0; },
    get dir() { return stack.length ? DIR_KEYS[stack[stack.length - 1]] : NONE; },
  };
}

export function attachKeyboard(target, { onHeld, onPump, onConfirm, onPumpOrConfirm, onPause, onMute, onAnyInput }) {
  const keys = createKeyStack();
  const pumping = new Set();
  const down = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    onAnyInput?.();
    if (e.code in DIR_KEYS) {
      e.preventDefault();
      if (!e.repeat) onHeld(keys.press(e.code));
    } else if (PUMP_KEYS.has(e.code)) {
      e.preventDefault();
      if (e.repeat || e.target instanceof HTMLButtonElement) return;
      pumping.add(e.code);
      onPumpOrConfirm();
    } else if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      e.preventDefault();
      if (!e.repeat && !(e.target instanceof HTMLButtonElement)) onConfirm();
    } else if ((e.code === 'KeyP' || e.code === 'Escape') && !e.repeat) {
      e.preventDefault();
      onPause();
    } else if (e.code === 'KeyM' && !e.repeat) {
      onMute();
    }
  };
  const up = (e) => {
    if (e.code in DIR_KEYS) onHeld(keys.release(e.code));
    else if (pumping.delete(e.code) && pumping.size === 0) onPump(false);
  };
  const blur = () => { keys.clear(); onHeld(NONE); if (pumping.size) { pumping.clear(); onPump(false); } };
  target.addEventListener('keydown', down);
  target.addEventListener('keyup', up);
  target.addEventListener('blur', blur);
  return () => { target.removeEventListener('keydown', down); target.removeEventListener('keyup', up); target.removeEventListener('blur', blur); };
}
