import { BufferGeometry, Float32BufferAttribute, Mesh, PlaneGeometry, Points, Vector4, type Material, type Group, type Object3D, type Vector3 } from 'three';
import { cardGroup, type CardPrograms, type CardRow } from '@wildshard/sdk/looks/cardField';

/**
 * Fire, embers and smoke as declared rows (SHARD-PLATFORM SF72, effect rows): a shard declares its fires' sizes as data and
 * its fire's look as SF59 material graphs (`data/fireLook.ts`, G382), compiled before the world builds; `createFireFx`
 * places them on a few quads and points, animated on the GPU from the fires' clock: no CPU particles, no lights, ~4 draws
 * a fire. The billboards (flame tongues, glow, smoke, a lamp's halo) are placed on the SDK's card host
 * (`@wildshard/sdk/looks/cardField` cardGroup, G395); each graph turns its own quad to the camera.
 *
 * `FireFx.lights` is a uniform of up to four burning fires (xyz the flame, w the gain) a shard's own materials can read.
 */

/** One fire's scale (metres): the flame's height, the glow's radius, the smoke column's height, the ember count. */
export interface FireSize { readonly flame: number; readonly glow: number; readonly smoke: number; readonly embers: number; /** a thin pale wisp (a cookfire), not the dark plume */ readonly wisp?: boolean }

/** Scope-owned graph materials, compiled before constructing any fire geometry. */
export interface FireFxPrograms {
  readonly materials: Readonly<Record<'flame' | 'smoke' | 'wisp' | 'glow' | 'lampGlow' | 'embers' | 'pool', Material>>;
  /** Absolute seconds from the existing entered fire owner, not a new renderer clock. */
  readonly setTime: (seconds: number) => void;
}

export interface FireFx {
  /** Adds a fire's parts under `group` (shown when lit); `pool` drapes the warm disc on the ground: `at` is the group's world position. */
  addFire: (group: Group, size: FireSize, pool?: { at: Vector3; groundAt: (x: number, z: number) => number }) => Object3D[];
  /** A lamp's halo and its pool, no light; `ground(lx, lz)` is the ground under a point of `group`'s frame, relative to its origin. */
  addLampGlow: (group: Group, glow: number, ground: (lx: number, lz: number) => number) => void;
  /** Claims a firelight slot at `at`; the switch turns it on or off (`gain`: a lamp is a fraction of a fire). */
  fireLight: (at: Vector3) => (lit: boolean, gain?: number) => void;
  /** Frees every slot (a level build starts with none). */
  resetLights: () => void;
  /** Advances every fire's shared clock. */
  tick: (t: number) => void;
  /** Up to four burning fires: xyz the flame, w its gain (0 when out). */
  readonly lights: { value: Vector4[] };
  /** The shared quads, for the level scope to own (the materials are the look's). */
  readonly resources: readonly PlaneGeometry[];
  /** The ember geometries made so far (one per count). */
  geometries: () => BufferGeometry[];
}

