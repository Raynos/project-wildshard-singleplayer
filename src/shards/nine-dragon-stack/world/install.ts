// The world hook installs the fragment's pieces and update system; NdRuntime supplies the look and traversal.
import { Group, type PerspectiveCamera } from 'three';
import type { LevelContext } from '@wildshard/engine/level/context';
import type { NineDragonWorld } from './build';
import { fragmentColliders, fragmentFloor, fragmentGrappleGuard, northStreetFloor } from './colliders';
import { NORTH_DOOR } from './liftPlan';
import { crossingColliders } from './well-mid';
import { entryDeckColliders, entryDeckFloor } from './entries';
import { NdRuntime, ownNdRuntime } from '../runtime/state';

const FILE = 'src/shards/nine-dragon-stack/world/colliders.ts';

/** the fragment's floor, else a road-height entry deck's (SF51-g), else the north street carried on to its lift (SF51-p) */
export function withDecks(x: number, z: number): number | undefined { return fragmentFloor(x, z) ?? entryDeckFloor(x, z) ?? northStreetFloor(x, z); }

/** Legacy and staged boots share identical piece fields. */
export function installWorld(ctx: Pick<LevelContext, 'scope' | 'piece' | 'system'>, world: NineDragonWorld, camera: PerspectiveCamera, entries = false): NdRuntime {
    const rt = new NdRuntime(world, camera);
    ownNdRuntime(ctx.scope, rt);
    // SF51-p: with the entries on, the north street runs on to the north deck's lantern lift (world/lifts.ts)
    const c = fragmentColliders(entries ? { door: NORTH_DOOR } : undefined);
    // SF51-g: with Debug ▸ Nine Dragon entries on, the four landing decks at road height on the edge midpoints
    // (world/entries.ts; drawn in the world's `entries` kit) are floors of this piece
    ctx.piece({
      id: 'nds-floors', name: 'Lantern Square', category: 'buildings', file: 'src/shards/nine-dragon-stack/world/build.ts',
      object: world.root, surface: 'stone', colliders: entries ? [...c.floors, ...entryDeckColliders(world.entryCaps === true)] : c.floors,
      floor: entries ? withDecks : fragmentFloor, solidFloor: true,
    });
    ctx.piece({ id: 'nds-fronts', name: 'The towers', category: 'buildings', file: FILE, surface: 'stone', colliders: c.fronts });
    // (the balustrade over the Well collides as its model since E346: models/wellBalustrade.ts, placed by world/build.ts)
    ctx.piece({
      id: 'nds-grapple-guard', name: 'The Well safety cap', category: 'buildings', file: FILE, surface: 'stone',
      colliders: fragmentGrappleGuard(), follows: new Group(), active: () => !rt.guardOpen,
    });
    // (the props collide as their models: registered as the world places them, world/build.ts)
    // the Well's crossings (dome B2's well-mid.ts: each deck's slabs following its hump / sag, its rail walls; every box
    // names its own surface; the gate bridges' paifang posts are the paifang model's, E346): filled while the world
    // builds, so read after it
    ctx.piece({
      id: 'nds-crossings', name: 'The Well\'s crossings', category: 'buildings', file: 'src/shards/nine-dragon-stack/world/well-mid.ts',
      surface: 'stone', colliders: [...crossingColliders()],
    });
    // (the fragment's models register themselves as they are placed: world/build.ts, src/engine/models/place.ts)
    ctx.system({ id: 'shard.nd.world', phase: 'update', after: ['engine.player.update'],
      run: (_dt, t) => { rt.world.update(t, rt.camera); } });
    return rt;
}

