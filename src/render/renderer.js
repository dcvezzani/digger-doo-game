// Canvas renderer. Draws the cached dirt layer (patched from the board's dirty
// list), tunnels, characters, hose, flame, HUD and screens. All drawing is in
// logical playfield pixels (448x576); one transform maps to device pixels.
import {
  COLS, TILE, VIEW_W, VIEW_H, UNITS, SUB, SUB_COLS, DIRT_TOP, DIRT_BOTTOM, SURFACE_ROW,
  UP, LEFT, DOWN, RIGHT, DX, DY, START_TILE,
} from '../core/constants.js';
import { createRng } from '../core/rng.js';
import { GEMS } from '../core/levels.js';

const PX = TILE / UNITS;               // logical px per unit
const SUBPX = TILE / SUB;              // 8 px per sub-cell
const TUNNEL = '#120b16';
const INK = '#fff6e6';
const ACCENT = '#ffd23f';
const GEM_COLORS = {
  quartz: '#f2f0ff', amber: '#ffb33d', jade: '#5fd38d', ruby: '#ff3b5c', sapphire: '#3f7dff',
  opal: '#c7f0ff', emerald: '#21c46b', topaz: '#ffcf4a', diamond: '#e9fbff', starstone: '#ff9cf2',
};
// Earth palettes (layer 1..4), cycled per level.
const PALETTES = [
  ['#e0a458', '#c0703c', '#8c4a2f', '#5e2f3b'],
  ['#d9b26f', '#a4794a', '#6f5a3e', '#463650'],
  ['#e8946a', '#bf5f4a', '#83405a', '#4b2c5e'],
  ['#c9b46a', '#8fa055', '#5e7448', '#3a4a52'],
];

const px = (u) => u * PX;

