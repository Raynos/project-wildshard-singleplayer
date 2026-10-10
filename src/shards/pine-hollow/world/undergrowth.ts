import { SEED } from '@wildshard/engine/core/config';
import { Rng } from '@wildshard/engine/core/rng';
import type { Forest } from '@wildshard/engine/world/forest/Forest';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { GroundCover, type GroundCoverDraw, type GroundCoverKind } from '@wildshard/sdk/looks/groundCover';
import { UNDER_SHAPES } from './undergrowthKit';
import { UNDER_EDITS, UNDER_VERTEX_EDITS } from '../data/forestLook';
import { UNDER_LOOK } from '../data/undergrowthLook';

/**
 * Forest-floor undergrowth: ferns, low round-leaf shrubs and needle/twig litter — the field (world): where every copy
 * goes, each kind's geometry, texture and material. Each kind is a model (src/shards/pine-hollow/models/fern.ts …) that
 * `place` draws instanced into `group` and culls per 32 m cell round the forest's view (E315: `kinds`, `groundCoverMatrix`,
 * `groundCoverCells`; src/shards/pine-hollow/world/drawnModels.ts).
 *
 *   const under = new Undergrowth(sky, forest).build();
 *   scene.add(under.group);
 *   game.onUpdate((dt) => under.update(dt, player.position));   // only feeds the viewer position uniform
 *
 * Everything is placed once, deterministically (Rng), chunk-wide:
 *  - ~6000 ferns (9 arched frond quads in a rosette, procedural pinnate-leaf alpha texture) in
 *    shaded forest floor, along trail verges (5.5–10 m from the centreline) and around the pond:
 *    not on rock / cabin pads / inside trunks / in the water. Cast + receive shadows.
 *  - ~1500 shrubs (4 crossed quads, round-leaf texture) at floor/grass edges.
 *  - ~5000 twig/needle-litter quads and ~3000 dark pebble clusters lying flat under the trees.
 *  - ~3000 moss patches (flat, soft mottled alpha) hugging the base of trunks.
 *  - ~1500 reed / sedge clumps (tall thin blades, 0.8–1.2 m) on the pond shore and in the shallows.
 * Six draw calls (+ fern & shrub shadow passes). Instances scale to 0 beyond `fadeFar` metres
 * in the vertex shader so distant ones cost nothing in the fragment stage.
 *
 * The field is the SDK's ground cover (@wildshard/sdk/looks/groundCover): one program for every kind, the distance fade
 * and the wind; its look is data/undergrowthLook.ts, its edits data/forestLook.ts; the textures are painted here.
 *
 * Public: `group` (the kinds' placed meshes go in it), `kinds` (each kind's parts), `layout`, `counts`, `view`.
 */

/** one kind as the field draws it: its geometry, its material (and its shadow's) — a model's parts (E315) */
export type UnderKindDraw = GroundCoverDraw;
/** one of the field's six kinds */
export type UnderKind = GroundCoverKind;

/** Pine Hollow's forest floor: the SDK ground cover with its look, shapes, edits and painted textures. */
export class Undergrowth extends GroundCover {
  /** the field over `forest`, lit by `sky` */
  constructor(sky: Sky, forest: Forest) {
    super({
      sky, forest, look: UNDER_LOOK, shapes: UNDER_SHAPES, edits: { lit: UNDER_EDITS, vertex: UNDER_VERTEX_EDITS },
      paint: { ferns: makeFernTexture, shrubs: makeShrubTexture, litter: makeLitterTexture, stones: makeStoneTexture, moss: makeMossTexture, reeds: makeReedTexture },
    });
  }
}

// ------------------------------------------------------------------ textures

function ctx2d(c: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = c.getContext('2d');
  if (!g) throw new Error('[undergrowth] no 2d canvas context');
  return g;
}

/** Pinnate fern frond: base at the bottom, tip at the top. */
function makeFernTexture() {
  const W = 512, H = 1024;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = ctx2d(c);
  g.scale(2, 2);
  const rng = new Rng(SEED + 701);
  const stemX = (t: number) => 128 + Math.sin(t * 2.2) * 6;
  const stemY = (t: number) => 512 - 6 - t * (512 - 18);
  const pairs = 19;
  for (let i = 0; i < pairs; i++) {
    const t = (i + 0.5) / pairs;
    // pinna length peaks around 30 % up the frond, vanishes at the tip
    const lenF = Math.sin(Math.min(1, t * 1.15) * Math.PI) ** 0.6 * (1 - t * 0.35);
    const len = 12 + lenF * 100;
    const wid = 5 + lenF * 8;
    for (const side of [-1, 1]) {
      const bx = stemX(t), by = stemY(t) + side * 3;
      const ang = side * (0.62 - t * 0.25) + rng.range(-0.08, 0.08); // sweep upward
      drawPinna(g, bx, by, ang * side, len, wid, side, t, rng);
    }
  }
  // stem
  g.strokeStyle = 'rgb(88,96,42)'; g.lineWidth = 3.2; g.lineCap = 'round';
  g.beginPath(); g.moveTo(stemX(0), stemY(0));
  for (let i = 1; i <= 20; i++) { const t = i / 20; g.lineTo(stemX(t), stemY(t)); }
  g.stroke();
  return c;
}

