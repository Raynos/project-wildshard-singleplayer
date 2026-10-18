import { firstPartyStandaloneEntry } from '@wildshard/game/shard/runtimeVariant';
import { Sword } from '@wildshard/game/weapons/Sword';
import { applyMeleeCombatProfile } from '@wildshard/engine/combat/meleeProfile';
import { SWORD_WOOD } from '@wildshard/game/weapons/starterMeleeProfile';
import { MeleeWeaponProfileSchema } from '@wildshard/format/weaponProfiles';
import { readItemEquipment } from '@wildshard/game/plugin/nativeItems';
import { bindRuntimeEquipment, bindRuntimeItems } from '@wildshard/game/plugin/headless';
import { BufferGeometryLoader, MaterialLoader, Group, type PerspectiveCamera } from 'three';
import * as v from 'valibot';
import { setProgramKey } from '@wildshard/engine/render/shaderPatches';
import { FEI_ZHUA_ROW } from './grapple/row';
import { FeiZhua } from './grapple/FeiZhua';
import { GRAPPLE_PLAYGROUND } from './playground/registration';
import type { ShardContext } from '@wildshard/game/shard/context';
import { ShardPlugin, worldBuildYield } from '@wildshard/game/shard/plugin';
import { type NineDragonWorld, buildNineDragonWorld } from './world/build';
import worldInstall from './world/install.generated.json' with { type: 'json' };
import { fragmentFloor } from './world/colliders';
import { entryDeckFloor } from './world/floorRows';
import { crossingColliders } from './world/wellBounds';
import { NdRuntime, ownNdRuntime } from './runtime/state';
import { installSpecimenLight } from './look/specimenLight';
import { installAudio } from './runtime/audio/ambience';
import { bindNineFacts } from './runtime/facts';
import bootMetadata from './boot/metadata.generated.json' with { type: 'json' };
import { playerRider, type PortalRide } from './world/portalRide';
import { installPortals } from './world/portalVeil';
import { lookGraphMaterials } from '@wildshard/game/plugin/shaderFamily';
import { lendLooks } from '@wildshard/sdk/looks/lentLooks';


/** beyond this far from the cell's centre (m) the player is out by the road-height decks (the fragment spans ~±80 m) */
const DECK_ZONE = 200;

/** `caps`: whether the decks' open ends get their standalone balustrades (G200: no grid cube); `pause`: the build's paced
 *  pause between stretches (worldBuildYield, op-hitch45) */
type WorldBuilder = (ctx: ShardContext, caps: boolean, pause: () => Promise<void>) => Promise<{ world: NineDragonWorld; camera: PerspectiveCamera }>;

async function buildWorld(ctx: ShardContext, caps: boolean, pause: () => Promise<void>): ReturnType<WorldBuilder> {
  const render = ctx.app.render;
  if (render === null) throw new Error('Nine Dragon needs the render service in its world stage');
  // the look.materials graphs (data/lookGraphs.json: the sky, the Well's silk sheets, the steam), compiled and lent first
  const source = ctx.product.shardfile;
  lendLooks(ctx.scope, await lookGraphMaterials(ctx.scope, render, source, Object.keys(source.look.materials)));
  // G200: `caps` standalone (no grid cube): each deck's open end is closed by its balustrade; in a grid cell the road continues
  const world = await buildNineDragonWorld(render.renderer, (fraction, detail) => {
    ctx.progress.set(fraction, 1);
    if (detail !== undefined) ctx.progress.detail(detail);
  }, render.tier, { scope: ctx.scope, caps, pause });
  return { world, camera: render.camera };
}

