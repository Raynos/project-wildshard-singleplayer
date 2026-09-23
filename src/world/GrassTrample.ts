import * as THREE from 'three';
import { grassBaseHeightAt } from './GrassField';

/**
 * Grass that parts around movers and stays trampled (Nalati, `stealth-and-storms.md` → "Living grass").
 *
 *   import { trample, grassHeightAt } from './GrassTrample';
 *   trample.push(x, z, radius, strength?, vx?, vz?)   // every frame, for every mover (player, horse, wolves…)
 *   const stop = trample.track(animal.position, 0.6, 1, () => animal.alive)   // or once: pushed every frame for you,
 *                                                     // velocity from its last position; `stop()` to forget it
 *   grassHeightAt(x, z)                               // effective height (m) incl. trampling — stealth + AI
 *   trample.amountAt(x, z)                            // 0..1 how flattened (a fresh track is ~1)
 *
 * Two layers, both read by the painterly grass vertex shader:
 *  - **live movers**: up to 16 `vec4(x, z, radius, strength)` per frame (the nearest to the camera win) —
 *    blades bend away from the body at any distance in the grass ring, so a wolf is seen by the wave it pushes;
 *  - **the trample map**: a 256² RG8 DataTexture, 0.5 m texels (a 128 m window that follows the player,
 *    addressed toroidally by world position so it never scrolls; rows/columns entering the window are
 *    cleared). R = how flat, G = which way the blades lie. Pushes stamp into it at once; it recovers over
 *    `RECOVER` seconds and is uploaded at most 10×/s (only while anything is flat).
 *
 * `update(dt, playerPos)` is called once a frame by the painterly grass (before it draws), after the movers
 * have pushed; it uploads, decays and resets the live list. Push from your own update — order within a frame
 * does not matter, a push lands in the next draw either way.
 */

const SIZE = 256;
const TEXEL = 0.5;
const SPAN = SIZE * TEXEL;       // 128 m
/** seconds a fully flattened patch takes to stand back up (design: 20 s) */
export const RECOVER = 20;
export const MAX_MOVERS = 16;

export class GrassTrample {
  /** RG8: the lie vector × flatten amount, 0.5-biased (128, 128 = standing) — filters linearly, unlike an angle */
  readonly texture: THREE.DataTexture;
  readonly uniforms = {
    tTrample: { value: null as THREE.DataTexture | null },
    /** xz = window centre (m), z = window half-span (m), w = 1 / span */
    uTrampleWin: { value: new THREE.Vector4(0, 0, SPAN / 2, 1 / SPAN) },
    uMovers: { value: Array.from({ length: MAX_MOVERS }, () => new THREE.Vector4(0, 0, 0, 0)) },
    uMoverCount: { value: 0 },
  };

  private amount = new Float32Array(SIZE * SIZE);
  private angle = new Float32Array(SIZE * SIZE);
  private data = new Uint8Array(SIZE * SIZE * 2).fill(128);
  private ox = 0x7fffffff;  // window origin, texel units
  private oz = 0x7fffffff;
  private anyFlat = false;
  private dirty = false;
  private tick = 0;
  private live: { x: number; z: number; r: number; s: number; d: number }[] = [];
  private liveN = 0;
  private cx = 0;
  private cz = 0;
  private tracked: { p: { x: number; z: number }; r: number; s: number; on: (() => boolean) | undefined; px: number; pz: number }[] = [];

  constructor() {
    this.texture = new THREE.DataTexture(this.data, SIZE, SIZE, THREE.RGFormat, THREE.UnsignedByteType);
    this.texture.wrapS = this.texture.wrapT = THREE.RepeatWrapping;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;
    this.uniforms.tTrample.value = this.texture;
    for (let i = 0; i < MAX_MOVERS; i++) this.live.push({ x: 0, z: 0, r: 0, s: 0, d: 0 });
  }

