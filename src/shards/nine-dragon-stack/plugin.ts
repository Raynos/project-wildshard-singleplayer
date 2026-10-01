import { ShardPlugin, type ShardContext } from '#game';
import type { PerspectiveCamera } from 'three';
import { type NineDragonWorld, buildNineDragonWorld } from './world/build';
import { installWorld } from './world/install';
import { installSpecimenLight } from './look/specimenLight';

type WorldBuilder = (ctx: ShardContext) => Promise<{ world: NineDragonWorld; camera: PerspectiveCamera }>;

async function buildWorld(ctx: ShardContext): ReturnType<WorldBuilder> {
  const render = ctx.app.render;
  if (render === null) throw new Error('Nine Dragon needs the render service in its world stage');
  const world = await buildNineDragonWorld(render.renderer, (fraction, detail) => {
    ctx.progress.set(fraction, 1);
    if (detail !== undefined) ctx.progress.detail(detail);
  }, render.tier);
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
    const { world, camera } = await this.build(ctx);
    if (ctx.scope.disposed) throw new Error('Nine Dragon was unloaded during its world build');
    const rt = installWorld(ctx, world, camera);
    if (typeof document !== 'undefined') installSpecimenLight(ctx.scope, (on, key) => { rt.specimenLight(on, key); });
  }
}

// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default NdPlugin;
