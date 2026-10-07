import { Sword } from '@wildshard/kit/weapons/melee/SweptMelee';
import { JIAN_ROW } from './vm/jianRow';
import { swordSupport } from './vm/swordSupport';
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
import { installLifts, type Lifts } from './world/liftRide';


/** `entries`: the SF51-g landing decks at road height (pause ▸ Settings ▸ Debug ▸ Nine Dragon entries, default off) */
type WorldBuilder = (ctx: ShardContext, entries: boolean) => Promise<{ world: NineDragonWorld; camera: PerspectiveCamera }>;

async function buildWorld(ctx: ShardContext, entries: boolean): ReturnType<WorldBuilder> {
  const render = ctx.app.render;
  if (render === null) throw new Error('Nine Dragon needs the render service in its world stage');
  // G200: `caps` standalone (no grid cube): the lift deck's open end is closed by its balustrade; in a grid cell the road continues
  const world = await buildNineDragonWorld(render.renderer, (fraction, detail) => {
    ctx.progress.set(fraction, 1);
    if (detail !== undefined) ctx.progress.detail(detail);
  }, render.tier, { entries, caps: ctx.cube === null });
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
      return Promise.resolve({ primary: new Sword(world, targets, { row: JIAN_ROW, profile: JIAN_ROW, allowUnlocked: nolock, ...ownSword, rig: ownSword.rig ?? swordSupport(world.sky, 'wood'),
        ...(world.game.level.camera === undefined ? {} : { portraitFov: world.game.level.camera.portraitFov }) }), rifle: null, secondary: null });
    };
  }
  override async play(ctx: ShardContext): Promise<void> {
    const equipment = ctx.app.equipment;
    if (equipment === null) throw new Error('Nine Dragon needs its loadout before play');
    equipment.add(new FeiZhua(ctx), { locked: false });
    // SF51-p (G184): the lantern lifts from the decks ride their movers (only with the entries on: the cages are built then)
    const built = this.builtLifts, rt = this.shell;
    if (built !== undefined && built.cages.size > 0 && rt?.world !== null && rt?.world !== undefined) this.lifts = await installLifts(ctx, rt.world, rt.interactables, built);
  }
  /** SF51-p: the lantern lifts while they ride (captures and walks read and drive them through the shard handle) */
  lifts: Lifts | null = null;
  private builtLifts: NineDragonWorld['lifts'];
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
    // with the entries on the player walks from the cell's edges (the decks) up the lifts: the whole cell is in bounds
    if (entries && this.shell !== undefined) this.shell.hooks.levelBounds = (bounds) => bounds === undefined ? undefined : { x0: -250, x1: 250, z0: -250, z1: 250, floor: -20 };
    const { world, camera } = await this.build(ctx, entries);
    this.builtLifts = world.lifts;
    if (ctx.scope.disposed) throw new Error('Nine Dragon was unloaded during its world build');
    const rt = installWorld(ctx, world, camera, entries);
    installSpecimenLight(ctx.app.events, ctx.scope, (on, key) => { rt.specimenLight(on, key); });
  }
}

// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default NdPlugin;
