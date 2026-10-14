import { Mesh, PlaneGeometry, Vector4, type BufferGeometry, type Group, type Material, type Object3D, type Vector3 } from 'three';
import { cardGroup, type CardPrograms, type CardRow } from '@wildshard/sdk/looks/cardField';
import { effectField } from '@wildshard/sdk/looks/effectField';
import { ownLookMaterials } from '../runtime/looks/bakedGround';
import type source from '../runtime/source';

/**
 * Fire, embers and smoke as declared rows (SHARD-PLATFORM SF72, effect rows): the fires' sizes are data and the fire's look
 * SF59 material graphs (`data/fireLook.ts`, G382), compiled by `prepareFireFx` before the world builds; `addFire` places
 * them on a few quads and points, animated on the GPU from the fires' clock: no CPU particles, no lights, ~4 draws a fire.
 * The billboards (flame tongues, glow, smoke, a lamp's halo) stand on the SDK's card host (`@wildshard/sdk/looks/cardField`
 * cardGroup, G395), each graph turning its own quad to the camera; the embers are a seeded point field
 * (`@wildshard/sdk/looks/effectField`) their graph moves. `FIRE_LIGHTS` is a uniform of up to four burning fires (xyz the
 * flame, w the gain) the surface shaders read.
 */

/** One fire's scale (metres): the flame's height, the glow's radius, the smoke column's height, the ember count. */
export interface FireSize { readonly flame: number; readonly glow: number; readonly smoke: number; readonly embers: number; /** a thin pale wisp (a cookfire), not the dark plume */ readonly wisp?: boolean }

/** The existing surface shaders borrow this stable light object, before the fire materials compile. */
export const FIRE_LIGHTS = { value: [new Vector4(), new Vector4(), new Vector4(), new Vector4()] };
/** The admitted look IDs for all seven fire programs; no URL or shader source enters this port. */
export const FIRE_GRAPH_IDS = { flame: 'fire-flame', smoke: 'fire-smoke', wisp: 'fire-wisp', glow: 'fire-glow', lampGlow: 'fire-lamp-glow', embers: 'fire-embers', pool: 'fire-pool' } as const;

/** The compiled fire (one per level build): its card programs, ember and pool materials, the clock and the next light slot. */
interface Fire { readonly cards: CardPrograms<'flame' | 'smoke' | 'wisp' | 'glow' | 'lampGlow', Material>; readonly embers: Material; readonly pool: Material; readonly quads: Readonly<Record<'flame' | 'wisp' | 'glow', BufferGeometry>>; readonly made: BufferGeometry[]; readonly setTime: (t: number) => void; slot: number }
let fire: Fire | null = null;
const current = (): Fire => { if (fire === null) throw new Error('Signal Dunes: the fire graphs compile before the world builds (prepareFireFx)'); return fire; };

/** Compile every fire program before buildWorld adds meshes; the level build starts with every light slot free. */
export async function prepareFireFx(ctx: Parameters<typeof ownLookMaterials>[0], shard: typeof source): Promise<void> {
  const ids = Object.values(FIRE_GRAPH_IDS);
  if (ids.some(id => shard.look.materials[id]?.family !== 'graph')) throw new Error('Fire programs must be admitted graphs');
  if (!shard.state.shared.some(field => field.name === 'firetime' && field.type === 'f64' && field.privacy === 'host')) throw new Error('Fire graphs need the declared host firetime clock');
  const looks = await ownLookMaterials(ctx, shard, ids);
  const material = (part: keyof typeof FIRE_GRAPH_IDS): Material => {
    const id = FIRE_GRAPH_IDS[part], found = looks.materials.get(id); if (found === undefined) throw new Error(`Missing compiled fire material ${id}`);
    if ((found.userData['graphPrimitive'] === 'points') !== (part === 'embers')) throw new Error(`Wrong fire primitive ${id}`);
    return found;
  };
  let time = 0;
  looks.graphs.bind({ state: (scope, name) => scope === 'shared' && name === 'firetime' ? time : undefined });
  if (looks.graphs.readout.fallback !== 0) throw new Error('Fire graph compilation refused');
  // the tongues' and plume's quad stands on its foot; the wisp's has 16 rows, so its sway curls it rather than tilting it
  const quads = { flame: new PlaneGeometry(1, 1).translate(0, 0.5, 0), wisp: new PlaneGeometry(1, 1, 1, 16).translate(0, 0.5, 0), glow: new PlaneGeometry(2, 2) };
  const cards = { flame: material('flame'), smoke: material('smoke'), wisp: material('wisp'), glow: material('glow'), lampGlow: material('lampGlow') };
  const made: Fire = { cards: { material: (program) => cards[program] }, embers: material('embers'), pool: material('pool'), quads, made: [], setTime: value => { time = value; looks.tick(0); }, slot: 0 };
  for (const v of FIRE_LIGHTS.value) v.w = 0;
  fire = made; for (const quad of Object.values(quads)) ctx.scope.own(quad);
  ctx.scope.onDispose(() => { for (const g of made.made) g.dispose(); if (fire === made) fire = null; });
}

