// Screen layout. `computeLayout` is pure (testable in Node); `readViewport`
// and `applyLayout` touch the DOM.
import { VIEW_W, VIEW_H, TILE, HUD_TOP_ROWS } from '../core/constants.js';

export const BUTTON = 44;           // minimum touch target (CSS px)
export const DPAD_CELL = 60;        // each D-pad arrow (>= 56 CSS px)
export const DPAD_GAP = 4;
export const DPAD_SIZE = DPAD_CELL * 3 + DPAD_GAP * 2;
export const PUMP_SIZE = 84;        // PUMP button (>= 72 CSS px)
const MARGIN = 12;
const ASPECT = VIEW_W / VIEW_H;

/**
 * @param {{vw:number, vh:number, insets:{top:number,right:number,bottom:number,left:number}, dpad:boolean}} v
 * @returns layout in CSS px: playfield rect + scale, top button bar, D-pad and PUMP rects (or null)
 */
export function computeLayout({ vw, vh, insets, dpad }) {
  const left = insets.left, top = insets.top;
  const availW = Math.max(0, vw - insets.left - insets.right);
  const availH = Math.max(0, vh - insets.top - insets.bottom);
  const portrait = vh >= vw;

  // Fit the playfield into a box; reserve room above it when the HUD row is
  // shorter than a 44 px button so buttons never cover board tiles.
  const hudPerW = (HUD_TOP_ROWS * TILE) / VIEW_W;
  const noPadW = BUTTON / hudPerW;
  const fit = (boxW, boxH) => {
    let w = boxH * ASPECT;
    if (w < noPadW) w = Math.min(noPadW, (boxH - BUTTON) / (1 / ASPECT - hudPerW));
    w = Math.max(0, Math.min(boxW, w));
    const scale = w / VIEW_W;
    const hud = HUD_TOP_ROWS * TILE * scale;
    return { w, h: w / ASPECT, scale, pad: Math.max(0, BUTTON - hud) };
  };

  let pf, dpadRect = null, pumpRect = null;
  if (portrait) {
    const reserve = dpad ? DPAD_SIZE + MARGIN * 2 : 0;
    const f = fit(availW, availH - reserve);
    const used = f.h + f.pad + reserve;
    const y0 = top + (dpad ? 0 : Math.max(0, (availH - used) / 2));
    pf = { x: left + (availW - f.w) / 2, y: y0 + f.pad, w: f.w, h: f.h, scale: f.scale, pad: f.pad };
    if (dpad) {
      const below = top + availH - (pf.y + pf.h);
      const dy = pf.y + pf.h + Math.max(MARGIN, (below - DPAD_SIZE) / 2);
      dpadRect = { x: left + MARGIN, y: dy, size: DPAD_SIZE };
      pumpRect = { x: left + availW - MARGIN - PUMP_SIZE, y: dy + (DPAD_SIZE - PUMP_SIZE) / 2, size: PUMP_SIZE };
    }
  } else {
    const side = dpad ? DPAD_SIZE + MARGIN * 2 : 0;
    const f = fit(availW - side * 2, availH);
    const x = left + (availW - f.w) / 2;
    pf = { x, y: top + f.pad + (availH - f.h - f.pad) / 2, w: f.w, h: f.h, scale: f.scale, pad: f.pad };
    if (dpad) {
      const leftSpace = pf.x - left;
      const rightSpace = left + availW - (pf.x + pf.w);
      dpadRect = { x: left + (leftSpace - DPAD_SIZE) / 2, y: top + Math.max(0, (availH - DPAD_SIZE) / 2), size: DPAD_SIZE };
      pumpRect = { x: pf.x + pf.w + (rightSpace - PUMP_SIZE) / 2, y: dpadRect.y + (DPAD_SIZE - PUMP_SIZE) / 2, size: PUMP_SIZE };
    }
  }
  const hudH = HUD_TOP_ROWS * TILE * pf.scale;
  const bar = { x: pf.x, y: pf.y - pf.pad, w: pf.w, h: hudH + pf.pad };
  return { portrait, pf, bar, dpad: dpadRect, pump: pumpRect, vw, vh, insets };
}

export function readViewport(probe) {
  const cs = getComputedStyle(probe);
  const px = (v) => Number.parseFloat(v) || 0;
  const vv = window.visualViewport;
  return {
    vw: Math.round(vv ? vv.width : window.innerWidth),
    vh: Math.round(vv ? vv.height : window.innerHeight),
    insets: { top: px(cs.paddingTop), right: px(cs.paddingRight), bottom: px(cs.paddingBottom), left: px(cs.paddingLeft) },
  };
}

export function applyLayout(L, els) {
  const { canvas, bar, dpad, pump } = els;
  const s = canvas.style;
  s.left = `${L.pf.x}px`; s.top = `${L.pf.y}px`; s.width = `${L.pf.w}px`; s.height = `${L.pf.h}px`;
  bar.style.left = `${L.bar.x}px`;
  bar.style.top = `${L.bar.y + Math.max(0, (L.bar.h - BUTTON) / 2)}px`;
  bar.style.width = `${L.bar.w - 4}px`;
  bar.style.height = `${BUTTON}px`;
  if (L.dpad) {
    dpad.hidden = false;
    pump.hidden = false;
    Object.assign(dpad.style, { left: `${L.dpad.x}px`, top: `${L.dpad.y}px`, width: `${L.dpad.size}px`, height: `${L.dpad.size}px` });
    Object.assign(pump.style, { left: `${L.pump.x}px`, top: `${L.pump.y}px`, width: `${L.pump.size}px`, height: `${L.pump.size}px` });
  } else {
    dpad.hidden = true;
    pump.hidden = true;
  }
}