/** Places one look of fire's compiled materials; each `addFire` adds ~4 draws over them. */
export function createFireFx(programs: FireFxPrograms, lights: { value: Vector4[] }): FireFx {
  const { flame, smoke, wisp: wispMaterial, glow, lampGlow, embers: emberMaterial, pool: poolMaterial } = programs.materials;
  const quad = new PlaneGeometry(1, 1); quad.translate(0, 0.5, 0);
  /** The wisp's quad: 16 rows, so its sway curls it rather than tilting it. */
  const wispQuad = new PlaneGeometry(1, 1, 1, 16); wispQuad.translate(0, 0.5, 0);
  const glowQuad = new PlaneGeometry(2, 2);
  /** the billboards' quads and materials, for the SDK card host (G395) */
  const quads = { flame: quad, wisp: wispQuad, glow: glowQuad }, cards = { flame, smoke, wisp: wispMaterial, glow, lampGlow };
  const cardPrograms: CardPrograms<keyof typeof cards, Material> = { material: (program) => cards[program] };
  const emberCache = new Map<number, BufferGeometry>();
  const embers = (n: number): BufferGeometry => {
    let g = emberCache.get(n);
    if (g === undefined) {
      g = new BufferGeometry(); const seeds = new Float32Array(n), pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) seeds[i] = (i * 0.618034) % 1;
      g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('aSeed', new Float32BufferAttribute(seeds, 1));
      emberCache.set(n, g);
    }
    return g;
  };
  const slots = { next: 0 };
  return {
    lights,
    resources: [quad, wispQuad, glowQuad],
    geometries: () => [...emberCache.values()],
    addFire: (group, size, at) => {
      const parts: Object3D[] = [];
      const add = (o: Object3D): void => { o.frustumCulled = false; group.add(o); parts.push(o); };
      const fh = size.flame, wisp = size.wisp === true, tongue = (sx: number, sy: number, off: readonly [number, number, number]): CardRow<keyof typeof cards> => ({ program: 'flame', quad: 'flame', scale: [fh * sx, fh * sy, 1], at: off });
      // the main and inner tongues, then two narrower side tongues, offset and phase-shifted by their place; the glow round them
      parts.push(...cardGroup(cardPrograms, { name: 'fire', order: 0, cards: [tongue(0.56, 1, [0, -0.1, 0]), tongue(0.34, 0.8, [0.05, -0.05, 0.05]), tongue(0.26, 0.62, [-fh * 0.11, -0.08, -0.07]), tongue(0.26, 0.72, [fh * 0.11, -0.08, 0.07]),
        { program: 'glow', quad: 'glow', scale: size.glow, at: [0, fh * 0.4, 0], order: 2 }] }, {}, { quads, into: group }).meshes);
      const sparks = new Points(embers(size.embers), emberMaterial); sparks.scale.setScalar(fh * 0.9); sparks.position.y = fh * 0.3; add(sparks);
      parts.push(...cardGroup(cardPrograms, { name: 'smoke', order: 1, cards: [{ program: wisp ? 'wisp' : 'smoke', quad: wisp ? 'wisp' : 'flame', scale: [size.smoke * (wisp ? 0.03 : 0.2), size.smoke, 1], at: [0, fh * 0.7, 0] }] }, {}, { quads, into: group }).meshes);
      if (at) {
        const r = Math.max(size.glow * 2.3, size.flame * 2.4), n = 16, g = new PlaneGeometry(r * 2, r * 2, n, n); g.rotateX(-Math.PI / 2);
        const p = g.getAttribute('position');
        for (let i = 0; i < p.count; i++) p.setY(i, at.groundAt(at.at.x + p.getX(i), at.at.z + p.getZ(i)) + 0.06 - at.at.y);
        add(new Mesh(g, poolMaterial));
      }
      return parts;
    },
    addLampGlow: (group, glowSize, ground) => {
      cardGroup(cardPrograms, { name: 'lamp', order: 2, cards: [{ program: 'lampGlow', quad: 'glow', scale: glowSize }] }, {}, { quads, into: group });
      const r = glowSize * 1.6, n = 10, g = new PlaneGeometry(r * 2, r * 2, n, n); g.rotateX(-Math.PI / 2);
      const p = g.getAttribute('position');
      for (let i = 0; i < p.count; i++) p.setY(i, ground(p.getX(i), p.getZ(i)) + 0.06);
      const disc = new Mesh(g, poolMaterial); disc.frustumCulled = false; group.add(disc);
    },
    fireLight: (at) => {
      const v = lights.value[slots.next % lights.value.length] ?? new Vector4(); slots.next++;
      v.set(at.x, at.y, at.z, 0);
      return (lit, gain = 1) => { v.w = lit ? gain : 0; };
    },
    resetLights: () => { slots.next = 0; for (const v of lights.value) v.w = 0; },
    tick: (t) => { programs.setTime(t); },
  };
}
