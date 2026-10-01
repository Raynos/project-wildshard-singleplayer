// The world hook installs the fragment's pieces and update system; NdRuntime supplies the look and traversal.
import { Group, type PerspectiveCamera } from 'three';
import { app, type LevelContext } from '#engine';
import type { StructureContext } from '#game/shard/manifest';
import { type NineDragonWorld, buildNineDragonWorld } from './build';
import { fragmentColliders, fragmentFloor, fragmentGrappleGuard } from './colliders';
import { crossingColliders } from './well-mid';
import { installSpecimenLight } from '../look/specimenLight';
import { NdRuntime, ownNdRuntime } from '../runtime';

const FILE = 'src/shards/nine-dragon-stack/world/colliders.ts';

/** Legacy and staged boots share identical piece fields. */
export function installWorld(ctx: Pick<LevelContext, 'scope' | 'piece' | 'system'>, world: NineDragonWorld, camera: PerspectiveCamera): NdRuntime {
    const rt = new NdRuntime(world, camera);
    ownNdRuntime(ctx.scope, rt);
    const c = fragmentColliders();
    ctx.piece({
      id: 'nds-floors', name: 'Lantern Square', category: 'buildings', file: 'src/shards/nine-dragon-stack/world/build.ts',
      object: world.root, surface: 'stone', colliders: c.floors, floor: fragmentFloor, solidFloor: true,
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

/** Removed when the production LevelDriver owns the world stage. */
export const NINE_DRAGON_WORLD = {
  async build(ctx: StructureContext): Promise<void> {
    const scope = app.levelScope;
    if (scope === null) throw new Error('Nine Dragon world needs a level scope');
    const world = await buildNineDragonWorld(ctx.renderer, ctx.progress);
    const rt = installWorld({ scope, piece: (piece) => { ctx.registry.add(piece); },
      system: (system) => { ctx.onUpdate(system.run, system.id); } }, world, ctx.camera);
    installSpecimenLight(scope, (on, key) => { rt.specimenLight(on, key); });
  },
};
