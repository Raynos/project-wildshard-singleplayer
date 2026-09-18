import * as THREE from 'three';
import { ItemPickup, type PickupTier } from './WeaponPickup';
import type { Interactable } from '../world/Cabin';
import type { Sky } from '../world/Sky';
import { WRECK } from '../chunks/driftwood-isle';

/**
 * IronSword — the iron sword as LOOT on Driftwood Isle ("the whole point of Project Wildshard is that you can find
 * equipment on the floor"): a big faceted display model of the iron sword (art/driftwood-fp-sword-iron.png — steel
 * blade with a bright bevelled edge and a darker fuller, dark iron cross guard, leather-wrapped grip, round pommel;
 * flat-shaded vertex colours, no textures) hovering ~1 m over the wreck's broken midships deck inside the item orb
 * (`WeaponPickup.ts` — the AR-15's floating bubble, reused unchanged), with a warm amber point light + a soft halo so
 * the glow reads from the cove beach, day or night.
 *
 * The weapon itself is the existing rig: `new Sword(world, targets, { blade: 'iron' })` (Sword.ts, 28 base damage),
 * registered with the kit manager as `'sword-iron'` (Weapons.ts `extras`). This file only builds the pickup.
 *
 *   const drop = new IronSwordPickup({ scene, sky, position: ironSwordSite(wreck) });   // floor point = the deck
 *   interactables.push(drop.interactable);                       // "[E] Take iron sword" within `radius` (the door / harvest prompt path)
 *   drop.onPickup = () => { weapons.unlock('sword-iron'); weapons.select('sword-iron'); hud.toast('Iron sword acquired · 1/2 to switch, Q to swap'); audio.hitMarker(); };
 *   game.onUpdate((dt, t) => drop.update(dt, t, game.renderer, game.camera, player.position));   // the player POSITION
 *                                                                // makes it walk-to-pick-me-up: feet within TAKE_R m of the orb → take()
 *   `?weapon=iron` (dev): weapons.unlock('sword-iron'); weapons.select('sword-iron', true); drop.dispose();
 *
 * `ironSwordSite(wreck)` = the world point on the heeled deck at the broken midships planks (Wreck.ts: local
 * z = +2.4 toward the stern, a hair to port so the bubble clears the mainmast). The deck is ~1.2–1.7 m above the cove
 * sand: one jump from the low (starboard) rail puts you on it. Falls back to the sand beside the hull if the wreck has
 * no deck there (a future hull change) — `ironSwordSite` never returns undefined.
 */

export interface IronSwordPickupOptions {
  scene: THREE.Scene;
  sky: Sky;
  /** the floor point under the orb (the deck) */
  position: THREE.Vector3;
  tier?: PickupTier;
  prompt?: string;
  /** "[E]" prompt radius (m from the eye; default 2.6 — the deck is a step up from the sand) */
  radius?: number;
  /** walk-in radius (m from the player's feet to the orb's floor point; 0 = E only) */
  takeRadius?: number;
}

/** steel: bevelled edges bright, flats mid, the fuller dark; iron guard / pommel; leather grip + wrap */
const lin = (hex: number) => new THREE.Color(hex).convertSRGBToLinear();
const C = {
  edge: lin(0xf4f6fa), flat: lin(0xbfc5cf), fuller: lin(0x8f96a3), tip: lin(0xe6e9ef),
  iron: lin(0x3a3c42), ironLight: lin(0x585b63), ironDark: lin(0x25272c),
  grip: lin(0x4a2d1a), wrap: lin(0x6e4629), pommelCap: lin(0x6b6e77), gem: lin(0xd94b3a),
};
const WARM = 0xffb257;
const TAKE_R = 1.15;               // m, feet to the orb's floor point (the orb is 0.46 m in radius, hovering 0.7 m up)
const TAKE_DY = 1.6;               // m, |feet y − floor y| — no taking it from the sand under the hull

