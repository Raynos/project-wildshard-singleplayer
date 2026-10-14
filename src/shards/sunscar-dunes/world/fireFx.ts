import { Mesh, Vector4, type BufferGeometry, type Group, type Material, type Object3D, type Vector3 } from 'three';
import { cardGroup, type CardGroupRow, type CardPrograms } from '@wildshard/sdk/looks/cardField';
import { effectField } from '@wildshard/sdk/looks/effectField';
import { prepareClientWorld } from '@wildshard/game/shardfile/runtimeProduct';
import type { ModelLibrary } from '@wildshard/sdk/looks/modelLibrary';
import { FIRE_GRAPH_IDS, fireRows, lampRows, type FireCard, type FireSize } from '../data/fire';
import type source from '../runtime/source';

/**
 * Fire, embers and smoke as declared rows (SHARD-PLATFORM SF72, effect rows): each fire's parts are rows (`data/fire.ts`
 * fireRows / lampRows) and its look SF59 material graphs (`data/fireLook.ts`, G382), compiled by `prepareFireFx` before the
 * world builds; `addFire` places them on a few quads and points, animated on the GPU from the fires' clock: no CPU
 * particles, no lights, ~4 draws a fire. The billboards (flame tongues, glow, smoke, a lamp's halo) stand on the SDK's card
 * host (`@wildshard/sdk/looks/cardField` cardGroup, G395), each graph turning its own quad to the camera; the embers are a
 * seeded point field (`@wildshard/sdk/looks/effectField`) their graph moves. `FIRE_LIGHTS` is a uniform of up to four
 * burning fires (xyz the flame, w the gain) the surface shaders read.
 */

/** The existing surface shaders borrow this stable light object, before the fire materials compile. */
export const FIRE_LIGHTS = { value: [new Vector4(), new Vector4(), new Vector4(), new Vector4()] };

/** The compiled fire (one per level build): its card programs, ember and pool materials, quads, the clock and the next light slot. */
interface Fire { readonly cards: CardPrograms<FireCard, Material>; readonly embers: Material; readonly pool: Material; readonly quads: Readonly<Record<'flame' | 'wisp' | 'glow', BufferGeometry>>; readonly made: BufferGeometry[]; readonly setTime: (t: number) => void; slot: number }
let fire: Fire | null = null;
const current = (): Fire => { if (fire === null) throw new Error('Signal Dunes: the fire graphs compile before the world builds (prepareFireFx)'); return fire; };

/** Compile every fire program (required graphs, bound to the host field `shared.firetime`) before buildWorld adds meshes. */
export async function prepareFireFx(ctx: Parameters<typeof prepareClientWorld>[0], shard: typeof source, library: Pick<ModelLibrary<string, string>, 'geometry' | 'bindLooks' | 'material'>): Promise<void> {
  const ids = Object.values(FIRE_GRAPH_IDS), looks = await prepareClientWorld(ctx, shard, { materials: ids, requiredMaterials: ids });
  library.bindLooks(ctx.scope, looks);
  let time = 0;
  looks.graphs.bind({ state: (scope, name) => scope === 'shared' && name === 'firetime' ? time : undefined });
  if (looks.graphs.readout.fallback !== 0) throw new Error('Fire graph compilation refused');
  // the tongues' and plume's quad stands on its foot; the wisp's has 16 rows, so its sway curls it rather than tilting it
  const read = (id: string): BufferGeometry => { const made = library.geometry(id); if (made === null) throw new Error(`Missing declared fire geometry: ${id}`); return made; };
  const quads = { flame: read('fire-flame'), wisp: read('fire-wisp'), glow: read('fire-glow') };
  const made: Fire = { cards: { material: (program) => library.material(FIRE_GRAPH_IDS[program]) }, embers: library.material(FIRE_GRAPH_IDS.embers), pool: library.material(FIRE_GRAPH_IDS.pool), quads, made: [], setTime: value => { time = value; looks.tick(0); }, slot: 0 };
  for (const v of FIRE_LIGHTS.value) v.w = 0;
  fire = made; for (const quad of Object.values(quads)) ctx.scope.own(quad);
  ctx.scope.onDispose(() => { for (const g of made.made) g.dispose(); if (fire === made) fire = null; });
}

/** The row's cards and its owned baked ground pool under the original live group. */
function place(group: Group, row: CardGroupRow<FireCard>, pool: BufferGeometry | null): Object3D[] {
  const f = current(), parts: Object3D[] = [...cardGroup(f.cards, row, {}, { quads: f.quads, into: group }).meshes];
  if (pool === null) return parts;
  const disc = new Mesh(pool, f.pool); disc.frustumCulled = false; f.made.push(pool); group.add(disc); return [...parts, disc];
}

/** Adds the original live fire and embers with an optional owned baked pool. */
export function addFire(group: Group, size: FireSize, pool: BufferGeometry | null = null): Object3D[] {
  const f = current(), rows = fireRows(size), parts = place(group, rows.fire, null);
  const embers = effectField(rows.embers, f.embers), sparks = embers.object; f.made.push(embers.geometry);
  sparks.scale.setScalar(rows.embers.scale); sparks.position.y = rows.embers.y; group.add(sparks);
  return [...parts, sparks, ...place(group, rows.smoke, pool)];
}

/** A lamp's live halo and owned baked pool, without another light. */
export function addLampGlow(group: Group, glow: number, pool: BufferGeometry | null): void { const rows = lampRows(glow); place(group, rows.halo, pool); }

/** Claims a firelight slot at `at`; the switch turns it on or off (`gain`: a lamp is a fraction of a fire). */
export function fireLight(at: Vector3): (lit: boolean, gain?: number) => void {
  const f = current(), v = FIRE_LIGHTS.value[f.slot % FIRE_LIGHTS.value.length] ?? new Vector4(); f.slot++;
  v.set(at.x, at.y, at.z, 0);
  return (lit, gain = 1) => { v.w = lit ? gain : 0; };
}

/** Advances every fire's shared clock. */
export function tickFires(t: number): void { current().setTime(t); }