  /**
   * A mover at (x, z) this frame: bends blades within ~`radius` m away from it and stamps the trample map.
   * `strength` 1 = a person / wolf, 1.5 = a horse. (vx, vz) = its velocity (m/s) — trampled blades lie the
   * way it went; standing still they lie outward.
   */
  push(x: number, z: number, radius: number, strength = 1, vx = 0, vz = 0): void {
    // live list: keep the MAX_MOVERS nearest the player (the camera)
    const d = (x - this.cx) ** 2 + (z - this.cz) ** 2;
    let slot = -1;
    if (this.liveN < MAX_MOVERS) slot = this.liveN++;
    else {
      let wd = d;
      for (let i = 0; i < MAX_MOVERS; i++) { const m = this.live[i]; if (m && m.d > wd) { wd = m.d; slot = i; } }
    }
    const m = this.live[slot];
    if (m) { m.x = x; m.z = z; m.r = radius; m.s = strength; m.d = d; }
    this.stamp(x, z, radius * 0.8, Math.min(1, strength), vx, vz);
  }

  /**
   * Push `pos` every frame from now on (an animal, the horse): its velocity comes from where it was last frame.
   * `active` (optional) gates it (a dead wolf, a stabled horse). Returns a function that stops tracking.
   */
  track(pos: { x: number; z: number }, radius: number, strength = 1, active?: () => boolean): () => void {
    const e = { p: pos, r: radius, s: strength, on: active, px: pos.x, pz: pos.z };
    this.tracked.push(e);
    return () => { const i = this.tracked.indexOf(e); if (i !== -1) this.tracked.splice(i, 1); };
  }

  /** 0..1 how flattened the grass is at (x, z) (0 outside the 128 m window) */
  amountAt(x: number, z: number): number {
    if (Math.abs(x - this.cx) > SPAN / 2 - 1 || Math.abs(z - this.cz) > SPAN / 2 - 1) return 0;
    const ix = Math.floor(x / TEXEL), iz = Math.floor(z / TEXEL);
    return this.amount[this.idx(ix, iz)] ?? 0;
  }

  update(dt: number, playerPos: { x: number; z: number }): void {
    this.cx = playerPos.x; this.cz = playerPos.z;
    this.scroll(playerPos.x, playerPos.z);
    const idt = dt > 0 ? 1 / dt : 0;
    for (const e of this.tracked) {
      const vx = (e.p.x - e.px) * idt, vz = (e.p.z - e.pz) * idt;
      e.px = e.p.x; e.pz = e.p.z;
      if (e.on && !e.on()) continue;
      if (vx * vx + vz * vz > 900) continue; // a teleport / respawn, not a stride
      this.push(e.p.x, e.p.z, e.r, e.s, vx, vz);
    }
    // live movers → uniforms
    const u = this.uniforms;
    for (let i = 0; i < MAX_MOVERS; i++) {
      const m = this.live[i], v = u.uMovers.value[i];
      if (!v) continue;
      if (m && i < this.liveN) v.set(m.x, m.z, m.r, m.s); else v.set(0, 0, 0, 0);
    }
    u.uMoverCount.value = this.liveN;
    this.liveN = 0;
    u.uTrampleWin.value.set(this.cx, this.cz, SPAN / 2, 1 / SPAN);
    // decay + upload at 10 Hz
    this.tick += dt;
    if (this.tick < 0.1) return;
    const step = this.tick / RECOVER;
    this.tick = 0;
    if (!this.anyFlat && !this.dirty) return;
    let any = false;
    const a = this.amount, g = this.angle, out = this.data;
    for (let i = 0; i < SIZE * SIZE; i++) {
      const v = a[i] ?? 0;
      if (v <= 0) { out[i * 2] = 128; out[i * 2 + 1] = 128; continue; }
      const nv = v - step;
      if (nv <= 0) { a[i] = 0; out[i * 2] = 128; out[i * 2 + 1] = 128; continue; }
      a[i] = nv; any = true;
      const ang = g[i] ?? 0;
      out[i * 2] = Math.round(127.5 + 127 * Math.cos(ang) * nv);
      out[i * 2 + 1] = Math.round(127.5 + 127 * Math.sin(ang) * nv);
    }
    this.anyFlat = any;
    this.dirty = false;
    this.texture.needsUpdate = true;
  }

  private idx(ix: number, iz: number): number {
    return (((iz % SIZE) + SIZE) % SIZE) * SIZE + (((ix % SIZE) + SIZE) % SIZE);
  }

