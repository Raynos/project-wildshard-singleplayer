import { prepareNinePost } from './look/render';
import { HybridResidentWorld } from '@wildshard/game/shardfile/hybrid';
import { parseGrappleProfile, type GrappleRows } from '@wildshard/format/grapple';
import { declaredRuntimeEntry } from '@wildshard/game/shard/declaredEntry';
import { installDeclaredMelee, type DeclaredMelee } from '@wildshard/game/loadout/declaredMelee';
import { ItemCatalogue } from '@wildshard/game/plugin/nativeItems';
import { bindRuntimeEquipment, bindRuntimeItems, bindRuntimeLedger, projectRuntimeFacts } from '@wildshard/game/plugin/headless';
import { Group, type PerspectiveCamera } from 'three';
import { GrappleTool } from '@wildshard/game/grapple/tool';
import grappleProfile from './data/grappleProfile.json' with { type: 'json' };
import type { ShardContext } from '@wildshard/game/shard/context';
import { ShardPlugin, worldBuildYield } from '@wildshard/game/shard/plugin';
import { type NineDragonWorld, buildNineDragonWorld } from './world/build';
import worldInstall from './world/install.generated.json' with { type: 'json' };
import type { GeometryBoot } from './runtime/productSections.generated';
import { readColliderRows } from '@wildshard/engine/models/colliders';
import { WorldEntry } from '@wildshard/game/shardfile/worldEntry';
import { TIER } from '@wildshard/engine/core/tier';
import { NdRuntime, ownNdRuntime } from './runtime/state';
import { installSpecimenLight } from './look/specimenLight';
import bootMetadata from './boot/metadata.generated.json' with { type: 'json' };
import { installPortalRide, type PortalRide, type PortalRideRows } from '@wildshard/game/shardfile/portalRideBinding';
import { lookGraphMaterials } from '@wildshard/game/plugin/shaderFamily';
import { lendLooks } from '@wildshard/sdk/looks/lentLooks';
import { installWorldScenes } from '@wildshard/game/shardfile/worldScenes';


