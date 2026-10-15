/**
 * The bake page of bake-pine-painted.mjs: bundled on its own and run on a blank page in headless Chromium, it paints the
 * textures Pine's runtime used to paint on a canvas at every launch, and encodes each one.
 *   - the log ends' end grain (weathering speckle, sine-warped growth rings, checks and the bark rim, from the level's seed)
 *     and the lamps' soft glow (a white radial falloff: the lamp's colour is its material's);
 *   - the trophy wall's chalk atlas (runtime/compendium/trophyWall.ts): each outline once and each slot's name (and "???") in
 *     the hand font, white chalk as alpha over a warm chalk colour.
 * No game, no level, no shard runtime is loaded.
 */
import { Rng } from '@wildshard/engine/core/rng';
import { PINE_HOLLOW_COMPENDIUM } from '../compendium';

/** One encoded texture, as bake-pine-painted.mjs reads it back. */
export interface PaintedBake { readonly dataUrl: string; readonly width: number; readonly height: number }
/** The chalk atlas's layout in pixels ([x, y, w, h]): each outline's 256² cell and each label's 256 × 64 strip (by entry id, "???" for an unknown slot). */
export interface ChalkLayout { readonly size: readonly [number, number]; readonly outlines: Record<string, readonly number[]>; readonly labels: Record<string, readonly number[]> }

const CELL = 256, LABEL = 64, SIZE = [1024, 512] as const;

function canvas2d(size: number): { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  if (g === null) throw new Error('no 2d canvas context');
  return { canvas, g };
}

/** A log end's grain, 256². */
function endGrain(seed: number): HTMLCanvasElement {
  const { canvas, g } = canvas2d(256), rng = new Rng(seed + 31);
  g.fillStyle = '#9d8b6c'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 6000; i++) { g.fillStyle = rng.next() < 0.5 ? 'rgba(60,45,30,0.25)' : 'rgba(200,185,160,0.2)'; g.fillRect(rng.range(0, 256), rng.range(0, 256), 1 + rng.range(0, 2), 1 + rng.range(0, 2)); }
  for (let r = 4; r < 128; r += 3 + rng.range(0, 4)) {
    g.beginPath();
    for (let a = 0; a <= 64; a++) {
      const th = (a / 64) * Math.PI * 2, rr = r * (1 + 0.05 * Math.sin(th * 3 + r) + 0.03 * Math.sin(th * 7));
      const x = 128 + Math.cos(th) * rr, y = 128 + Math.sin(th) * rr;
      if (a > 0) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.closePath();
    g.strokeStyle = rng.next() < 0.5 ? 'rgba(70,50,30,0.5)' : 'rgba(110,85,55,0.35)';
    g.lineWidth = 0.8 + rng.range(0, 1.4);
    g.stroke();
  }
  g.strokeStyle = 'rgba(40,28,15,0.8)';
  for (let i = 0; i < 7; i++) { const th = rng.range(0, Math.PI * 2), l = rng.range(50, 122); g.lineWidth = 1 + rng.range(0, 2); g.beginPath(); g.moveTo(128 + Math.cos(th) * 8, 128 + Math.sin(th) * 8); g.lineTo(128 + Math.cos(th + 0.05) * l, 128 + Math.sin(th + 0.05) * l); g.stroke(); }
  g.strokeStyle = '#3d2c1c'; g.lineWidth = 9; g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.stroke();
  return canvas;
}

/** A lamp's glow, 128². */
function glow(): HTMLCanvasElement {
  const { canvas, g } = canvas2d(128), grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,255,255,0.45)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  return canvas;
}

function encode(canvas: HTMLCanvasElement, type: 'image/png' | 'image/webp', quality?: number): PaintedBake {
  return { dataUrl: canvas.toDataURL(type, quality), width: canvas.width, height: canvas.height };
}

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => { resolve(image); }; image.onerror = () => { reject(new Error('chalk atlas did not decode')); }; image.src = src; });
}

/** Paint every texture: `seed` the level's, `chalkAtlas` the outline atlas and `font` the hand font (data URLs). */
async function bakePinePainted(seed: number, chalkAtlas: string, font: string): Promise<{ textures: Record<string, PaintedBake>; chalk: ChalkLayout }> {
  const face = new FontFace('WS Hand', `url(${font}) format("woff2")`, { weight: '600' });
  document.fonts.add(await face.load());
  const img = await load(chalkAtlas), def = PINE_HOLLOW_COMPENDIUM, cells = def.skin.chalk?.cells;
  if (cells === undefined) throw new Error('Pine compendium has no chalk cells');
  const slots = def.trophies ?? [], outlines: Record<string, readonly number[]> = {}, labels: Record<string, readonly number[]> = {};
  const canvas = document.createElement('canvas');
  [canvas.width, canvas.height] = SIZE;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('no 2d canvas context');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  // the outlines along the top (four, then the fifth under the first), each drawn 240² at (8, 4) as the wall's cell had it
  for (const slot of slots) {
    if (outlines[slot.outline] !== undefined) continue;
    const n = Object.keys(outlines).length, x = (n % 4) * CELL, y = Math.floor(n / 4) * CELL, c = cells[slot.outline];
    if (c === undefined || n > 4) throw new Error(`no room or no chalk outline for ${slot.outline}`);
    ctx.drawImage(img, c.x * img.naturalWidth, c.y * img.naturalHeight, c.w * img.naturalWidth, c.h * img.naturalHeight, x + 8, y + 4, CELL - 16, CELL - 16);
    outlines[slot.outline] = [x, y, CELL, CELL];
  }
  // the labels in the free block right of the fifth outline: three columns of four
  const names = [...slots.map((slot) => {
    const entry = def.entries.find((e) => e.id === slot.entry);
    if (entry === undefined) throw new Error(`trophy slot ${slot.entry} has no entry`);
    return [slot.entry, entry.name.replace(/^The /, '')] as const;
  }), ['???', '???'] as const];
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '600 44px "WS Hand", "Bradley Hand", cursive';
  names.forEach(([key, text], i) => {
    const x = CELL + Math.floor(i / 4) * CELL, y = CELL + (i % 4) * LABEL;
    if (i >= 12) throw new Error('chalk labels overflow the atlas');
    ctx.fillText(text, x + CELL / 2, y + 26, CELL - 12);
    labels[key] = [x, y, CELL, LABEL];
  });
  // white chalk: luminance → alpha, over the chalk's colour
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height), d = data.data;
  for (let k = 0; k < d.length; k += 4) { const l = Math.max(d[k] ?? 0, d[k + 1] ?? 0, d[k + 2] ?? 0); d[k] = 214; d[k + 1] = 206; d[k + 2] = 190; d[k + 3] = l; }
  ctx.putImageData(data, 0, 0);
  return {
    textures: {
      endGrain: encode(endGrain(seed), 'image/webp', 0.92),
      glow: encode(glow(), 'image/png'),
      chalk: encode(canvas, 'image/webp', 0.9),
    },
    chalk: { size: SIZE, outlines, labels },
  };
}

Object.assign(window, { bakePinePainted });