  private stamp(x: number, z: number, r: number, s: number, vx: number, vz: number): void {
    if (Math.abs(x - this.cx) > SPAN / 2 - r - 1 || Math.abs(z - this.cz) > SPAN / 2 - r - 1) return;
    const moving = vx * vx + vz * vz > 0.25;
    const heading = Math.atan2(vz, vx);
    const i0 = Math.floor((x - r) / TEXEL), i1 = Math.floor((x + r) / TEXEL);
    const j0 = Math.floor((z - r) / TEXEL), j1 = Math.floor((z + r) / TEXEL);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = (i + 0.5) * TEXEL - x, pz = (j + 0.5) * TEXEL - z;
      const d = Math.hypot(px, pz);
      if (d > r) continue;
      const w = s * (1 - (d / r) ** 2) * (moving ? 1 : 0.35); // standing still presses a little, walking flattens
      const k = this.idx(i, j);
      const cur = this.amount[k] ?? 0;
      if (w <= cur * 0.9) continue;
      this.amount[k] = Math.max(cur, Math.min(1, w));
      const ang = moving ? heading + (px * vz - pz * vx > 0 ? -0.35 : 0.35) : Math.atan2(pz, px);
      this.angle[k] = ang;
      this.dirty = true; this.anyFlat = true;
    }
  }

  /** move the window with the player; clear rows / columns that enter it (they held the far side's stamps) */
  private scroll(px: number, pz: number): void {
    const nx = Math.floor(px / TEXEL) - SIZE / 2, nz = Math.floor(pz / TEXEL) - SIZE / 2;
    if (nx === this.ox && nz === this.oz) return;
    const first = this.ox === 0x7fffffff;
    const dx = nx - this.ox, dz = nz - this.oz;
    if (first || Math.abs(dx) >= SIZE || Math.abs(dz) >= SIZE) {
      this.amount.fill(0);
      this.dirty = true;
    } else {
      // columns entering: [ox+SIZE, nx+SIZE) when moving +x, [nx, ox) when moving −x
      const clearCol = (i: number) => { for (let j = 0; j < SIZE; j++) this.amount[this.idx(i, j)] = 0; };
      const clearRow = (j: number) => { for (let i = 0; i < SIZE; i++) this.amount[this.idx(i, j)] = 0; };
      if (dx > 0) for (let i = this.ox + SIZE; i < nx + SIZE; i++) clearCol(i);
      else for (let i = nx; i < this.ox; i++) clearCol(i);
      if (dz > 0) for (let j = this.oz + SIZE; j < nz + SIZE; j++) clearRow(j);
      else for (let j = nz; j < this.oz; j++) clearRow(j);
      if (dx !== 0 || dz !== 0) this.dirty = true;
    }
    this.ox = nx; this.oz = nz;
  }
}

/** the world's trample map (a singleton — movers anywhere push into it) */
export const trample = new GrassTrample();

/**
 * Effective grass height at (x, z) in metres, including trampling (a fresh track lays it to ~15 %).
 * The stealth `cover` and the wolves' "in grass ≥ 0.8 m" read this.
 */
export function grassHeightAt(x: number, z: number): number {
  return grassBaseHeightAt(x, z) * (1 - 0.85 * trample.amountAt(x, z));
}

/** GLSL for the grass vertex shader: uniforms + `vec2 trampleBend(vec2 p)` → bend vector (radians × dir) */
export const TRAMPLE_GLSL = /* glsl */`
uniform sampler2D tTrample;
uniform vec4 uTrampleWin;
uniform vec4 uMovers[${MAX_MOVERS}];
uniform int uMoverCount;
vec2 trampleBend( vec2 p ) {
  vec2 b = vec2( 0.0 );
  // persistent trample map (toroidal, world-addressed)
  vec2 rel = abs( p - uTrampleWin.xy );
  float inWin = 1.0 - smoothstep( uTrampleWin.z - 6.0, uTrampleWin.z - 1.0, max( rel.x, rel.y ) );
  if ( inWin > 0.0 ) {
    vec2 t = texture( tTrample, p * uTrampleWin.w ).rg * ( 255.0 / 127.0 ) - ( 127.5 / 127.0 );
    b += t * 1.3 * inWin;
  }
  // live movers: push blades away from the body
  for ( int i = 0; i < ${MAX_MOVERS}; i++ ) {
    if ( i >= uMoverCount ) break;
    vec4 m = uMovers[ i ];
    vec2 d = p - m.xy;
    float r = m.z * 1.6;
    float l2 = dot( d, d );
    if ( l2 < r * r ) {
      float l = sqrt( l2 ) + 1e-3;
      float f = 1.0 - l / r;
      b += d / l * f * f * 1.6 * m.w;
    }
  }
  return b;
}
`;
