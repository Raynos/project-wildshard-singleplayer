import { HybridResidentWorld } from '@wildshard/game/shardfile/hybrid';
import { declaredRuntimeEntry } from '@wildshard/game/shard/declaredEntry';
import type { PerspectiveCamera } from 'three';
import type { ShardContext } from '@wildshard/game/shard/context';
import { ShardPlugin, worldBuildYield } from '@wildshard/game/shard/plugin';
import { type NineDragonWorld, buildNineDragonWorld } from './world/build';
import { WorldEntry } from '@wildshard/game/shardfile/worldEntry';
import { TIER } from '@wildshard/engine/core/tier';
import { lookGraphMaterials } from '@wildshard/game/plugin/shaderFamily';
import { lendLooks } from '@wildshard/sdk/looks/lentLooks';
import { installWorldScenes } from '@wildshard/game/shardfile/worldScenes';


/** `caps`: whether the decks' open ends get their standalone balustrades (G200: no grid cube); `pause`: the build's paced
 *  pause between stretches (worldBuildYield, op-hitch45) */
type WorldBuilder = (ctx: ShardContext, caps: boolean, pause: () => Promise<void>) => Promise<{ world: NineDragonWorld; camera: PerspectiveCamera }>;

const residentWorld = new HybridResidentWorld<NineDragonWorld>();

async function buildWorld(ctx: ShardContext, caps: boolean, pause: () => Promise<void>): ReturnType<WorldBuilder> {
  const render = ctx.app.render;
  if (render === null) throw new Error('Nine Dragon needs the render service in its world stage');
  // the look.materials graphs (data/lookGraphs.json: the sky, the Well's silk sheets, the steam), compiled and lent first
  const source = ctx.product.shardfile;
  const sky = ctx.game.runtime?.world?.sky;
  if (sky === undefined) throw new Error('Nine Dragon needs its world sky');
  const world = await residentWorld.load(ctx, async owner => {
    lendLooks(owner, await lookGraphMaterials(owner, render, source, Object.keys(source.look.materials)));
    const scenes = await installWorldScenes(ctx, ctx.product.section('world/scenes'), owner);
    // G200: `caps` standalone (no grid cube): each deck's open end is closed by its balustrade; in a grid cell the road continues
    return buildNineDragonWorld(render.renderer, (fraction, detail) => {
      ctx.progress.set(fraction, 1);
      if (detail !== undefined) ctx.progress.detail(detail);
    }, render.tier, { scope: owner, sky, scenes, caps, pause });
  });
  return { world, camera: render.camera };
}

/** The world hook can be exercised with a stub build without a DOM or GPU. */
export class NdPlugin extends ShardPlugin {
  private readonly build: WorldBuilder;
  constructor(build: WorldBuilder = buildWorld) {
    super();
    this.build = build;
  }
  override async world(ctx: ShardContext): Promise<void> {
    const scope = ctx.scope;
    const { world } = await this.build(ctx, ctx.cube === null, () => worldBuildYield(ctx));
    if (scope.disposed) throw new Error('Nine Dragon was unloaded during its world build');
    // the square's floors piece (world/scenes entry, G3): its colliders and floors over the world root, this ending's
    await WorldEntry.admit(ctx.product.section('world/scenes').entry, { scope, root: world.root, tier: TIER, variant: world.entryCaps === true ? 'capped' : 'open', piece: (piece) => { ctx.piece(piece); } }).run('pieces');
    ctx.system({ id: 'shard.nd.world', phase: 'update', after: ['engine.player.update'], run: (_dt, t) => { world.update(t); } });
  }
}

const entry = declaredRuntimeEntry(NdPlugin, NdPlugin, {
  entry: 'runtime/index.ts', retainHomeRuntime: true, stagesOwner: 'declared', nativePlan: { phases: ['world', 'world-bindings', 'kit', 'play'] },
});
export const resolveTrustedRuntime = entry.resolveTrustedRuntime;

// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default entry.default;
