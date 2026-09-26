// Nine Dragon Stack's world in the engine (P0-5c): the structure builder its def hands core (`ChunkDef.structures`).
// It builds the fragment (world/build.ts), registers its collision (world/colliders.ts) as pieces of the world registry —
// drawn, colliding, lending their floor, footprinted on the maps (def.ts `map`) — and drives the look's per-frame
// uniforms and the movers. `nineDragonWorld()` is the built world for the render strategy (look/): the shared uniforms,
// the layout records.
import type { StructureContext } from '../ChunkDef';
import { type NineDragonWorld, buildNineDragonWorld } from './world/build';
import { fragmentColliders, fragmentFloor } from './world/colliders';

let current: NineDragonWorld | null = null;
/** the running fragment's world (null until it is built) */
export function nineDragonWorld(): NineDragonWorld | null { return current; }

const FILE = 'src/chunks/nine-dragon-stack/world/colliders.ts';

export const NINE_DRAGON_WORLD = {
  async build(ctx: StructureContext): Promise<void> {
    const world = await buildNineDragonWorld(ctx.renderer, ctx.progress);
    current = world;
    const c = fragmentColliders();
    ctx.registry.add({
      id: 'nds-floors', name: 'Lantern Square', category: 'buildings', file: 'src/chunks/nine-dragon-stack/world/build.ts',
      object: world.root, surface: 'stone', colliders: c.floors, floor: fragmentFloor, solidFloor: true,
    });
    ctx.registry.add({ id: 'nds-fronts', name: 'The towers', category: 'buildings', file: FILE, surface: 'stone', colliders: c.fronts });
    ctx.registry.add({ id: 'nds-edges', name: 'The balustrade', category: 'buildings', file: FILE, surface: 'stone', colliders: c.edges });
    ctx.registry.add({ id: 'nds-props', name: 'The square\'s props', category: 'props', file: FILE, surface: 'wood', colliders: c.props });
    ctx.onUpdate((_dt, t) => { world.update(t, ctx.camera); });
  },
};