/** A warm disc `r` wide draped on the ground (`ground(lx, lz)`: its height under a point of the disc's frame) in the pool look. */
function pool(r: number, n: number, ground: (lx: number, lz: number) => number): Mesh {
  const g = new PlaneGeometry(r * 2, r * 2, n, n).rotateX(-Math.PI / 2), p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setY(i, ground(p.getX(i), p.getZ(i)) + 0.06);
  const disc = new Mesh(g, current().pool); disc.frustumCulled = false; return disc;
}

/** Adds a fire's parts under `group` (shown when lit); `at` drapes the warm pool on the ground (`at.at`: the group's world position). */
export function addFire(group: Group, size: FireSize, at?: { at: Vector3; groundAt: (x: number, z: number) => number }): Object3D[] {
  const f = current(), parts: Object3D[] = [], fh = size.flame, wisp = size.wisp === true, options = { quads: f.quads, into: group };
  const tongue = (sx: number, sy: number, off: readonly [number, number, number]): CardRow<'flame'> => ({ program: 'flame', quad: 'flame', scale: [fh * sx, fh * sy, 1], at: off });
  // the main and inner tongues, then two narrower side tongues, offset and phase-shifted by their place; the glow round them
  parts.push(...cardGroup(f.cards, { name: 'fire', order: 0, cards: [tongue(0.56, 1, [0, -0.1, 0]), tongue(0.34, 0.8, [0.05, -0.05, 0.05]), tongue(0.26, 0.62, [-fh * 0.11, -0.08, -0.07]), tongue(0.26, 0.72, [fh * 0.11, -0.08, 0.07]),
    { program: 'glow', quad: 'glow', scale: size.glow, at: [0, fh * 0.4, 0], order: 2 }] }, {}, options).meshes);
  const embers = effectField({ name: 'fire.embers', shape: 'point', count: size.embers }, f.embers), sparks = embers.object; f.made.push(embers.geometry);
  sparks.scale.setScalar(fh * 0.9); sparks.position.y = fh * 0.3; group.add(sparks); parts.push(sparks);
  parts.push(...cardGroup(f.cards, { name: 'smoke', order: 1, cards: [{ program: wisp ? 'wisp' : 'smoke', quad: wisp ? 'wisp' : 'flame', scale: [size.smoke * (wisp ? 0.03 : 0.2), size.smoke, 1], at: [0, fh * 0.7, 0] }] }, {}, options).meshes);
  if (at) { const disc = pool(Math.max(size.glow * 2.3, size.flame * 2.4), 16, (lx, lz) => at.groundAt(at.at.x + lx, at.at.z + lz) - at.at.y); f.made.push(disc.geometry); group.add(disc); parts.push(disc); }
  return parts;
}

/** A lamp's halo and its pool, no light; `ground(lx, lz)` is the ground under a point of `group`'s frame, relative to its origin. */
export function addLampGlow(group: Group, glow: number, ground: (lx: number, lz: number) => number): void {
  const f = current(), disc = pool(glow * 1.6, 10, ground);
  cardGroup(f.cards, { name: 'lamp', order: 2, cards: [{ program: 'lampGlow', quad: 'glow', scale: glow }] }, {}, { quads: f.quads, into: group });
  f.made.push(disc.geometry); group.add(disc);
}

/** Claims a firelight slot at `at`; the switch turns it on or off (`gain`: a lamp is a fraction of a fire). */
export function fireLight(at: Vector3): (lit: boolean, gain?: number) => void {
  const f = current(), v = FIRE_LIGHTS.value[f.slot % FIRE_LIGHTS.value.length] ?? new Vector4(); f.slot++;
  v.set(at.x, at.y, at.z, 0);
  return (lit, gain = 1) => { v.w = lit ? gain : 0; };
}

/** Advances every fire's shared clock. */
export function tickFires(t: number): void { current().setTime(t); }