/** per-FACE coloured triangles: each quad between ring r and r+1, segment i, takes `segCol[i]` (with a tiny per-face jitter) */
function loftFaces(rings: THREE.Vector3[][], segCol: THREE.Color[], jitter = 0.05, seed = 7): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [];
  let h = seed * 7919;
  const push = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, k: THREE.Color) => {
    h = (Math.imul(h, 1103515245) + 12345) & 0x7fffffff;
    const j = 1 + ((h / 0x7fffffff) - 0.5) * 2 * jitter;
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < 3; i++) col.push(k.r * j, k.g * j, k.b * j);
  };
  for (let r = 0; r < rings.length - 1; r++) {
    const a = rings[r], b = rings[r + 1], n = a.length;
    for (let i = 0; i < n; i++) {
      const a0 = a[i], a1 = a[(i + 1) % n], b0 = b[i], b1 = b[(i + 1) % n], k = segCol[i % segCol.length];
      push(a0, a1, b1, k);
      push(a0, b1, b0, k);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
/** a flat-shaded, per-face-coloured copy of a three primitive */
function facet(g: THREE.BufferGeometry, k: THREE.Color, jitter = 0.06, seed = 3): THREE.BufferGeometry {
  const ni = g.index ? g.toNonIndexed() : g;
  for (const a of Object.keys(ni.attributes)) if (a !== 'position') ni.deleteAttribute(a);
  ni.computeVertexNormals();
  const n = ni.getAttribute('position').count, c = new Float32Array(n * 3);
  let h = seed * 7919;
  for (let f = 0; f < n; f += 3) {
    h = (Math.imul(h, 1103515245) + 12345) & 0x7fffffff;
    const j = 1 + ((h / 0x7fffffff) - 0.5) * 2 * jitter;
    for (let v = f; v < f + 3; v++) { c[v * 3] = k.r * j; c[v * 3 + 1] = k.g * j; c[v * 3 + 2] = k.b * j; }
  }
  ni.setAttribute('color', new THREE.BufferAttribute(c, 3));
  return ni;
}
/** blade section at height y: 10 points — edges at ±w, flats at ±t, the fuller a little inset either side of the spine */
function bladeSection(y: number, w: number, t: number, fuller = 0.78): THREE.Vector3[] {
  const fw = w * 0.2, ft = t * fuller, sw = w * 0.58;
  return [
    new THREE.Vector3(w, y, 0), new THREE.Vector3(sw, y, t), new THREE.Vector3(fw, y, ft), new THREE.Vector3(-fw, y, ft), new THREE.Vector3(-sw, y, t),
    new THREE.Vector3(-w, y, 0), new THREE.Vector3(-sw, y, -t), new THREE.Vector3(-fw, y, -ft), new THREE.Vector3(fw, y, -ft), new THREE.Vector3(sw, y, -t),
  ];
}
const octagon = (y: number, r: number, rot = 0) => { const o: THREE.Vector3[] = []; for (let i = 0; i < 8; i++) { const a = rot + (i / 8) * Math.PI * 2; o.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)); } return o; };
const merge = (parts: THREE.BufferGeometry[]): THREE.BufferGeometry => {
  const pos: number[] = [], col: number[] = [], nor: number[] = [];
  for (const p of parts) { pos.push(...(p.getAttribute('position').array as Float32Array)); col.push(...(p.getAttribute('color').array as Float32Array)); nor.push(...(p.getAttribute('normal').array as Float32Array)); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
};

/**
 * The big iron sword (model space: origin at the middle of the grip, +Y up the blade, X across the edges): ~1.22 m
 * pommel to tip — a longsword. Two meshes: steel (metallic) and the rest (guard, grip, pommel). Materials go through
 * `sky.setupMaterial` (they are lit world objects, unlike the viewmodel's).
 */
export function buildIronSwordDisplay(sky: Sky): THREE.Group {
  const g = new THREE.Group();
  // ── blade: 0.92 m, wide at the ricasso, a gentle taper, then a 10 cm point ──
  const guardY = 0.16, y0 = guardY + 0.02, L = 0.92;
  const w = (f: number) => 0.052 * (1 - f * 0.42), t = (f: number) => 0.011 * (1 - f * 0.3);
  const rings: THREE.Vector3[][] = [];
  for (const f of [0, 0.18, 0.38, 0.58, 0.76, 0.88]) rings.push(bladeSection(y0 + L * f, w(f), t(f)));
  rings.push(bladeSection(y0 + L * 0.94, w(0.88) * 0.66, t(0.88) * 0.8, 0.9));
  rings.push(bladeSection(y0 + L * 0.985, w(0.88) * 0.22, t(0.88) * 0.45, 1));
  const tip = new THREE.Vector3(0, y0 + L, 0);
  rings.push(rings[0].map(() => tip.clone()));
  const steelCols = [C.edge, C.flat, C.fuller, C.flat, C.edge, C.edge, C.flat, C.fuller, C.flat, C.edge];
  const blade = loftFaces(rings, steelCols, 0.035, 11);
  // ricasso cap over the guard (the blade's base face)
  const base = rings[0], capPos: number[] = [], capCol: number[] = [];
  for (let i = 0; i < base.length; i++) { const a = base[i], b = base[(i + 1) % base.length]; capPos.push(0, y0, 0, b.x, b.y, b.z, a.x, a.y, a.z); for (let k = 0; k < 3; k++) capCol.push(C.flat.r, C.flat.g, C.flat.b); }
  const cap = new THREE.BufferGeometry(); cap.setAttribute('position', new THREE.Float32BufferAttribute(capPos, 3)); cap.setAttribute('color', new THREE.Float32BufferAttribute(capCol, 3)); cap.computeVertexNormals();
  const steel = new THREE.MeshStandardMaterial({ flatShading: true, vertexColors: true, roughness: 0.32, metalness: 0.88, envMapIntensity: 1.1 });
  steel.name = 'iron-sword-steel';
  sky.setupMaterial(steel);
  const bladeMesh = new THREE.Mesh(merge([blade, cap]), steel);
  bladeMesh.castShadow = true; bladeMesh.receiveShadow = true;
  g.add(bladeMesh);

  // ── guard: a dark iron cross, thick at the centre block, the arms swept a little toward the blade, knobbed ends ──
  const parts: THREE.BufferGeometry[] = [];
  const armL = 0.17;
  for (const s of [-1, 1]) {
    const arm = new THREE.BoxGeometry(armL, 0.034, 0.052, 3, 1, 1);
    const p = arm.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i); const f = (x + armL / 2) / armL; p.setY(i, p.getY(i) * (1 - f * 0.25) + f * 0.028); p.setZ(i, p.getZ(i) * (1 - f * 0.3)); } // tapers and lifts toward the tip
    arm.translate(s * (armL / 2 + 0.04), guardY, 0);
    if (s < 0) arm.scale(-1, 1, 1);
    parts.push(facet(arm, C.iron, 0.07, 21 + s));
    parts.push(facet(new THREE.SphereGeometry(0.03, 6, 4).translate(s * (armL + 0.05), guardY + 0.026, 0), C.ironLight, 0.06, 31 + s));
  }
  parts.push(facet(new THREE.BoxGeometry(0.09, 0.062, 0.066).translate(0, guardY, 0), C.ironDark, 0.05, 41));
  parts.push(facet(new THREE.OctahedronGeometry(0.02, 0).translate(0, guardY, 0.036), C.gem, 0.03, 42)); // a garnet set in the block

  // ── grip: leather core with a spiral of wrap ridges (alternating ring radii, alternating colours) ──
  const gripTop = guardY - 0.031, gripLen = 0.27, ridges = 9;
  const gr: THREE.Vector3[][] = []; const gc: THREE.Color[] = [];
  for (let i = 0; i <= ridges; i++) { const y = gripTop - (i / ridges) * gripLen; gr.push(octagon(y, i % 2 ? 0.0245 : 0.021, i * 0.2)); }
  for (let i = 0; i < 8; i++) gc.push(i % 2 ? C.grip : C.wrap);
  parts.push(loftFaces(gr, gc, 0.07, 51));
  // ── pommel: a faceted wheel on a short neck ──
  const neckY = gripTop - gripLen;
  parts.push(facet(new THREE.CylinderGeometry(0.02, 0.026, 0.03, 8).translate(0, neckY - 0.014, 0), C.ironLight, 0.05, 61));
  parts.push(facet(new THREE.SphereGeometry(0.048, 7, 5).scale(1, 0.85, 0.72).translate(0, neckY - 0.06, 0), C.iron, 0.07, 62));
  parts.push(facet(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 8).rotateX(Math.PI / 2).translate(0, neckY - 0.06, 0.03), C.pommelCap, 0.04, 63));
  const iron = new THREE.MeshStandardMaterial({ flatShading: true, vertexColors: true, roughness: 0.62, metalness: 0.45, envMapIntensity: 0.7 });
  iron.name = 'iron-sword-fittings';
  sky.setupMaterial(iron);
  const fittings = new THREE.Mesh(merge(parts), iron);
  fittings.castShadow = true; fittings.receiveShadow = true;
  g.add(fittings);
  // centre the model on the orb: the orb's item origin is its middle; the sword's middle is ~0.45 m up from the grip
  bladeMesh.position.y = fittings.position.y = -0.46;
  return g;
}