function drawPinna(g: CanvasRenderingContext2D, bx: number, by: number, ang: number, len: number, wid: number, side: number, t: number, rng: Rng) {
  // axis direction: outward (side) and slightly upward
  const dx = side * Math.cos(ang), dy = -Math.sin(ang) * 0.9;
  const nx = -dy, ny = dx;
  const steps = 26;
  const left: [number, number][] = [], right: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const s = i / steps;
    const w = wid * Math.sin(Math.min(1, s * 1.1) * Math.PI) ** 0.55 * (1 - s * 0.15);
    const serr = (i % 2 ? 0.7 : 1.0);  // lobed pinnule edge
    const ax = bx + dx * len * s, ay = by + dy * len * s;
    left.push([ax + nx * w * serr, ay + ny * w * serr]);
    right.push([ax - nx * w * serr, ay - ny * w * serr]);
  }
  const hue = rng.range(-1, 1);
  const grad = g.createLinearGradient(bx, by, bx + dx * len, by + dy * len);
  grad.addColorStop(0, `rgb(${52 + hue * 6},${82 + hue * 8},34)`);
  grad.addColorStop(1, `rgb(${78 + hue * 10 + t * 26},${116 + hue * 10 + t * 18},${46 + hue * 6})`);
  g.fillStyle = grad;
  g.beginPath();
  left.forEach(([lx, ly], i) => { if (i === 0) g.moveTo(lx, ly); else g.lineTo(lx, ly); });
  for (let i = right.length - 1; i >= 0; i--) { const r = right[i]; if (r) g.lineTo(r[0], r[1]); }
  g.closePath(); g.fill();
  // pinna midrib
  g.strokeStyle = 'rgba(150,170,80,0.55)'; g.lineWidth = 1.1;
  g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + dx * len * 0.95, by + dy * len * 0.95); g.stroke();
}

/** Round-leaf shrub: twigs from the bottom with ~45 leaves. */
function makeShrubTexture() {
  const W = 512, H = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = ctx2d(c);
  const rng = new Rng(SEED + 702);
  const twigs = 5;
  const leafSpots: [number, number, number][] = [];
  for (let t = 0; t < twigs; t++) {
    const ang = -Math.PI / 2 + (t - (twigs - 1) / 2) * 0.42 + rng.range(-0.1, 0.1);
    let x = W / 2 + rng.range(-20, 20), y = H - 10;
    g.strokeStyle = 'rgb(78,62,40)'; g.lineWidth = 3.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y);
    const segs = 6;
    for (let s = 0; s < segs; s++) {
      const a = ang + rng.range(-0.25, 0.25) + (s / segs) * (t - 2) * 0.2;
      x += Math.cos(a) * 60; y += Math.sin(a) * 60;
      g.lineTo(x, y);
      if (s > 0) for (let l = 0; l < 4; l++) leafSpots.push([x + rng.range(-34, 34), y + rng.range(-28, 28), rng.range(12, 22)]);
    }
    g.stroke();
  }
  for (const [x, y, r] of leafSpots) {
    const hue = rng.range(-1, 1);
    const light = rng.range(0, 1);
    g.fillStyle = `rgb(${70 + hue * 10 + light * 40},${104 + hue * 8 + light * 44},${38 + hue * 6 + light * 10})`;
    g.beginPath(); g.ellipse(x, y, r, r * rng.range(0.75, 1), rng.range(0, Math.PI), 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(170,190,90,0.4)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y + r * 0.8); g.lineTo(x, y - r * 0.8); g.stroke();
  }
  return c;
}

/** Dark pebbles: a scatter of shaded grey ellipses with a light rim. */
function makeStoneTexture() {
  const W = 256, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = ctx2d(c);
  const rng = new Rng(SEED + 704);
  for (let i = 0; i < 26; i++) {
    const x = rng.range(24, W - 24), y = rng.range(24, H - 24), rx = rng.range(7, 16), ry = rx * rng.range(0.6, 0.9), a = rng.range(0, Math.PI);
    const v = rng.range(0, 1);
    const grad = g.createRadialGradient(x - rx * 0.3, y - ry * 0.4, 1, x, y, rx);
    grad.addColorStop(0, `rgb(${96 + v * 40},${94 + v * 38},${90 + v * 34})`);
    grad.addColorStop(1, `rgb(${34 + v * 14},${33 + v * 12},${32 + v * 10})`);
    g.fillStyle = grad;
    g.beginPath(); g.ellipse(x, y, rx, ry, a, 0, Math.PI * 2); g.fill();
  }
  return c;
}

