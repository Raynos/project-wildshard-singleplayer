import { Sword } from '@wildshard/kit/weapons/melee/SweptMelee';
import { JIAN_ROW } from './vm/jianRow';
import { FEI_ZHUA_ROW } from './grapple/row';
import { FeiZhua } from './grapple/FeiZhua';
import { GRAPPLE_PLAYGROUND } from './playground/registration';
import type { ShardContext } from '@wildshard/game/shard/context';
import { ShardPlugin } from '@wildshard/game/shard/plugin';
import type { PerspectiveCamera } from 'three';
import { type NineDragonWorld, buildNineDragonWorld } from './world/build';
import { installWorld } from './world/install';
import { installSpecimenLight } from './look/specimenLight';
import { installAudio } from './runtime/audio/ambience';
import { STRINGS } from './strings';
import { ndEntriesEnabled } from './debug';


/** `entries`: the SF51-g landing decks at road height (pause ▸ Settings ▸ Debug ▸ Nine Dragon entries, default off) */
type WorldBuilder = (ctx: ShardContext, entries: boolean) => Promise<{ world: NineDragonWorld; camera: PerspectiveCamera }>;

async function buildWorld(ctx: ShardContext, entries: boolean): ReturnType<WorldBuilder> {
  const render = ctx.app.render;
  if (render === null) throw new Error('Nine Dragon needs the render service in its world stage');
  const world = await buildNineDragonWorld(render.renderer, (fraction, detail) => {
    ctx.progress.set(fraction, 1);
    if (detail !== undefined) ctx.progress.detail(detail);
  }, render.tier, { entries });
  return { world, camera: render.camera };
}

/** The world hook can be exercised with a stub build without a DOM or GPU. */
export class NdPlugin extends ShardPlugin {
  override async kit(ctx: ShardContext): Promise<void> {
    await installAudio(ctx);
    ctx.rows.weapon(JIAN_ROW);
    ctx.rows.tool(FEI_ZHUA_ROW);
    const shell = this.shell;
    if (shell === undefined) throw new Error('Nine Dragon equipment requires the game session');
    shell.buildEquipment = (targets, nolock, viewmodel) => {
      const world = shell.world;
      if (world === null) throw new Error('Nine Dragon equipment requires its world');
      const { ironArms: _ironArms, swim: _swim, ...ownSword } = viewmodel ?? {};
      return Promise.resolve({ primary: new Sword(world, targets, { row: JIAN_ROW, profile: JIAN_ROW, allowUnlocked: nolock, ...ownSword,
        ...(world.game.level.camera === undefined ? {} : { portraitFov: world.game.level.camera.portraitFov }) }), rifle: null, secondary: null });
    };
  }
  override play(ctx: ShardContext): void {
    const equipment = ctx.app.equipment;
    if (equipment === null) throw new Error('Nine Dragon needs its loadout before play');
    equipment.add(new FeiZhua(ctx), { locked: false });
  }
  private shell: ShardContext['game']['runtime'];
  private readonly build: WorldBuilder;
  constructor(build: WorldBuilder = buildWorld) {
    super();
    this.build = build;
  }
  override async world(ctx: ShardContext): Promise<void> {
    ctx.strings(STRINGS);
    ctx.playground(GRAPPLE_PLAYGROUND);
    const entries = ndEntriesEnabled(ctx);
    this.shell = ctx.game.runtime;
    if (entries && this.shell !== undefined) this.shell.hooks.levelBounds = (bounds) => bounds === undefined ? undefined : { ...bounds, floor: -20 };
    const { world, camera } = await this.build(ctx, entries);
    if (ctx.scope.disposed) throw new Error('Nine Dragon was unloaded during its world build');
    const rt = installWorld(ctx, world, camera, entries);
    installSpecimenLight(ctx.app.events, ctx.scope, (on, key) => { rt.specimenLight(on, key); });
  }
}

// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default NdPlugin;
