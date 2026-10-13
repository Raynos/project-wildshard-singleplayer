import { Vector4, type Material } from 'three';
import { createFireFx, type FireFx, type FireFxPrograms } from '../runtime/looks/fireFx';
import { ownLookMaterials } from '../runtime/looks/bakedGround';
import type source from '../runtime/source';

/** The existing surface shaders borrow this stable light object, before the fire materials compile. */
export const FIRE_LIGHTS = { value: [new Vector4(), new Vector4(), new Vector4(), new Vector4()] };
let fx: FireFx | null = null;
const current = (): FireFx => { if (fx === null) throw new Error('Signal Dunes: the fire graphs compile before the world builds (prepareFireFx)'); return fx; };
/** The admitted look IDs for all seven fire programs; no URL or shader source enters this port. */
export const FIRE_GRAPH_IDS = { flame: 'fire-flame', smoke: 'fire-smoke', wisp: 'fire-wisp', glow: 'fire-glow', lampGlow: 'fire-lamp-glow', embers: 'fire-embers', pool: 'fire-pool' } as const;
/** Compile every fire program and its immutable texture params before buildWorld adds meshes. */
export async function prepareFireFx(ctx: Parameters<typeof ownLookMaterials>[0], shard: typeof source): Promise<void> {
  const ids = Object.values(FIRE_GRAPH_IDS);
  if (ids.some(id => shard.look.materials[id]?.family !== 'graph')) throw new Error('Fire programs must be admitted graphs');
  if (!shard.state.shared.some(field => field.name === 'firetime' && field.type === 'f64' && field.privacy === 'host')) throw new Error('Fire graphs need the declared host firetime clock');
  const looks = await ownLookMaterials(ctx, shard, ids);
  const material = (id: string): Material => {
    const found = looks.materials.get(id); if (found === undefined) throw new Error(`Missing compiled fire material ${id}`);
    if ((found.userData['graphPrimitive'] === 'points') !== (id === FIRE_GRAPH_IDS.embers)) throw new Error(`Wrong fire primitive ${id}`);
    return found;
  };
  let time = 0;
  looks.graphs.bind({ state: (scope, name) => scope === 'shared' && name === 'firetime' ? time : undefined });
  const programs: FireFxPrograms = { materials: { flame: material(FIRE_GRAPH_IDS.flame), smoke: material(FIRE_GRAPH_IDS.smoke), wisp: material(FIRE_GRAPH_IDS.wisp), glow: material(FIRE_GRAPH_IDS.glow), lampGlow: material(FIRE_GRAPH_IDS.lampGlow), embers: material(FIRE_GRAPH_IDS.embers), pool: material(FIRE_GRAPH_IDS.pool) }, setTime: value => { time = value; looks.tick(0); } };
  if (looks.graphs.readout.fallback !== 0) throw new Error('Fire graph compilation refused');
  const made = createFireFx(programs, FIRE_LIGHTS); fx = made;
  ctx.scope.onDispose(() => { if (fx === made) fx = null; });
}
export const addFire: FireFx['addFire'] = (...args) => current().addFire(...args), addLampGlow: FireFx['addLampGlow'] = (...args) => { current().addLampGlow(...args); };
export const fireLight: FireFx['fireLight'] = at => current().fireLight(at), fireGeometries = (): ReturnType<FireFx['geometries']> => current().geometries();
export const fireResources = (): readonly { dispose: () => void }[] => current().resources;
export const resetFireLights = (): void => { current().resetLights(); }, tickFires = (t: number): void => { current().tick(t); };