/** Moss: a velvety stipple of tiny dark-green tufts, dense in the middle, ragged at the edge. */
function makeMossTexture() {
  const S = 256;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = ctx2d(c);
  const rng = new Rng(SEED + 705);
  // base cushion
  for (let i = 0; i < 40; i++) {
    const ang = rng.range(0, Math.PI * 2), rad = rng.next() ** 0.8 * S * 0.28;
    const x = S / 2 + Math.cos(ang) * rad, y = S / 2 + Math.sin(ang) * rad * 0.85, r = rng.range(10, 26);
    const v = rng.range(0, 1);
    g.fillStyle = `rgb(${30 + v * 16},${52 + v * 22},${18 + v * 8})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  // tufts: dense in the middle, thinning outwards, brighter specks on top
  for (let i = 0; i < 3200; i++) {
    const ang = rng.range(0, Math.PI * 2), rad = rng.next() ** 0.55 * S * 0.47;
    const x = S / 2 + Math.cos(ang) * rad, y = S / 2 + Math.sin(ang) * rad * 0.85, r = rng.range(1.2, 3.6);
    const v = rng.range(0, 1), bright = rng.next() < 0.18;
    g.fillStyle = bright ? `rgb(${92 + v * 30},${122 + v * 30},${44 + v * 10})` : `rgb(${34 + v * 26},${58 + v * 34},${20 + v * 10})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  return c;
}

/** Reed blades: a few tall, very thin, slightly bent blades with brown seed heads. */
function makeReedTexture() {
  const W = 128, H = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = ctx2d(c);
  const rng = new Rng(SEED + 706);
  g.lineCap = 'round';
  for (let b = 0; b < 7; b++) {
    const x0 = 14 + (b / 6) * 100 + rng.range(-6, 6), top = rng.range(20, 110), bendX = rng.range(-22, 22);
    const v = rng.range(0, 1);
    g.strokeStyle = `rgb(${96 + v * 40},${120 + v * 30},${40 + v * 16})`;
    g.lineWidth = rng.range(3.5, 5.5);
    g.beginPath(); g.moveTo(x0, H); g.quadraticCurveTo(x0 + bendX * 0.4, (H + top) / 2, x0 + bendX, top); g.stroke();
    if (b % 3 === 0) {  // seed head
      g.fillStyle = `rgb(${110 + v * 30},${70 + v * 20},36)`;
      g.beginPath(); g.ellipse(x0 + bendX, top + 6, 4.5, 16, bendX * 0.01, 0, Math.PI * 2); g.fill();
    }
  }
  return c;
}

/** Fallen needles, twigs and a few leaves on a transparent background. */
function makeLitterTexture() {
  const W = 512, H = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = ctx2d(c);
  const rng = new Rng(SEED + 703);
  g.lineCap = 'round';
  for (let i = 0; i < 220; i++) {
    const x = rng.range(30, W - 30), y = rng.range(30, H - 30), a = rng.range(0, Math.PI), l = rng.range(30, 70);
    const hue = rng.range(0, 1);
    g.strokeStyle = `rgba(${74 + hue * 42},${50 + hue * 24},${26 + hue * 10},1.0)`;
    g.lineWidth = rng.range(2.5, 4.2);
    g.beginPath(); g.moveTo(x - Math.cos(a) * l / 2, y - Math.sin(a) * l / 2); g.lineTo(x + Math.cos(a) * l / 2, y + Math.sin(a) * l / 2); g.stroke();
  }
  for (let i = 0; i < 14; i++) {
    const x = rng.range(40, W - 40), y = rng.range(40, H - 40), a = rng.range(0, Math.PI), l = rng.range(60, 170);
    g.strokeStyle = `rgb(${62 + rng.range(0, 30)},${46 + rng.range(0, 20)},28)`;
    g.lineWidth = rng.range(5, 9);
    g.beginPath(); g.moveTo(x - Math.cos(a) * l / 2, y - Math.sin(a) * l / 2);
    g.lineTo(x + rng.range(-10, 10), y + rng.range(-10, 10)); g.lineTo(x + Math.cos(a) * l / 2, y + Math.sin(a) * l / 2); g.stroke();
  }
  for (let i = 0; i < 14; i++) {
    const x = rng.range(30, W - 30), y = rng.range(30, H - 30);
    g.fillStyle = `rgb(${100 + rng.range(0, 40)},${68 + rng.range(0, 24)},36)`;
    g.beginPath(); g.ellipse(x, y, rng.range(9, 15), rng.range(5, 8), rng.range(0, Math.PI), 0, Math.PI * 2); g.fill();
  }
  return c;
}