export function createRenderer(canvas, { isTouch = false } = {}) {
  const ctx = canvas.getContext('2d');
  const dirt = document.createElement('canvas');
  const dctx = dirt.getContext('2d');
  let k = 1;                // device px per logical px
  let cacheLevel = -1;
  const floats = [];        // floating score texts
  let lastLevelClear = -1;

  function resize(layout) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.round(layout.pf.w * dpr), h = Math.round(layout.pf.h * dpr);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    k = w / VIEW_W;
    dirt.width = w;
    dirt.height = h;
    cacheLevel = -1;
  }

  // --- dirt cache ------------------------------------------------------------
  function buildDirt(g) {
    const pal = PALETTES[(g.level - 1) % PALETTES.length];
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    dctx.clearRect(0, 0, dirt.width, dirt.height);
    dctx.setTransform(k, 0, 0, k, 0, 0);
    const bands = [[2, 5], [6, 9], [10, 13], [14, 16]];
    bands.forEach(([a, b], i) => {
      dctx.fillStyle = pal[i];
      dctx.fillRect(0, a * TILE, VIEW_W, (b - a + 1) * TILE);
    });
    // Speckle texture and strata lines (seeded per level so it is stable).
    const rng = createRng(1000 + g.level);
    for (let i = 0; i < 520; i++) {
      const x = rng.next() * VIEW_W, y = DIRT_TOP * TILE + rng.next() * 15 * TILE;
      const s = 1 + rng.int(3);
      dctx.fillStyle = rng.next() < 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.10)';
      dctx.fillRect(x, y, s, s);
    }
    dctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (const r of [6, 10, 14]) dctx.fillRect(0, r * TILE - 1, VIEW_W, 2);
    // Erase every clear sub-cell in the dirt rows (row runs).
    const cells = g.board.cells;
    for (let sy = DIRT_TOP * SUB; sy < (DIRT_BOTTOM + 1) * SUB; sy++) {
      let run = -1;
      for (let sx = 0; sx <= SUB_COLS; sx++) {
        const clear = sx < SUB_COLS && cells[sy * SUB_COLS + sx] === 0;
        if (clear && run < 0) run = sx;
        if (!clear && run >= 0) { eraseCells(run, sy, sx - run, 1); run = -1; }
      }
    }
    g.board.dirty.length = 0;
    g.board.rebuild = false;
    cacheLevel = g.level;
  }

  function eraseCells(sx, sy, w, h) {
    dctx.clearRect(sx * SUBPX, sy * SUBPX, w * SUBPX, h * SUBPX);
  }

  function syncDirt(g) {
    if (cacheLevel !== g.level || g.board.rebuild) { buildDirt(g); return; }
    const d = g.board.dirty;
    for (let i = 0; i < d.length; i++) eraseCells(d[i][0], d[i][1], d[i][2], d[i][3]);
    d.length = 0;
  }

  // --- events -----------------------------------------------------------------
  function handleEvent(e, now) {
    if (e.type === 'pop' || e.type === 'crush' || e.type === 'gem') {
      floats.push({ text: String(e.points), x: px(e.x), y: px(e.y), until: now + 1100, born: now });
    } else if (e.type === 'levelClear') {
      lastLevelClear = now;
    }
  }

  // --- drawing ----------------------------------------------------------------
  function draw(game, now, { muted = false } = {}) {
    const g = game.state;
    syncDirt(g);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.fillStyle = '#07040c';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (g.phase === 'start') { drawStart(g, now); return; }
    drawSky(g, now);
    ctx.fillStyle = TUNNEL;
    ctx.fillRect(0, DIRT_TOP * TILE, VIEW_W, 15 * TILE);
    ctx.drawImage(dirt, 0, 0, VIEW_W, VIEW_H);
    drawGrass(g);
    if (g.gem) drawGem(px(g.gem.x), px(g.gem.y), g.gem.kind, now, 1);
    for (const b of g.boulders) drawBoulder(b, now);
    for (const e of g.enemies) if (e.state === 'fire') drawFlame(e, now);
    drawHose(g);
    for (const e of g.enemies) drawEnemy(g, e, now);
    drawDoo(g, now);
    drawFloats(now);
    drawHud(g, now);
    drawOverlay(g, now);
    if (muted) drawMuted();
  }

  function drawSky(g, now) {
    const grad = ctx.createLinearGradient(0, TILE, 0, DIRT_TOP * TILE);
    grad.addColorStop(0, '#1b1446');
    grad.addColorStop(1, '#3a2a6e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, SURFACE_ROW * TILE, VIEW_W, TILE);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 12; i++) {
      const x = (i * 97 + 31) % VIEW_W, y = TILE + 4 + ((i * 53) % 14);
      if (((now / 600 + i) | 0) % 5) ctx.fillRect(x, y, 1.5, 1.5);
    }
    ctx.fillStyle = '#f6f0c8';
    ctx.beginPath(); ctx.arc(VIEW_W - 34, TILE + 12, 7, 0, 7); ctx.fill();
    ctx.fillStyle = '#2a1f5a';
    ctx.beginPath(); ctx.arc(VIEW_W - 31, TILE + 10, 6, 0, 7); ctx.fill();
  }

  function drawGrass(g) {
    const cells = g.board.cells, sy = DIRT_TOP * SUB;
    ctx.fillStyle = '#4fbf5a';
    for (let sx = 0; sx < SUB_COLS; sx++) {
      if (cells[sy * SUB_COLS + sx] !== 1) continue;
      ctx.fillRect(sx * SUBPX, DIRT_TOP * TILE - 3, SUBPX, 4);
      ctx.fillRect(sx * SUBPX + 2, DIRT_TOP * TILE - 6, 2, 3);
    }
  }

  function drawGem(x, y, kind, now, scale) {
    const c = GEM_COLORS[kind] || '#fff';
    const s = 10 * scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowColor = c; ctx.shadowBlur = 10 * scale;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(0, -s); ctx.lineTo(s * 0.9, -s * 0.2); ctx.lineTo(0, s); ctx.lineTo(-s * 0.9, -s * 0.2);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.35, -s * 0.2); ctx.lineTo(-s * 0.35, -s * 0.2); ctx.closePath(); ctx.fill();
    if (scale >= 1 && ((now / 150) | 0) % 4 === 0) { ctx.fillStyle = '#fff'; ctx.fillRect(s * 0.5, -s, 2, 2); }
    ctx.restore();
  }

  function drawBoulder(b, now) {
    if (b.state === 'gone') return;
    let x = px(b.x), y = px(b.y);
    if (b.state === 'wobble') x += Math.sin(now / 30) * 2;
    ctx.save();
    ctx.translate(x, y);
    if (b.state === 'crumble') {
      const t = 1 - b.timer / 30;
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = '#9a9488';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.fillRect(Math.cos(a) * 10 * (1 + t * 1.5) - 3, Math.sin(a) * 6 + t * 10 - 3, 6, 6);
      }
      ctx.restore();
      return;
    }
    ctx.fillStyle = '#8f8a80';
    ctx.beginPath();
    const pts = [[-14, 4], [-12, -8], [-4, -14], [8, -13], [14, -4], [13, 9], [4, 14], [-9, 13]];
    pts.forEach(([a, c], i) => (i ? ctx.lineTo(a, c) : ctx.moveTo(a, c)));
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#b9b3a6';
    ctx.beginPath(); ctx.ellipse(-4, -6, 6, 4, -0.4, 0, 7); ctx.fill();
    ctx.fillStyle = '#5f5a52';
    ctx.beginPath(); ctx.ellipse(5, 7, 6, 3, 0.2, 0, 7); ctx.fill();
    ctx.fillRect(-8, 2, 3, 2); ctx.fillRect(6, -6, 2, 2);
    ctx.restore();
  }

  function drawHose(g) {
    const h = g.hose, p = g.player;
    if (h.state !== 'out' && h.state !== 'hooked') return;
    const x0 = px(p.x), y0 = px(p.y);
    const x1 = x0 + DX[h.dir] * px(h.len), y1 = y0 + DY[h.dir] * px(h.len);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#2b6e9e'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = '#9fe3ff'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#d7f4ff';
    ctx.beginPath(); ctx.arc(x1, y1, 3.5, 0, 7); ctx.fill();
    ctx.restore();
  }

  function drawFlame(e, now) {
    if (!e.flameTiles) return;
    ctx.save();
    for (let i = 0; i < e.flameTiles.length; i++) {
      const [tx, ty] = e.flameTiles[i];
      const cx = tx * TILE + TILE / 2, cy = ty * TILE + TILE / 2;
      const f = Math.sin(now / 40 + i) * 2;
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 16);
      grad.addColorStop(0, '#fff6a8'); grad.addColorStop(0.45, '#ffb000'); grad.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.ellipse(cx, cy, 17 - i, 10 + f, 0, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  function eyes(dir, spread = 5, y = -2, r = 3.6, pupil = 1.8) {
    const ox = DX[dir] * 1.6, oy = DY[dir] * 1.6;
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(s * spread, y, r, 0, 7); ctx.fill();
      ctx.fillStyle = '#1a1020';
      ctx.beginPath(); ctx.arc(s * spread + ox, y + oy, pupil, 0, 7); ctx.fill();
    }
  }

  function drawEnemy(g, e, now) {
    if (e.state === 'gone' || e.state === 'escaped') return;
    const x = px(e.x), y = px(e.y);
    ctx.save();
    ctx.translate(x, y);
    if (e.state === 'ghost' || e.state === 'fleeUp') {
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = e.kind === 'gloop' ? 'rgba(90,240,220,0.35)' : 'rgba(255,140,60,0.35)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, 7); ctx.stroke();
      ctx.setLineDash([]);
      eyes(e.dir, 5, 0, 4, 2);
      ctx.restore();
      return;
    }
    if (e.state === 'popped') {
      const t = 1 - e.timer / 30;
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = e.kind === 'gloop' ? '#7ff5e4' : '#ffb26b';
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        ctx.beginPath(); ctx.arc(Math.cos(a) * (8 + t * 18), Math.sin(a) * (8 + t * 18), 3 * (1 - t) + 1, 0, 7); ctx.fill();
      }
      ctx.restore();
      return;
    }
    if (e.state === 'crushed') {
      ctx.scale(1.3, 0.35);
      ctx.translate(0, 18);
    }
    const scale = e.state === 'inflated' ? [1, 1.2, 1.45, 1.7, 1.9][e.stage] : 1;
    ctx.scale(scale, scale);
    if (e.kind === 'gloop') drawGloop(e, now); else drawSizzler(e, now);
    ctx.restore();
  }

  function drawGloop(e, now) {
    const inflated = e.state === 'inflated';
    const w = Math.sin(now / 140 + e.id) * (inflated ? 0 : 1.5);
    ctx.fillStyle = inflated ? 'rgba(150,255,240,0.92)' : 'rgba(60,214,196,0.92)';
    // a squat jelly dome that squishes as it wobbles
    ctx.beginPath();
    ctx.moveTo(-13 - w, 9);
    ctx.bezierCurveTo(-15 - w, -4, -9, -14, 0, -13 + w);
    ctx.bezierCurveTo(9, -14, 15 + w, -4, 13 + w, 9);
    ctx.bezierCurveTo(10, 13, -10, 13, -13 - w, 9);
    ctx.fill();
    ctx.fillStyle = inflated ? 'rgba(90,220,200,0.6)' : 'rgba(20,150,140,0.55)';
    ctx.beginPath(); ctx.ellipse(0, 9, 11 + w, 3, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.ellipse(-5, -8, 4, 2.5, -0.5, 0, 7); ctx.fill();
    if (inflated) {
      ctx.fillStyle = '#1a1020';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 7, -4); ctx.lineTo(s * 3, -1); ctx.moveTo(s * 3, -4); ctx.lineTo(s * 7, -1); ctx.strokeStyle = '#1a1020'; ctx.lineWidth = 1.5; ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,120,150,0.6)';
      ctx.beginPath(); ctx.arc(-8, 3, 2.5, 0, 7); ctx.arc(8, 3, 2.5, 0, 7); ctx.fill();
    } else {
      eyes(e.dir, 5, -3);
    }
  }

  function drawSizzler(e, now) {
    const inflated = e.state === 'inflated';
    const charging = e.state === 'charge';
    if (charging) {
      ctx.shadowColor = '#ffe14a'; ctx.shadowBlur = 12 + Math.sin(now / 50) * 6;
    }
    // spikes
    ctx.fillStyle = charging ? '#ffe14a' : '#ff8a1e';
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.22) * 10, Math.sin(a - 0.22) * 10);
      ctx.lineTo(Math.cos(a) * 16, Math.sin(a) * 16);
      ctx.lineTo(Math.cos(a + 0.22) * 10, Math.sin(a + 0.22) * 10);
      ctx.fill();
    }
    ctx.fillStyle = inflated ? '#ff9a7a' : charging ? '#ffb347' : '#e8432e';
    ctx.beginPath(); ctx.ellipse(0, 1, 13, 11, 0, 0, 7); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffd36b';
    ctx.fillRect(-6, 5, 2, 2); ctx.fillRect(5, 3, 2, 2); ctx.fillRect(0, 7, 2, 2);
    // legs
    ctx.strokeStyle = '#5a1a12'; ctx.lineWidth = 2;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 6, 10); ctx.lineTo(s * 9, 14); ctx.stroke(); }
    if (inflated) {
      ctx.strokeStyle = '#1a1020'; ctx.lineWidth = 1.5;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 7, -4); ctx.lineTo(s * 3, -1); ctx.moveTo(s * 3, -4); ctx.lineTo(s * 7, -1); ctx.stroke(); }
    } else {
      // snout in facing direction
      ctx.fillStyle = '#b8301f';
      if (e.dir === LEFT || e.dir === RIGHT) {
        const s = e.dir === LEFT ? -1 : 1;
        ctx.beginPath(); ctx.ellipse(s * 12, 2, 4, 3, 0, 0, 7); ctx.fill();
      }
      eyes(e.dir, 4.5, -2, 3.2, 1.7);
    }
  }

  function drawDoo(g, now) {
    const p = g.player;
    const dying = g.phase === 'dying';
    const x = px(p.x), y = px(p.y);
    ctx.save();
    ctx.translate(x, y);
    if (dying) {
      const t = 1 - g.phaseTimer / 120;
      ctx.rotate(t * Math.PI * 4);
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, t - 0.6) * 2.5);
      ctx.scale(1 - t * 0.4, 1 - t * 0.4);
    }
    const bob = p.moving ? Math.sin(now / 60) * 1.2 : 0;
    ctx.translate(0, bob);
    let face = p.dir;
    // Headlamp beam
    if (!dying) {
      ctx.save();
      ctx.rotate([-Math.PI / 2, Math.PI, Math.PI / 2, 0][face]);
      const beam = ctx.createLinearGradient(8, 0, 40, 0);
      beam.addColorStop(0, 'rgba(255,240,160,0.35)'); beam.addColorStop(1, 'rgba(255,240,160,0)');
      ctx.fillStyle = beam;
      ctx.beginPath(); ctx.moveTo(8, -3); ctx.lineTo(40, -12); ctx.lineTo(40, 12); ctx.lineTo(8, 3); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    const flip = face === LEFT ? -1 : 1;
    ctx.scale(flip, 1);
    const vertical = face === UP || face === DOWN;
    // body
    ctx.fillStyle = '#8a5a3c';
    ctx.beginPath(); ctx.ellipse(0, 3, 12, 11, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#c99a72';
    ctx.beginPath(); ctx.ellipse(vertical ? 0 : 2, 6, 7, 6, 0, 0, 7); ctx.fill();
    // claws (dig animation)
    const claw = p.digging ? Math.sin(now / 45) * 2 : 0;
    ctx.fillStyle = '#f1d9c0';
    if (vertical) {
      const s = face === UP ? -1 : 1;
      ctx.fillRect(-10, 6 * s + claw, 4, 3); ctx.fillRect(6, 6 * s - claw, 4, 3);
    } else {
      ctx.fillRect(10, 2 + claw, 4, 3); ctx.fillRect(10, 7 - claw, 4, 3);
    }
    // face
    ctx.fillStyle = '#1a1020';
    if (vertical) {
      ctx.beginPath(); ctx.arc(-4, face === UP ? -2 : 1, 1.8, 0, 7); ctx.arc(4, face === UP ? -2 : 1, 1.8, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff8fb1';
      ctx.beginPath(); ctx.arc(0, face === UP ? -5 : 5, 2.6, 0, 7); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(4, 0, 1.9, 0, 7); ctx.fill();
      ctx.fillStyle = '#ff8fb1';
      ctx.beginPath(); ctx.arc(12, 3, 3, 0, 7); ctx.fill();
    }
    // hard hat + lamp
    ctx.fillStyle = '#ffcc1f';
    ctx.beginPath(); ctx.ellipse(0, -7, 11, 7, 0, Math.PI, 0); ctx.fill();
    ctx.fillRect(-13, -8, 26, 3);
    ctx.fillStyle = '#e0a800';
    ctx.fillRect(-1, -14, 2, 7);
    ctx.fillStyle = '#fff7c2';
    ctx.beginPath(); ctx.arc(vertical ? 0 : 7, -10, 2.6, 0, 7); ctx.fill();
    ctx.restore();
    if (dying && g.phaseTimer < 90) {
      ctx.fillStyle = ACCENT;
      for (let i = 0; i < 4; i++) {
        const a = now / 200 + (i * Math.PI) / 2;
        ctx.fillRect(x + Math.cos(a) * 16 - 1.5, y - 14 + Math.sin(a) * 5 - 1.5, 3, 3);
      }
    }
  }

  function drawFloats(now) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 13px system-ui, sans-serif';
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      if (now > f.until) { floats.splice(i, 1); continue; }
      const t = (now - f.born) / (f.until - f.born);
      ctx.globalAlpha = 1 - t * t;
      ctx.fillStyle = '#000';
      ctx.fillText(f.text, f.x + 1, f.y - 10 - t * 14 + 1);
      ctx.fillStyle = INK;
      ctx.fillText(f.text, f.x, f.y - 10 - t * 14);
    }
    ctx.restore();
  }

  function drawHud(g, now) {
    ctx.fillStyle = '#07040c';
    ctx.fillRect(0, 0, VIEW_W, TILE);
    ctx.fillRect(0, 17 * TILE, VIEW_W, TILE);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.font = '600 9px system-ui, sans-serif';
    ctx.fillStyle = '#ff8a5c';
    ctx.fillText('SCORE', 8, 10);
    ctx.fillText('HIGH', 132, 10);
    ctx.font = '700 18px ui-monospace, Menlo, Consolas, monospace';
    ctx.fillStyle = INK;
    ctx.fillText(String(g.score), 8, 28);
    ctx.fillText(String(g.high), 132, 28);
    // bottom: reserve lives, level and recent gems
    for (let i = 0; i < Math.min(g.lives - 1, 6); i++) drawMiniDoo(16 + i * 22, 17 * TILE + 16);
    ctx.textAlign = 'right';
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.fillStyle = INK;
    ctx.fillText(`LV ${g.level}`, VIEW_W - 8, 17 * TILE + 21);
    const first = Math.max(1, g.level - 4);
    let gx = VIEW_W - 64;
    for (let L = g.level; L >= first; L--) {
      let kind = GEMS[0][1];
      for (const row of GEMS) if (L >= row[0]) kind = row[1];
      drawGem(gx, 17 * TILE + 16, kind, now, 0.7);
      gx -= 18;
    }
  }

  function drawMiniDoo(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(0.6, 0.6);
    ctx.fillStyle = '#8a5a3c';
    ctx.beginPath(); ctx.ellipse(0, 3, 12, 11, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffcc1f';
    ctx.beginPath(); ctx.ellipse(0, -7, 11, 7, 0, Math.PI, 0); ctx.fill();
    ctx.fillRect(-13, -8, 26, 3);
    ctx.fillStyle = '#ff8fb1';
    ctx.beginPath(); ctx.arc(12, 3, 3, 0, 7); ctx.fill();
    ctx.restore();
  }

  function banner(text, sub, color = ACCENT) {
    const cy = (START_TILE.y + 2.5) * TILE;
    ctx.save();
    ctx.fillStyle = 'rgba(7,4,12,0.72)';
    ctx.fillRect(0, cy - 30, VIEW_W, sub ? 64 : 48);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 28px system-ui, sans-serif';
    ctx.fillStyle = color;
    ctx.fillText(text, VIEW_W / 2, cy - 6);
    if (sub) {
      ctx.font = '600 14px system-ui, sans-serif';
      ctx.fillStyle = INK;
      ctx.fillText(sub, VIEW_W / 2, cy + 20);
    }
    ctx.restore();
  }

  function drawOverlay(g, now) {
    if (g.paused) return; // the DOM pause panel is shown
    if (g.countdown > 0) { banner(String(Math.ceil(g.countdown / 60)), null, INK); return; }
    if (g.phase === 'ready') banner('READY', g.level > 1 ? `LEVEL ${g.level}` : null);
    else if (g.phase === 'levelClear') banner('ROUND CLEAR', `LEVEL ${g.level + 1} NEXT`, ((now / 200) | 0) % 2 ? ACCENT : INK);
    else if (g.phase === 'gameOver') banner('GAME OVER', g.phaseTimer > 0 ? `SCORE ${g.score}` : `SCORE ${g.score}  ·  ${isTouch ? 'TAP' : 'PRESS ENTER'} TO CONTINUE`, '#ff5a4a');
  }

  function drawMuted() {
    ctx.save();
    ctx.fillStyle = '#ff5a8a';
    ctx.font = '700 9px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('MUTED', 8, 17 * TILE - 4);
    ctx.restore();
  }

  function drawStart(g, now) {
    ctx.save();
    // backdrop: night sky over dirt bands
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, '#1b1446'); grad.addColorStop(0.32, '#3a2a6e'); grad.addColorStop(0.33, '#4fbf5a');
    grad.addColorStop(0.34, '#e0a458'); grad.addColorStop(0.55, '#c0703c'); grad.addColorStop(0.75, '#8c4a2f'); grad.addColorStop(1, '#5e2f3b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // a winding tunnel
    ctx.strokeStyle = TUNNEL; ctx.lineWidth = 30; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(60, 190); ctx.lineTo(60, 300); ctx.lineTo(388, 300); ctx.lineTo(388, 470); ctx.lineTo(120, 470); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 46px system-ui, sans-serif';
    ctx.fillStyle = '#3b1d10';
    ctx.fillText('DIGGER DOO', VIEW_W / 2 + 3, 92 + 3);
    ctx.fillStyle = ACCENT;
    ctx.fillText('DIGGER DOO', VIEW_W / 2, 92);
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillStyle = INK;
    ctx.fillText('Tunnel deep. Puff the pests. Drop the boulders.', VIEW_W / 2, 128);
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.fillText(`HIGH SCORE ${g.high}`, VIEW_W / 2, 152);
    ctx.restore();
    // cast
    const cast = [
      ['DOO', 'our hero', 120, 300, 'doo'],
      ['GLOOP', 'jelly pest', 224, 300, 'gloop'],
      ['SIZZLER', 'breathes fire', 328, 300, 'sizzler'],
    ];
    const fake = { state: 'roam', dir: DOWN, id: 0, stage: 0 };
    for (const [name, role, x, y, kind] of cast) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1.4, 1.4);
      if (kind === 'doo') {
        drawDoo({ player: { x: 0, y: 0, dir: RIGHT, moving: true, digging: false }, phase: 'start' }, now);
      } else if (kind === 'gloop') drawGloop(fake, now); else drawSizzler(fake, now);
      ctx.restore();
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '800 13px system-ui, sans-serif';
      ctx.fillStyle = INK;
      ctx.fillText(name, x, y + 36);
      ctx.font = '500 11px system-ui, sans-serif';
      ctx.fillStyle = '#ffe2c4';
      ctx.fillText(role, x, y + 51);
      ctx.restore();
    }
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = INK;
    ctx.font = '600 13px system-ui, sans-serif';
    const lines = isTouch
      ? ['Drag and hold to dig  ·  Tap to pump', 'Second finger pumps while you steer']
      : ['Arrows / WASD to dig  ·  Space or X to pump', 'P pause  ·  M sound'];
    lines.forEach((l, i) => ctx.fillText(l, VIEW_W / 2, 392 + i * 20));
    if (((now / 500) | 0) % 2 === 0) {
      ctx.font = '800 20px system-ui, sans-serif';
      ctx.fillStyle = ACCENT;
      ctx.fillText(isTouch ? 'TAP TO START' : 'PRESS ENTER TO START', VIEW_W / 2, 520);
    }
    ctx.restore();
  }

  return { resize, draw, handleEvent, get recentClear() { return lastLevelClear; } };
}

export { COLS };