/** a soft warm halo (additive sprite) so the glow reads from far off — a radial texture drawn once */
let haloTex: THREE.CanvasTexture | null = null;
function makeHalo(): THREE.CanvasTexture {
  const S = 128, cvs = document.createElement('canvas'); cvs.width = cvs.height = S;
  const ctx = cvs.getContext('2d')!;
  const gr = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(cvs); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** the world floor point for the pickup: the wreck's heeled deck at the broken midships planks, else the sand beside the hull */
export function ironSwordSite(wreck: { floorHeightAt(x: number, z: number): number | undefined }, heightAt: (x: number, z: number) => number): THREE.Vector3 {
  const h = WRECK.heading, cs = Math.cos(h), sn = Math.sin(h);
  // hull frame (Wreck.ts): local x = starboard, z = stern; world = R_y(heading) · local
  const lx = -0.35, lz = 2.4;
  const x = WRECK.x + lx * cs + lz * sn, z = WRECK.z - lx * sn + lz * cs;
  const deck = wreck.floorHeightAt(x, z);
  if (deck !== undefined) return new THREE.Vector3(x, deck, z);
  const sx = WRECK.x + 4.2 * cs, sz = WRECK.z - 4.2 * sn; // starboard side, on the sand
  return new THREE.Vector3(sx, heightAt(sx, sz), sz);
}

export class IronSwordPickup {
  readonly pickup: ItemPickup;
  readonly interactable: Interactable;
  private light: THREE.PointLight;
  private halo: THREE.Sprite;
  private haloMat: THREE.SpriteMaterial;
  private floor: THREE.Vector3;
  private takeRadius: number;
  private scene: THREE.Scene;
  private phase = Math.random() * 7;
  private gone = false;

  constructor(opts: IronSwordPickupOptions) {
    this.scene = opts.scene;
    this.floor = opts.position.clone();
    this.takeRadius = opts.takeRadius ?? TAKE_R;
    this.pickup = new ItemPickup({ scene: opts.scene, item: buildIronSwordDisplay(opts.sky), position: opts.position, tier: opts.tier ?? 'common', prompt: opts.prompt ?? 'Take iron sword', radius: opts.radius ?? 2.6, scale: 1, tilt: THREE.MathUtils.degToRad(24) });
    this.interactable = this.pickup.interactable;
    // the warm glow: an amber point light over the deck (the orb's own is a short cyan one) and a big soft halo
    this.light = new THREE.PointLight(WARM, 18, 11, 1.6);
    this.light.position.set(opts.position.x, opts.position.y + 1.3, opts.position.z);
    haloTex ??= makeHalo();
    this.haloMat = new THREE.SpriteMaterial({ map: haloTex, color: WARM, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false });
    this.halo = new THREE.Sprite(this.haloMat);
    this.halo.position.set(opts.position.x, opts.position.y + 0.75, opts.position.z);
    this.halo.scale.setScalar(3.2);
    this.halo.renderOrder = 19;
    opts.scene.add(this.light, this.halo);
  }

  get onPickup() { return this.pickup.onPickup; }
  set onPickup(fn: (() => void) | undefined) { this.pickup.onPickup = fn; }
  get taken() { return this.pickup.taken; }
  /** pick it up now (E / walk-in): the orb bursts, `onPickup` fires; a no-op the second time */
  take() { this.pickup.take(); }

  dispose() {
    this.pickup.dispose();
    this.removeGlow();
  }
  private removeGlow() {
    if (this.gone) return;
    this.gone = true;
    this.scene.remove(this.light, this.halo);
    this.haloMat.dispose();
  }

  /** `playerPos` = the player's feet: inside `takeRadius` of the floor point (and on its level) the sword is taken */
  update(dt: number, t: number, renderer?: THREE.WebGLRenderer, camera?: THREE.PerspectiveCamera, playerPos?: THREE.Vector3) {
    this.pickup.update(dt, t, renderer, camera);
    if (!this.pickup.taken) {
      if (playerPos && this.takeRadius > 0) {
        const dx = playerPos.x - this.floor.x, dz = playerPos.z - this.floor.z;
        if (dx * dx + dz * dz < this.takeRadius * this.takeRadius && Math.abs(playerPos.y - this.floor.y) < TAKE_DY) this.take();
      }
      const tt = t + this.phase;
      const flick = 1 + Math.sin(tt * 2.2) * 0.1 + Math.sin(tt * 7.3) * 0.05;
      this.light.intensity = 18 * flick;
      this.haloMat.opacity = 0.5 * flick;
      return;
    }
    if (this.gone) return;
    // the burst: the glow flares and dies with the orb (ItemPickup's BURST_TIME is ~0.3 s)
    this.light.intensity = Math.max(0, this.light.intensity - dt * 120);
    this.haloMat.opacity = Math.max(0, this.haloMat.opacity - dt * 2.5);
    this.halo.scale.addScalar(dt * 6);
    if (this.haloMat.opacity <= 0) this.removeGlow();
  }
}