/** The world hook can be exercised with a stub build without a DOM or GPU. */
export class NdPlugin extends ShardPlugin {
  override async kit(ctx: ShardContext): Promise<void> {
    await installAudio(ctx);
    const support = v.parse(v.strictObject({ sword: v.unknown(), arms: v.unknown(), material: v.unknown(), tipY: v.number(), baseY: v.number() }),
      JSON.parse(new TextDecoder().decode(await ctx.product.file('weapons/jian-support.json')), (_key, value: unknown) => value === '-0' ? -0 : value));
    const view = v.parse(v.strictObject({ portraitFov: v.number() }), JSON.parse(new TextDecoder().decode(await ctx.product.file('weapons/jian-row.json'))));
    const item = ctx.product.shardfile.items.rows.find(row => row.id === 'weapon.jian');
    const profile = v.parse(MeleeWeaponProfileSchema, item?.kind === 'weapon' ? item.profile : undefined);
    this.profile = profile;
    const row = { ...applyMeleeCombatProfile(SWORD_WOOD, profile), ...readItemEquipment(ctx.product.shardfile.items, 'weapon.jian'),
      parent: SWORD_WOOD.id, feel: { ...SWORD_WOOD.feel, portraitFov: view.portraitFov } };
    ctx.rows.weapon(row);
    ctx.rows.tool(FEI_ZHUA_ROW);
    const shell = this.shell;
    if (shell === undefined) throw new Error('Nine Dragon equipment requires the game session');
    shell.buildEquipment = (targets, nolock, viewmodel) => {
      const world = shell.world;
      if (world === null) throw new Error('Nine Dragon equipment requires its world');
      const { ironArms: _ironArms, swim: _swim, ...ownSword } = viewmodel ?? {};
      let rig = ownSword.rig;
      if (rig === undefined) {
        const material = new MaterialLoader().parse(support.material);
        setProgramKey(material, 'sword-lowpoly'); world.sky.setupMaterial(material);
        rig = { sword: new BufferGeometryLoader().parse(support.sword), arms: new BufferGeometryLoader().parse(support.arms), material, tipY: support.tipY, baseY: support.baseY };
      }
      const primary = new Sword(world, targets, { row, profile: row, allowUnlocked: nolock, ...ownSword, rig,
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
    const source = ctx.product.shardfile, items = source.items, tool = grapple.row;
    bindRuntimeEquipment(ctx, { ...source, items: { ...items, rows: items.rows.filter(row => row.kind === 'weapon'), loadout: { ...items.loadout, tools: [] } } },
      [{ id: primary.row.id, weapon: primary, profile: this.profile }]);
    bindRuntimeItems(ctx, source, {
      kit: new Map([['melee', { kind: 'weapon', profiles: ['melee'], create: () => primary }]]),
      families: new Map([['nine-dragon-stack.fei-zhua', { kind: 'tool', presentation: { ui: tool.ui }, create: row => { grapple.row = { ...row, meta: tool.meta }; return grapple; } }]]),
      icon: name => { const row = [primary.row, tool].find(entry => entry.ui.icon === name); if (row === undefined) throw new Error(`Unknown Nine Dragon item icon ${name}`); return row.ui.icon; },
    });
    equipment.add(grapple, { locked: false });
    // G224: the deck portals to Lantern Square and the square's portal out (walk-in, a short fade, the checked transfer under the dark)
    const world = this.shell?.world, slot = this.ndWorld?.portal;
    if (world !== undefined && world !== null && slot !== undefined) this.portals = installPortals(slot, playerRider(world.player, () => world.physics), facts);
    return Promise.resolve();
  }
  /** G224: the portals while they run (captures read them through the shard handle) */
  portals: PortalRide | null = null;
  private ndWorld: NineDragonWorld | null = null;
  private profile: v.InferOutput<typeof MeleeWeaponProfileSchema> | null = null;
  private primary: InstanceType<typeof Sword> | null = null;
  private shell: ShardContext['game']['runtime'];
  private readonly build: WorldBuilder;
  constructor(build: WorldBuilder = buildWorld) {
    super();
    this.build = build;
  }
  override async world(ctx: ShardContext): Promise<void> {
    const scope = ctx.scope;
    ctx.strings(bootMetadata.strings);
    ctx.playground(GRAPPLE_PLAYGROUND);
    this.shell = ctx.game.runtime;
    // the player stands on the road-height decks at the cell's edges as well as on the fragment: the whole cell is in
    // bounds; the fall net stays the fragment's own (its authored floor, Y0 − 100) under the fragment and drops to just
    // under the road only out by the decks (G224: you reach them by portal, never by a fall)
    const shell = this.shell;
    if (shell !== undefined) shell.hooks.levelBounds = (bounds) => bounds === undefined ? undefined : { x0: -250, x1: 250, z0: -250, z1: 250,
      get floor(): number { const p = shell.world?.player.position; return p !== undefined && Math.max(Math.abs(p.x), Math.abs(p.z)) > DECK_ZONE ? -20 : bounds.floor; } };
    const { world, camera } = await this.build(ctx, ctx.cube === null, () => worldBuildYield(ctx));
    if (scope.disposed) throw new Error('Nine Dragon was unloaded during its world build');
    this.ndWorld = world;
    const rt = new NdRuntime(world, camera);
    ownNdRuntime(scope, rt);
    const point = v.strictObject({ x: v.number(), y: v.number(), z: v.number() });
    const collider = v.variant('kind', [
      v.strictObject({ kind: v.literal('box'), x: v.number(), y: v.number(), z: v.number(), hx: v.number(), hy: v.number(), hz: v.number(), surface: v.literal('stone') }),
      v.strictObject({ kind: v.literal('treads'), from: point, to: point, width: v.number(), count: v.number(), surface: v.literal('stone') }),
    ]);
    const rows = v.parse(v.array(v.object({ id: v.string(), name: v.string(), category: v.literal('buildings'), file: v.string(),
      surface: v.literal('stone'), colliderOwner: v.exactOptional(v.string()), colliders: v.array(collider) })), world.entryCaps === true ? worldInstall.standalone : worldInstall.cell);
    const pieces: Parameters<ShardContext['piece']>[0][] = [];
    for (const row of rows) pieces.push({ ...row,
      ...(row.id === 'nds-floors' ? { object: world.root, floor: (x: number, z: number) => fragmentFloor(x, z) ?? entryDeckFloor(x, z), solidFloor: true } : {}),
    });
    for (const piece of pieces) ctx.piece(piece.id === 'nds-grapple-guard' ? { ...piece, follows: new Group(), active: () => !rt.guardOpen } : piece);
    ctx.piece({ ...worldInstall.crossings, category: 'buildings', surface: 'stone', colliders: [...crossingColliders()] });
    ctx.system({ id: 'shard.nd.world', phase: 'update', after: ['engine.player.update'], run: (_dt, t) => { rt.world.update(t, rt.camera); } });
    installSpecimenLight(ctx.app.events, scope, (on, key) => { rt.specimenLight(on, key); });
  }
}

// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default firstPartyStandaloneEntry(NdPlugin, 'Nine Dragon', () => import('./runtime/index'));

/** Resolve only the declared first-party entry; standalone keeps the same native constructor. */
export function resolveTrustedRuntime(entry: string): new () => ShardPlugin {
  if (entry !== 'runtime/index.ts') throw new Error('Unknown trusted runtime entry');
  return NdPlugin;
}
