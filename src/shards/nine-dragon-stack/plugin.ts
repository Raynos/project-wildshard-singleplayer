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
import { installPortals, type PortalRide } from './world/portalRide';
import { entryCapsFor } from './world/entries';


/** beyond this far from the cell's centre (m) the player is out by the road-height decks (the fragment spans ~±80 m) */
const DECK_ZONE = 200;

/** `caps`: whether the decks' open ends get their standalone balustrades (G200: no grid cube) */
type WorldBuilder = (ctx: ShardContext, caps: boolean) => Promise<{ world: NineDragonWorld; camera: PerspectiveCamera }>;

async function buildWorld(ctx: ShardContext, caps: boolean): ReturnType<WorldBuilder> {
  const render = ctx.app.render;
  if (render === null) throw new Error('Nine Dragon needs the render service in its world stage');
  // G200: `caps` standalone (no grid cube): each deck's open end is closed by its balustrade; in a grid cell the road continues
  const world = await buildNineDragonWorld(render.renderer, (fraction, detail) => {
    ctx.progress.set(fraction, 1);
    if (detail !== undefined) ctx.progress.detail(detail);
  }, render.tier, { caps });
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
  override play(ctx: ShardContext): Promise<void> {
    const equipment = ctx.app.equipment;
    if (equipment === null) throw new Error('Nine Dragon needs its loadout before play');
    equipment.add(new FeiZhua(ctx), { locked: false });
    // G224: the deck portals to Lantern Square and the square's portal out (walk-in, a short fade, the move under the dark)
    const player = this.shell?.world?.player, slot = this.ndWorld?.portal;
    if (player !== undefined && slot !== undefined) this.portals = installPortals(slot, player);
    return Promise.resolve();
  }
  /** G224: the portals while they run (captures read them through the shard handle) */
  portals: PortalRide | null = null;
  private ndWorld: NineDragonWorld | null = null;
  private shell: ShardContext['game']['runtime'];
  private readonly build: WorldBuilder;
  constructor(build: WorldBuilder = buildWorld) {
    super();
    this.build = build;
  }
  override async world(ctx: ShardContext): Promise<void> {
    ctx.strings(STRINGS);
    ctx.playground(GRAPPLE_PLAYGROUND);
    this.shell = ctx.game.runtime;
    // the player stands on the road-height decks at the cell's edges as well as on the fragment: the whole cell is in
    // bounds; the fall net stays the fragment's own (its authored floor, Y0 − 100) under the fragment and drops to just
    // under the road only out by the decks (G224: you reach them by portal, never by a fall)
    const shell = this.shell;
    if (shell !== undefined) shell.hooks.levelBounds = (bounds) => bounds === undefined ? undefined : { x0: -250, x1: 250, z0: -250, z1: 250,
      get floor(): number { const p = shell.world?.player.position; return p !== undefined && Math.max(Math.abs(p.x), Math.abs(p.z)) > DECK_ZONE ? -20 : bounds.floor; } };
    const { world, camera } = await this.build(ctx, entryCapsFor(ctx.cube));
    if (ctx.scope.disposed) throw new Error('Nine Dragon was unloaded during its world build');
    this.ndWorld = world;
    const rt = installWorld(ctx, world, camera);
    installSpecimenLight(ctx.app.events, ctx.scope, (on, key) => { rt.specimenLight(on, key); });
  }
}

// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default NdPlugin;
