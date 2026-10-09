// The world hook installs the fragment's pieces and update system; NdRuntime supplies the look and traversal.
import { Group, type PerspectiveCamera } from 'three';
import type { LevelContext } from '@wildshard/engine/level/context';
import type { NineDragonWorld } from './build';
import { fragmentColliders, fragmentFloor, fragmentGrappleGuard } from './colliders';
import { crossingColliders } from './well-mid';
import { entryCapColliders, entryDeckFloor, portalFloorRows } from './floorRows';
import { SQUARE_FLOOR } from './portalPlan';
import { NdRuntime, ownNdRuntime } from '../runtime/state';

const FILE = 'src/shards/nine-dragon-stack/world/colliders.ts';
/** a registered piece, as the level context takes it */
type Piece = Parameters<LevelContext['piece']>[0];

/** the fragment's floor, else a road-height entry deck's (SF51-g) */
export function withDecks(x: number, z: number): number | undefined { return fragmentFloor(x, z) ?? entryDeckFloor(x, z); }

/** Legacy and staged boots share identical piece fields. */
export function installWorld(ctx: Pick<LevelContext, 'scope' | 'piece' | 'system'>, world: NineDragonWorld, camera: PerspectiveCamera): NdRuntime {
    const rt = new NdRuntime(world, camera);
    ownNdRuntime(ctx.scope, rt);
    const c = fragmentColliders();
    // SF51-g / G224: the four landing decks at road height on the edge midpoints, each with its portal to the square
    // (world/entries.ts; drawn in the world's `entries` kit; standalone, their balustrades collide with the fragment's
    // floors). SF8c: the floors the portal links bind by id (shard.config.ts `props.colliders`, entries.ts portalFloorRows:
    // each whole deck and the square's slab) are their own pieces whose colliders answer to that id, so the checked
    // traversal (world/portalRide.ts) admits the ring you stand at and the floor you arrive on against the very boxes the
    // shardfile declares
    const floors: Piece[] = [{
      id: 'nds-floors', name: 'Lantern Square', category: 'buildings', file: 'src/shards/nine-dragon-stack/world/build.ts',
      object: world.root, surface: 'stone', colliders: [...c.floors.filter((d) => d !== c.square), ...entryCapColliders(world.entryCaps === true)],
      floor: withDecks, solidFloor: true,
    }, ...portalFloorRows().map((row): Piece => ({ id: `nds-${row.id}`, name: row.id === SQUARE_FLOOR ? 'Lantern Square slab' : `Landing deck (${row.id})`,
      category: 'buildings', file: 'src/shards/nine-dragon-stack/world/entries.ts', surface: 'stone', colliders: row.shapes, colliderOwner: row.id }))];
    for (const piece of floors) ctx.piece(piece);
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

