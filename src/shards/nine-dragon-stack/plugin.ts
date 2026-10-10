import { standaloneEntry } from './runtime/standalone';
import { Sword } from '@wildshard/game/weapons/Sword';
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
import { bindNineItems } from './runtime/items';
import { bindNineFacts } from './runtime/facts';
import { STRINGS } from './strings';
import { playerRider, type PortalRide } from './world/portalRide';
import { installPortals } from './world/portalVeil';
import { entryCapsFor } from './world/entries';
import { WORDS } from './world/words';
import { chars } from './util';
import { glyphLayout } from './tier';
import { KAI_STACK } from './data/signs';
import { FONT_LOAD } from './data/worldDressing';
import { waitForFonts } from '@wildshard/sdk/looks/fontWait';
import { GlyphField } from '@wildshard/sdk/looks/neonText';


/** the characters the neon's glyph atlas draws (world/build.ts FONT_CHARS: a mismatch only loses the prepared atlas) */
const FONT_CHARS = [...new Set(chars(`${WORDS.join('')}九龍疊城萬家燈火天下一家福德正神九龍城重慶小麵纜車站九龍衙門鎮邪祥`))].join('');

/** beyond this far from the cell's centre (m) the player is out by the road-height decks (the fragment spans ~±80 m) */
const DECK_ZONE = 200;

/** `caps`: whether the decks' open ends get their standalone balustrades (G200: no grid cube) */
type WorldBuilder = (ctx: ShardContext, caps: boolean) => Promise<{ world: NineDragonWorld; camera: PerspectiveCamera }>;

async function buildWorld(ctx: ShardContext, caps: boolean): ReturnType<WorldBuilder> {
  const render = ctx.app.render;
  if (render === null) throw new Error('Nine Dragon needs the render service in its world stage');
  // op-hitch23: the neon's glyph atlas is computed ahead in engine work slices (a grid cell builds this world on the road,
  // in play: the atlas was one ~0.2 s stretch on the desktop); the build's constructor takes it. Same arguments as world/build.ts.
  // (one prepared atlas per argument set: the build's constructor takes it, a repeat prepare finds it)
  await waitForFonts(FONT_LOAD.specs, FONT_CHARS, FONT_LOAD.capMs);
  await GlyphField.prepare(chars(FONT_CHARS), glyphLayout(render.tier), KAI_STACK);
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
      const primary = new Sword(world, targets, { row: JIAN_ROW, profile: JIAN_ROW, allowUnlocked: nolock, ...ownSword, rig: ownSword.rig ?? swordSupport(world.sky, 'wood'),
        ...(world.game.level.camera === undefined ? {} : { portraitFov: world.game.level.camera.portraitFov }) });
      this.primary = primary;
      return Promise.resolve({ primary, rifle: null, secondary: null });
    };
  }
  override play(ctx: ShardContext): Promise<void> {
    const equipment = ctx.app.equipment;
    if (equipment === null) throw new Error('Nine Dragon needs its loadout before play');
    const primary = this.primary;
    if (primary === null) throw new Error('Nine Dragon needs its prebuilt Jian before play');
    // G285: the feats (a ride into Lantern Square, the Fei Zhua's Well crossing) are ledger facts the page's laws report
    const facts = bindNineFacts(ctx, this.shell?.play?.progress);
    const grapple = new FeiZhua(ctx, undefined, facts);
    bindNineItems(ctx, primary, grapple);
    equipment.add(grapple, { locked: false });
    // G224: the deck portals to Lantern Square and the square's portal out (walk-in, a short fade, the checked transfer under the dark)
    const world = this.shell?.world, slot = this.ndWorld?.portal;
    if (world !== undefined && world !== null && slot !== undefined) this.portals = installPortals(slot, playerRider(world.player, () => world.physics), facts);
    return Promise.resolve();
  }
  /** G224: the portals while they run (captures read them through the shard handle) */
  portals: PortalRide | null = null;
  private ndWorld: NineDragonWorld | null = null;
  private primary: InstanceType<typeof Sword> | null = null;
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
export default standaloneEntry(NdPlugin);

/** Resolve only the declared first-party entry; standalone keeps the same native constructor. */
export function resolveTrustedRuntime(entry: string): new () => ShardPlugin {
  if (entry !== 'runtime/index.ts') throw new Error('Unknown trusted runtime entry');
  return NdPlugin;
}