/** beyond this far from the cell's centre (m) the player is out by the road-height decks (the fragment spans ~±80 m) */
const DECK_ZONE = 200;

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
    await prepareNinePost(render.renderer);
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
  override async kit(ctx: ShardContext): Promise<void> {
    // the jian: the declared melee primary on the wooden starter blade, at the held row's portrait field of view
    const view = await ctx.product.json<GrappleRows>('weapons/jian-row.json');
    this.melee = installDeclaredMelee(ctx, { item: 'weapon.jian', blade: 'wood', portraitFov: view.portraitFov });
    ctx.rows.tool(new ItemCatalogue(ctx.product.shardfile.items).equipment('tool.fei-zhua'));
  }
  override async play(ctx: ShardContext): Promise<void> {
    const equipment = ctx.app.equipment;
    if (equipment === null) throw new Error('Nine Dragon needs its loadout before play');
    if (this.melee === null) throw new Error('Nine Dragon needs its prebuilt Jian before play');
    const { primary: built, profile } = this.melee, primary = built();
    // G285: the feats (a ride into Lantern Square, the Fei Zhua's Well crossing) are ledger facts the page's laws report
    const facts = projectRuntimeFacts(bindRuntimeLedger(ctx, ctx.product.shardfile, ctx.product.slug), this.shell?.play?.progress);
    if (this.ndWorld === null) throw new Error('Grapple needs its constructed world');
    const grapple = new GrappleTool(ctx, { equipment: new ItemCatalogue(ctx.product.shardfile.items).equipment('tool.fei-zhua'), profile: parseGrappleProfile(grappleProfile),
      presentation: await ctx.product.json<GrappleRows>('weapons/jian-row.json'), hooks: this.ndWorld.ctx.hooks });
    this.grapple = grapple;
    const source = ctx.product.shardfile, items = source.items, tool = grapple.row;
    bindRuntimeEquipment(ctx, { ...source, items: { ...items, rows: items.rows.filter(row => row.kind === 'weapon'), loadout: { ...items.loadout, tools: [] } } },
      [{ id: primary.row.id, weapon: primary, profile }]);
    bindRuntimeItems(ctx, source, {
      kit: new Map([['melee', { kind: 'weapon', profiles: ['melee'], create: () => primary }]]),
      families: new Map([['nine-dragon-stack.fei-zhua', { kind: 'tool', presentation: { ui: tool.ui }, create: row => { grapple.row = { ...row, meta: tool.meta }; return grapple; } }]]),
      icon: name => { const row = [primary.row, tool].find(entry => entry.ui.icon === name); if (row === undefined) throw new Error(`Unknown Nine Dragon item icon ${name}`); return row.ui.icon; },
    });
    equipment.add(grapple, { locked: false });
    // G224: the deck portals to Lantern Square and the square's portal out (walk-in, a short fade, the checked transfer under the dark)
    if (this.shell?.world !== undefined && this.shell.world !== null) {
      const { portalRide } = await ctx.product.json<{ readonly portalRide: PortalRideRows }>('sim/headless-constants.json');
      this.portals = await installPortalRide(ctx, source, portalRide, (name, entity) => { facts(name, entity); });
    }
  }
  /** G224: the portals while they run (captures read them through the shard handle) */
  portals: PortalRide | null = null;
  private grapple: GrappleTool | null = null;
  private ndWorld: NineDragonWorld | null = null;
  private melee: DeclaredMelee | null = null;
  private shell: ShardContext['game']['runtime'];
  private readonly build: WorldBuilder;
  constructor(build: WorldBuilder = buildWorld) {
    super();
    this.build = build;
  }
  override async world(ctx: ShardContext): Promise<void> {
    const scope = ctx.scope;
    ctx.strings(bootMetadata.strings);
    this.shell = ctx.game.runtime;
    // the player stands on the road-height decks at the cell's edges as well as on the fragment: the whole cell is in
    // bounds; the fall net stays the fragment's own (its authored floor, Y0 − 100) under the fragment and drops to just
    // under the road only out by the decks (G224: you reach them by portal, never by a fall)
    const shell = this.shell;
    if (shell !== undefined) shell.hooks.levelBounds = (bounds) => bounds === undefined ? undefined : { x0: -250, x1: 250, z0: -250, z1: 250,
      get floor(): number { const p = shell.world?.player.position; return p !== undefined && Math.max(Math.abs(p.x), Math.abs(p.z)) > DECK_ZONE ? -20 : bounds.floor; } };
    const { world, camera } = await this.build(ctx, ctx.cube === null, () => worldBuildYield(ctx));
    if (scope.disposed) throw new Error('Nine Dragon was unloaded during its world build');
    const { world: worldRows } = await ctx.product.json<GeometryBoot>('geometry/layout.json');
    this.ndWorld = world;
    if (ctx.game.runtime !== undefined) ctx.game.runtime.objects['lanterns'] = world.lanterns;
    const rt = new NdRuntime(world, camera);
    ownNdRuntime(scope, rt);
    // the square's floors piece (world/scenes entry, G3): its colliders and floors over the world root, this ending's
    await WorldEntry.admit(ctx.product.section('world/scenes').entry, { root: world.root, tier: TIER, variant: world.entryCaps === true ? 'capped' : 'open', piece: (piece) => { ctx.piece(piece); } }).run('pieces');
    for (const { id, name, file, colliderOwner, colliders } of (world.entryCaps === true ? worldInstall.standalone : worldInstall.cell).filter(row => row.id !== 'nds-floors')) {
      ctx.piece({ id, name, file, ...(colliderOwner === undefined ? {} : { colliderOwner }), category: 'buildings', surface: 'stone',
        colliders: readColliderRows(colliders, { kinds: ['box', 'treads'], surfaces: ['stone'], requireSurface: true }),
        ...(id === 'nds-grapple-guard' ? { follows: new Group(), active: () => this.grapple?.guardOpen !== true } : {}),
      });
    }
    ctx.piece({ ...worldInstall.crossings, category: 'buildings', surface: 'stone', colliders: [...worldRows.crossings] });
    ctx.system({ id: 'shard.nd.world', phase: 'update', after: ['engine.player.update'], run: (_dt, t) => { rt.world.update(t, rt.camera); } });
    installSpecimenLight(ctx.app.events, scope, (on, key) => { rt.specimenLight(on, key); });
  }
}

const entry = declaredRuntimeEntry(NdPlugin, NdPlugin, {
  entry: 'runtime/index.ts', retainHomeRuntime: true, stagesOwner: 'declared', nativePlan: false,
});
export const resolveTrustedRuntime = entry.resolveTrustedRuntime;

// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default entry.default;
