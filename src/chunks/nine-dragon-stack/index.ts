// Nine Dragon Stack's world in the engine (P0-5c): the structure builder its def hands core (`ChunkDef.structures`).
// It builds the fragment (world/build.ts), registers its collision (world/colliders.ts) as pieces of the world registry —
// drawn, colliding, lending their floor, footprinted on the maps (def.ts `map`) — and drives the look's per-frame
// uniforms and the movers. `nineDragonWorld()` is the built world for the render strategy (look/): the shared uniforms,
// the layout records.
import { Group, type PerspectiveCamera } from 'three';
import type { StructureContext } from '../ChunkDef';
import { type NineDragonWorld, buildNineDragonWorld } from './world/build';
import { fragmentColliders, fragmentFloor, fragmentGrappleGuard } from './world/colliders';
import { crossingColliders } from './world/well-mid';
import { installSpecimenLight } from './look/specimenLight';

let current: NineDragonWorld | null = null;
let camera: PerspectiveCamera | null = null;
let grappleGuardOpen = false;
/** The south rim's high safety cap opens for one committed Fei Zhua crossing, then closes. */
export function setGrappleGuardOpen(open: boolean): void { grappleGuardOpen = open; }
/** the running fragment's world (null until it is built) */
export function nineDragonWorld(): NineDragonWorld | null { return current; }
/**
 * the world's per-frame culling, with the camera final: def.ts calls it from the render hook's `frame` (the updaters run
 * before the late hooks pose the camera — a capture's or the free camera's — so culling there would cull a stale view)
 */
export function cullNineDragonWorld(): void { if (current !== null && camera !== null) current.cull(camera); }

const FILE = 'src/chunks/nine-dragon-stack/world/colliders.ts';

export const NINE_DRAGON_WORLD = {
  async build(ctx: StructureContext): Promise<void> {
    const world = await buildNineDragonWorld(ctx.renderer, ctx.progress);
    current = world;
    camera = ctx.camera;
    installSpecimenLight(() => current?.shared ?? null); // the Model Explorer's turntable lights the specimens (E315)
    grappleGuardOpen = false;
    const c = fragmentColliders();
    ctx.registry.add({
      id: 'nds-floors', name: 'Lantern Square', category: 'buildings', file: 'src/chunks/nine-dragon-stack/world/build.ts',
      object: world.root, surface: 'stone', colliders: c.floors, floor: fragmentFloor, solidFloor: true,
    });
    ctx.registry.add({ id: 'nds-fronts', name: 'The towers', category: 'buildings', file: FILE, surface: 'stone', colliders: c.fronts });
    // (the balustrade over the Well collides as its model since E346: models/wellBalustrade.ts, placed by world/build.ts)
    ctx.registry.add({
      id: 'nds-grapple-guard', name: 'The Well safety cap', category: 'buildings', file: FILE, surface: 'stone',
      colliders: fragmentGrappleGuard(), follows: new Group(), active: () => !grappleGuardOpen,
    });
    // (the props collide as their models: registered as the world places them, world/build.ts)
    // the Well's crossings (dome B2's well-mid.ts: each deck's slabs following its hump / sag, its rail walls; every box
    // names its own surface; the gate bridges' paifang posts are the paifang model's, E346): filled while the world
    // builds, so read after it
    ctx.registry.add({
      id: 'nds-crossings', name: 'The Well\'s crossings', category: 'buildings', file: 'src/chunks/nine-dragon-stack/world/well-mid.ts',
      surface: 'stone', colliders: [...crossingColliders()],
    });
    // (the fragment's models register themselves as they are placed: world/build.ts, src/models/place.ts)
    ctx.onUpdate((_dt, t) => { world.update(t, ctx.camera); });
  },
};
