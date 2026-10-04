/**
 * The grid session (SHARD-PLATFORM SF17b / SF18a / SF18b / SF21a, the grid client): what turns EXPERIMENTAL Wildshard's
 * home-cell boot into a 3 × 3 grid inside the one page. The home cell boots through the normal shard flow (its own
 * player, camera, HUD and the page's one fixed step); this session adds, around it, in the home cell's frame:
 *
 * - **the highway deck and strips**: `generatePlatform` (the pure SF17b generator) over the assembly, drawn as one mesh
 *   and installed as platform-owned trimesh colliders in the home world (the same vertices; `installStripCollider`).
 *   Every cell's edge rows come from its shard's own data (`edgeSources.ts` through `loadGridEdgeProfiles`, loaded once in
 *   `create`); the seams wear their materials by feature range (`seamLook.ts`).
 * - **render origin per cell** (C39): the home cell is the render origin; every other cell's root sits at its origin
 *   minus the home origin, and the rings get world positions (local + home origin).
 * - **neighbours as their declared fallback** (§3.3): no neighbour is a resident shardfile sim in the page yet, so each
 *   shows its baked far proxy (SF23) through the render rings (SF18b) and one residency allocator; its edge holds as a
 *   soft wall at the 6 m re-frame line (SF18d `ReadinessWalls`, closed while its sim is not ready). Step 2
 *   (`attach`, `liveSession.ts`) admits shardfile neighbours (the template copies) into regional hosts, opens their walls
 *   when ready and crosses the one page traveller at the fixed boundary; the rest stay closed until M3.
 *   The grid's outer rim is the outer road's shoulder: a glowing rail and closed walls, the VR void past it (G77 / G89).
 * - **cell events**: `gridCells.enter` while the player's feet are in the home cell's interior, `leave` on the deck
 *   (SF46's hybrid runtime runs only inside its cell).
 * - **legacy bounds yield** (SF17a): the session asks the level to leave out its chunk-edge walls and hide the edge
 *   veil (`gridLevel`), the bounds' horizontal check reads `grid`; fall recovery stays.
 */
import { BufferGeometry, Group, Mesh, type Material, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as v from 'valibot';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import { versionedUrl } from '@wildshard/engine/boot/bytes';
import type { LevelSpec } from '@wildshard/engine/level/spec';
import type { Scope } from '@wildshard/engine/app/scope';
import { app } from '@wildshard/engine/app/runtime';
import { harnessPins } from '@wildshard/engine/app/identity';
import type { Physics } from '@wildshard/engine/physics/Physics';
import { installEntrySockets } from '@wildshard/engine/physics/entrySockets';
import { installStripCollider } from '@wildshard/engine/physics/stripColliders';
import { ReadinessWalls, type ReadinessEdge } from '@wildshard/engine/physics/readinessWalls';
import { installGridBorders } from '@wildshard/engine/physics/gridBorders';
import { WATER_UNBOUNDED, waterExtent } from '@wildshard/engine/world/waves';
import type { Renderer } from '@wildshard/engine/render/renderer';
import { generatePlatform, type GeneratedStrip, type PlatformCell, type StripMesh } from '@wildshard/engine/sim/strips';
import { GridAssembly, type GridCell } from './assembly';
import { gridMode } from './menu';
import { devserverCellOn, gridOneFrameOn, installGridFrameRow } from './debug';
import { gridCells, pageGridInstance, pageMode } from './boot';
import { ResidencyAllocator } from './allocator';
import type { PageResidency } from './pageResidency';
import { PlatformRenderResidency } from './renderResidency';
import { RenderRings, levelPorts, type LevelPrepared, type RingPorts } from './rings';
import { farRingPorts, type FarPrepared } from './farView';
import type { FarLookRuntime } from './farProxy';
import { GridFrame, type GridFrameHost, type GridFrameState } from './frame';
import { installHazeBand } from './hazeBand';
import { LiveGridSession, type LiveGridPage, type LiveGridSessionState } from './liveSession';
import { gridShardfileProduct } from './products';
import { jsonResidentBytes } from '../shardfile/productCost';
import { RAIL_OFFSET, roadLayout } from './roadLayout';
import type { RoadLookState } from './roadLook';
import { installPlatformRoad } from './roadLookPlatform';
import { installSoftWallLook, type SoftWallState } from './softWallLook';
import type { SeamLookState } from './seamLook';
import { roadResident, roadViewCost, type CullPlan, type RoadResident, type RoadViewCost } from './roadCull';
import { loadGridEdgeProfiles } from './edgeProfiles';
import { readGridEdges } from './edgeSources';
import { findShard } from '../shard/registry';
import { TileDecoder } from './tileDecoder';
import { clientRingCatalogue, clientRingPorts, type ClientRingInstance, type PreparedRingTile } from '../shardfile/clientRings';
import { ClientAssets } from '../shardfile/clientAssets';
import { clientMaterials } from '../shardfile/clientMaterials';
import { clientTileViews, type ClientTileViews } from '../shardfile/clientViews';
import type { ClientSkin } from '../shardfile/clientSkins';
import { NeighbourLife, type NeighbourLifeCell } from './neighbourLife';
import { farMapImage } from './minimapBlend';
import { crossingSaveStatus, installBorderShimmer, type BorderShimmerState, type CrossingSaveStatus } from './borderShimmer';
import { GAME_STRINGS } from '../strings';

/** In grid mode the level's own chunk-edge walls and veil yield to the platform (the standalone path is unchanged). */
export function gridLevel(spec: LevelSpec): LevelSpec {
  if (pageMode() !== 'grid') return spec;
  return { ...spec, boundary: { ...spec.boundary, visible: false, walls: false } };
}

/** What the session reads from the page: the player's feet in the home frame, the scene, the world, the fixed step. */
export interface GridSessionHost {
  /** The owner's allocator already includes the home before this late play-stage session constructs the platform. */
  readonly residency?: PageResidency;
  readonly scene: Object3D;
  readonly physics: Physics;
  readonly scope: Scope;
  readonly feet: () => { readonly x: number; readonly y: number; readonly z: number };
  /** Register once per fixed step (the page's one fixed step; never a second loop). */
  readonly onFixed: (fn: (dt: number) => void) => void;
  /** SF19a's one frame: the camera, composer and grade effects, and the page's late phase (absent: never built) */
  readonly frame?: GridFrameHost & { readonly onLate: (fn: (dt: number) => void) => void };
  /** the page's renderer: shardfile neighbours' ring tiles compile their materials on it (absent: neighbours stay far proxies) */
  readonly renderer?: Renderer;
}
/** What each cell shows today, for the readout and the report. */
export type GridCellShows = 'playing' | 'frozen' | 'far proxy' | 'loading';
/** The session's readout (tests, harness, the board). */
export interface GridSessionState {
  readonly home: string; readonly inside: string | null; readonly feet: { x: number; z: number };
  readonly cells: readonly { readonly instance: string; readonly slug: string; readonly cell: readonly [number, number]; readonly shows: GridCellShows }[];
  readonly strips: number; readonly ringsReady: boolean;
  /** SF17b's boulevard look: segments, junctions, roundabouts, signs, lights and draws */
  readonly road: RoadLookState;
  /** the seams' materials: triangles and draws per material (phase 2, G90 / G91 / G101) */
  readonly seams: SeamLookState;
  /** G85's soft walls: how many edges are closed and which shard's loading panel shows (null: none in range) */
  readonly softWalls: SoftWallState;
  /** G78's border shimmer and G119's save panel (status null: no panel up) */
  readonly shimmer: BorderShimmerState;
  /** the allocator's grid content (MB) and the §3.2 playing total with the engine base (MB, the 1.0 GB envelope, G65) */
  readonly residentMB: number; readonly playingMB: number;
  readonly rings: { readonly far: number; readonly l1: number; readonly l0: number; readonly refused: number };
  /** SF19a's one frame (null with its Debug row off) */
  readonly frame: GridFrameState | null;
  /** step 2's live crossing (null until the page attaches its player) */
  readonly live: LiveGridSessionState | null;
  /** SF25 / G66: each shardfile neighbour's client-script life (frozen cells breathe and graze) */
  readonly life: readonly NeighbourLifeCell[];
}

/** The shardfile neighbours' L1 / L0 tiles (sources load late: until then the catalogue has no tile and the far proxy draws). */
function neighbourTiles(scope: Scope): { instances: Map<string, ClientRingInstance>; ports: RingPorts<PreparedRingTile> } {
  const instances = new Map<string, ClientRingInstance>(), decoder = new TileDecoder();
  scope.onDispose(() => { decoder.dispose(); });
  return { instances, ports: clientRingPorts(instances, { scope, decoder }) };
}

/** The far proxy and its row, fetched from the shard's baked folder (`public/assets/baked/<slug>/far.*`). */
async function loadFar(slug: string): Promise<{ prepared: FarPrepared; bytes: number }> {
  const base = `/assets/baked/${slug}/far`;
  const response = await fetch(versionedUrl(`${base}.json`));
  if (!response.ok) throw new Error(`far.json ${slug}: ${String(response.status)}`);
  const row: unknown = await response.json();
  const look = farLook(row), bytes = farBytes(row);
  const gltf = await new GLTFLoader().loadAsync(versionedUrl(`${base}.glb`));
  const meshes: BufferGeometry[] = [];
  gltf.scene.traverse((node) => { if (!(node instanceof Mesh)) return; const found: unknown = node.geometry; if (found instanceof BufferGeometry) meshes.push(found as BufferGeometry); });
  const geometry = meshes[0];
  if (geometry === undefined) throw new Error(`far.glb ${slug}: no mesh`);
  return { prepared: { geometry, look }, bytes };
}
const num = v.pipe(v.number(), v.finite());
/** The part of `far.json` the client reads: the resident cost and the look (the bake writes more). */
const FarRow = v.object({ far: v.object({ gpu: num, decoded: num }),
  look: v.object({ family: v.picklist(['toon', 'painterly', 'pbr']), haze: v.object({ colour: v.tuple([num, num, num]), near: num, far: num, max: num }),
    grade: v.optional(v.object({ exposure: num, saturation: num, contrast: num, tint: v.optional(v.tuple([num, num, num])) })),
    band: v.optional(v.object({ colour: v.tuple([num, num, num]), height: num, opacity: num, own: num })) }) });
function farLook(row: unknown): FarLookRuntime { return v.parse(FarRow, row).look; }
function farBytes(row: unknown): number { const { far } = v.parse(FarRow, row); return Math.round(far.gpu + far.decoded); }

/** A neighbour's four soft walls on the 6 m re-frame line, in the frame whose origin is given (`ReadinessWalls` edges). */
function neighbourEdges(cell: GridCell, home: Readonly<{ origin: Readonly<{ x: number; z: number }> }>): ReadinessEdge[] {
  const x = cell.origin.x - home.origin.x, z = cell.origin.z - home.origin.z, r = CHUNK_HALF + 6, halfLength = CHUNK_HALF + 6;
  const edge = (ex: number, ez: number, axis: 'x' | 'z'): ReadinessEdge => ({ instance: cell.instance, x: ex, z: ez, axis, halfLength, floor: 0 });
  return [edge(x + r, z, 'x'), edge(x - r, z, 'x'), edge(x, z + r, 'z'), edge(x, z - r, 'z')];
}
/** The closed outer rim on the outer road's shoulder: the void's rail (G89; the empty neighbour has no sim to wait for). */
function rimEdges(assembly: GridAssembly, home: Readonly<{ origin: Readonly<{ x: number; z: number }> }>): ReadinessEdge[] {
  const xs = assembly.cells.map((c) => c.cell[0]), zs = assembly.cells.map((c) => c.cell[1]), p = assembly.pitch;
  const minX = Math.min(...xs) * p - p / 2 - RAIL_OFFSET, maxX = Math.max(...xs) * p + p / 2 + RAIL_OFFSET, minZ = Math.min(...zs) * p - p / 2 - RAIL_OFFSET, maxZ = Math.max(...zs) * p + p / 2 + RAIL_OFFSET;
  const cx = (minX + maxX) / 2 - home.origin.x, cz = (minZ + maxZ) / 2 - home.origin.z, hx = (maxX - minX) / 2, hz = (maxZ - minZ) / 2;
  return [
    { instance: null, x: minX - home.origin.x, z: cz, axis: 'x', halfLength: hz, floor: 0 }, { instance: null, x: maxX - home.origin.x, z: cz, axis: 'x', halfLength: hz, floor: 0 },
    { instance: null, x: cx, z: minZ - home.origin.z, axis: 'z', halfLength: hx, floor: 0 }, { instance: null, x: cx, z: maxZ - home.origin.z, axis: 'z', halfLength: hx, floor: 0 },
  ];
}

/** The live grid session. Installed only in grid page mode; disposed with the level scope. */
export class GridSession {
  readonly assembly: GridAssembly;
  readonly home: GridCell;
  readonly allocator: ResidencyAllocator;
  private readonly rings: RenderRings<LevelPrepared<FarPrepared, PreparedRingTile>>;
  private readonly neighbours: readonly GridCell[];
  private readonly costs = new Map<string, number>();
  /** G107: each loaded neighbour's top-down minimap raster (its far proxy, drawn once) */
  private readonly mapImages = new Map<string, HTMLCanvasElement>();
  private readonly strips: readonly GeneratedStrip[];
  private readonly host: GridSessionHost;
  private last: { x: number; z: number } | null = null;
  private velocity = { x: 0, z: 0 };
  private readonly frame: GridFrame | null;
  private readonly walls: ReadinessWalls;
  private live: LiveGridSession | null = null;
  private readonly road: RoadLookState;
  private readonly seams: SeamLookState;
  private readonly roadPlans = new Map<Mesh, CullPlan>();
  private readonly roadBudget: { readonly view: () => RoadViewCost | null; readonly resident: () => RoadResident };
  private readonly life: NeighbourLife;
  private readonly softWalls: { readonly step: () => void; readonly state: () => SoftWallState };
  private readonly shimmer: { readonly step: () => void; readonly state: () => BorderShimmerState };

  /** Load every cell's edge rows (`loadGridEdgeProfiles` over the shards' own data), then build the session. */
  static async create(host: GridSessionHost): Promise<GridSession> {
    const allocator = host.residency?.allocator ?? new ResidencyAllocator();
    const assembly = new GridAssembly(gridMode(devserverCellOn())), empty = assembly.emptyNeighbour.edge;
    const edges = await loadGridEdgeProfiles(assembly.cells, async (cell) => {
      try {
        const edge = await readGridEdges(cell, { product: slug => gridShardfileProduct(slug, { allocator, scope: host.scope }), fetch: url => fetch(url) });
        const claim = allocator.reserve({ id: `product:grid:edge:${cell.instance}`, category: 'product', owner: cell.instance, bytes: jsonResidentBytes(edge), distance: 0, needed: true });
        if (claim === null) throw new Error('Grid edge metadata residency deferred');
        host.scope.onDispose(() => { claim.release(); }); return edge;
      } catch (error) {
        console.warn(`[grid] ${cell.instance} edges stay at road level:`, error);
        const closed = { entryWidth: 0 };
        return { kind: 'declared', profiles: { north: empty, east: empty, south: empty, west: empty }, observations: { north: closed, east: closed, south: closed, west: closed } };
      }
    });
    return new GridSession(host, edges, allocator);
  }

  constructor(host: GridSessionHost, edges?: readonly PlatformCell[], allocator?: ResidencyAllocator) {
    this.host = host;
    this.allocator = host.residency?.allocator ?? allocator ?? new ResidencyAllocator();
    const instance = pageGridInstance();
    this.assembly = new GridAssembly(gridMode(devserverCellOn()));
    if (instance === null) throw new Error('A grid session needs a grid page');
    this.home = this.assembly.cell(instance);
    const home = this.home, empty = this.assembly.emptyNeighbour.edge;
    this.neighbours = this.assembly.cells.filter((cell) => cell.instance !== home.instance);
    // the deck: one generator run, one draw, the same vertices as the platform colliders
    // the shards' real edge rows and observations (loaded once by `create`, before this one generation); a platform the
    // generator refuses (an edge past the cliff envelope, an entry off road height) falls back to road-level edges
    const flat = this.assembly.cells.map((cell): PlatformCell => ({ instance: cell.instance, cell: cell.cell, origin: { x: cell.origin.x, z: cell.origin.z },
      edges: { north: empty, east: empty, south: empty, west: empty } }));
    let strips: readonly GeneratedStrip[];
    try { strips = generatePlatform(edges ?? flat, empty); } catch (error) { console.warn('[grid] the platform keeps road-level edges:', error); strips = generatePlatform(flat, empty); }
    this.strips = strips;
    // SF19a: one frame for the grid, behind its Debug row (default off; applies at the next grid start)
    host.scope.onDispose(installGridFrameRow());
    const frameHost = host.frame;
    // G158: the shard the player stands in owns the whole frame, the road look owns the road, blended at the cell edge
    this.frame = frameHost !== undefined && gridOneFrameOn() ? new GridFrame({ host: frameHost, scope: host.scope, home, half: CHUNK_HALF, feet: () => this.world(),
      cells: this.assembly.cells.map((cell) => ({ instance: cell.instance, origin: { x: cell.origin.x, z: cell.origin.z } })) }) : null;
    const frame = this.frame;
    // SF17b look: the boulevard over the deck's road band (G80 / G81 / G93) and the VR void past the outer road (G89)
    const layout = roadLayout(this.assembly, (slug) => findShard(slug)?.name ?? slug);
    // The early owner exists only for the boot-selected Grid memory admission variant. Row OFF keeps the old build;
    // ON admits each exact CPU/GPU byte plan before its render allocation, on the same home/region/ring allocator.
    const admission = host.residency === undefined ? undefined : new PlatformRenderResidency(this.allocator, host.scope);
    const platformRoad = installPlatformRoad({ strips: this.strips, home, pitch: this.assembly.pitch, layout,
      scene: host.scene, scope: host.scope, camera: () => host.frame?.camera, plans: this.roadPlans,
      ...(admission === undefined ? {} : { admission }) });
    this.road = platformRoad.road; this.seams = platformRoad.seams;
    // SF17b's per-view road budget (§3.2, G101): what the view camera draws of the road system, and what stays resident
    const roadRoots = platformRoad.roots;
    this.roadBudget = { view: () => { const camera = host.frame?.camera; return camera === undefined ? null : roadViewCost(roadRoots, camera, this.roadPlans); }, resident: () => roadResident(roadRoots, this.roadPlans) };
    // G85: a closed neighbour edge shows as a cyan hex shimmer with a loading panel where the traveller would cross
    this.softWalls = installSoftWallLook({ scene: host.scene, scope: host.scope, time: () => app.clock.now,
      edges: this.neighbours.flatMap((cell) => neighbourEdges(cell, home).map((edge) => ({ instance: cell.instance, x: edge.x, z: edge.z, axis: edge.axis, halfLength: edge.halfLength }))),
      ports: { closed: (id) => this.live === null || !this.live.live.ready(id), feet: () => { const at = this.world(); return { x: at.x - home.origin.x, z: at.z - home.origin.z }; },
        name: (id) => { const slug = this.assembly.cell(id).slug; return findShard(slug)?.name ?? slug; } } });
    // G78: a shimmer line at every shard border on its real ground; G119: SAVING… / SAVE FAILED, RETRY while a crossing waits
    const rows = new Map((edges ?? []).map((cell) => [cell.instance, cell.edges]));
    let status: CrossingSaveStatus = null, polled = 0;
    this.shimmer = installBorderShimmer({ scene: host.scene, scope: host.scope, time: () => app.clock.now,
      cells: this.assembly.cells.map((cell) => ({ x: cell.origin.x - home.origin.x, z: cell.origin.z - home.origin.z, edges: rows.get(cell.instance) ?? null })),
      ports: { feet: () => { const at = this.world(); return { x: at.x - home.origin.x, z: at.z - home.origin.z }; },
        status: () => { if (++polled % 4 === 0) status = this.live?.state().reloadStatus ?? crossingSaveStatus(this.live?.state().crossing); return status; },
        text: (shown) => (shown === 'saving' ? GAME_STRINGS.grid.saving : GAME_STRINGS.grid.saveFailed) } });
    for (const { mesh } of this.strips) installStripCollider(host.physics, this.rebased(mesh), host.scope);
    // The normal world stage owns the home's sockets; this scope adds only rebased neighbours.
    installEntrySockets(host.physics, host.scope, this.neighbours.map((cell) => ({ x: cell.origin.x - home.origin.x, z: cell.origin.z - home.origin.z })));
    this.walls = new ReadinessWalls(host.physics, [...this.neighbours.flatMap((cell) => neighbourEdges(cell, home)), ...rimEdges(this.assembly, home)], host.scope); // synced open by the live host once a neighbour is ready
    installGridBorders(host.physics, host.scope); // the home cell's creatures stay home (SF20d)
    // G72, one landmass: the home level's open water stays inside its own cell (its sea surface and its swell body)
    waterExtent.uWaterHalf.value = CHUNK_HALF;
    host.scope.onDispose(() => { waterExtent.uWaterHalf.value = WATER_UNBOUNDED; });
    // neighbours: the far ring through the one allocator; each cell's root sits at its render origin
    const roots = new Map<string, Group>();
    for (const cell of this.neighbours) {
      // G164: a shard whose whole world is shifted vertically at runtime (its terrain field's `datum`, Driftwood's hybrid row)
      // shows its baked far proxy shifted by the same amount, as its own bake installs; absent, the root sits at road height
      const root = new Group(); root.name = `grid-cell:${cell.instance}`; root.position.set(cell.origin.x - home.origin.x, findShard(cell.slug)?.ground.terrain?.datum ?? 0, cell.origin.z - home.origin.z);
      root.updateMatrixWorld(); host.scene.add(root); roots.set(cell.instance, root);
    }
    const far = farRingPorts({
      root: (id) => { const root = roots.get(id); if (root === undefined) throw new Error(`No grid cell root ${id}`); return root; },
      load: async (id) => {
        const { prepared, bytes } = await loadFar(this.assembly.cell(id).slug); this.costs.set(id, bytes); frame?.declare(id, prepared.look);
        if (!this.mapImages.has(id)) { const image = farMapImage(prepared.geometry); if (image !== null) this.mapImages.set(id, image); }
        return prepared;
      },
    });
    const farPorts = frame === null ? far : { ...far, upload: (tile: { instance: string }, data: FarPrepared) => {
      const band = data.look.band, view = far.upload(tile, data), untag = frame.proxy(view), dispose = view.dispose;
      // SF19b (G94 / G95): a shard that declares a band shows its mood at its border from the road; inside its cell it owns the frame (G158)
      const root = roots.get(tile.instance), unband = band === undefined || root === undefined ? () => undefined : installHazeBand(root, band, CHUNK_HALF);
      view.dispose = () => { unband(); untag(); dispose(); };
      return view;
    } };
    // SF25 / G66: frozen neighbours look alive (presentation-only client scripts; their sims never step here)
    this.life = new NeighbourLife({ scope: host.scope, simulation: (id) => this.live?.simulation(id), active: (id) => (this.live === null ? this.home.instance : this.live.live.current()) === id });
    // one late system for the grid (the page's onLate takes one label): the alive neighbours, then the one frame's weights
    host.frame?.onLate((dt) => { this.life.late(dt); frame?.frame(); });
    const tiles = neighbourTiles(host.scope), tileCost = clientRingCatalogue(tiles.instances);
    this.rings = new RenderRings(this.neighbours, this.allocator, (id, level, x, z) => (level === 'far' ? this.costs.get(id) ?? 1_600_000 : tileCost(id, level, x, z)),
      levelPorts<FarPrepared, PreparedRingTile>(farPorts, tiles.ports));
    if (host.renderer !== undefined) void this.admitTiles(host.renderer, roots, tiles.instances);
    host.scope.onDispose(() => {
      this.rings.dispose();
      for (const root of roots.values()) root.removeFromParent();
    });
    host.onFixed((dt) => { this.step(dt); this.life.fixed(); });
    host.scope.onDispose(app.debug.scopedExpose('grid', { state: () => this.state(), roadView: () => this.roadBudget.view(), roadResident: () => this.roadBudget.resident(),
      ...(harnessPins() === undefined ? {} : { simulation: (instanceId: string) => this.live?.simulation(instanceId) }),
    }));
  }

  /**
   * The shardfile neighbours' ground through their own ring tiles (SF18b's `clientRingPorts`): one admitted product, asset
   * reader, material set and view set per slug (the template copies share them), each cell its own root. A neighbour that
   * fails to admit keeps its far proxy.
   */
  private async admitTiles(renderer: Renderer, roots: ReadonlyMap<string, Group>, instances: Map<string, ClientRingInstance>): Promise<void> {
    const scope = this.host.scope, skins = new Map<string, Promise<ReadonlyMap<string, ClientSkin>>>();
    const shared = new Map<string, Promise<{ source: ClientRingInstance['source']; assets: ClientAssets; views: ClientTileViews; bytes: ReadonlyMap<string, Uint8Array>; compile: (entry: unknown) => Material }>>();
    for (const cell of this.neighbours) {
      const root = roots.get(cell.instance); if (root === undefined) continue;
      let loading = shared.get(cell.slug);
      if (loading === undefined) {
        const product = gridShardfileProduct(cell.slug, { allocator: this.allocator, scope });
        if (product === null) continue;
        loading = (async () => {
          const retained = await product, { admitted, options } = retained, source = admitted.source;
          try {
            if (scope.disposed) throw new Error('Grid product view disposed during admission');
            scope.onDispose(retained.release);
            const presentation = await clientMaterials(source, admitted.assets, renderer, scope);
            return { source, assets: new ClientAssets(source, admitted.assets, options), views: clientTileViews({ terrain: source.terrain?.family ?? null, ...presentation }), bytes: admitted.assets, compile: presentation.compile };
          } catch (error) { retained.release(); throw error; }
        })();
        shared.set(cell.slug, loading);
      }
      try {
        const { source, assets, views, bytes, compile } = await loading;
        if (scope.disposed) return;
        if (source.tiles.length > 0) instances.set(cell.instance, { source, assets, root, views });
        try { await this.life.admit(cell, root, source, bytes, compile, skins); } catch (error) { console.warn(`[grid] ${cell.instance} stays still (client scripts):`, error); }
      } catch { /* the far proxy stays the neighbour's fallback */ }
    }
  }

  /** Step 2: the live crossing, once the page's player health and equipment exist (play.ts). */
  attach(page: LiveGridPage): LiveGridSession {
    if (this.live !== null) throw new Error('The grid session already has its live crossing');
    this.live = new LiveGridSession({ assembly: this.assembly, home: this.home, physics: this.host.physics, scope: this.host.scope, walls: this.walls, strips: this.strips, allocator: this.allocator,
      ...(this.host.residency === undefined ? {} : { residency: this.host.residency.home() }),
      neighbourEdges: (cell, origin) => neighbourEdges(cell, { origin }), rimEdges: (origin) => rimEdges(this.assembly, { origin }) }, page);
    return this.live;
  }

  private rebased(mesh: StripMesh): StripMesh { return { ...mesh, origin: { x: mesh.origin.x - this.home.origin.x, z: mesh.origin.z - this.home.origin.z } }; }
  /** G107: a neighbour's top-down minimap raster once its far proxy has loaded (null before, or for the home) */
  mapImage(instance: string): HTMLCanvasElement | null { return this.mapImages.get(instance) ?? null; }
  /** The traveller's feet in grid metres, whatever frame it is in. */
  worldFeet(): { x: number; z: number } { return this.world(); }

  /** World feet (grid metres) from the home-frame feet. */
  private world(): { x: number; z: number } {
    if (this.live !== null) { const feet = this.live.worldFeet(); return { x: feet.x, z: feet.z }; }
    const feet = this.host.feet(); return { x: feet.x + this.home.origin.x, z: feet.z + this.home.origin.z };
  }

  /** One fixed step: the rings from the player's world pose and velocity, then the cell events. */
  step(dt: number): void {
    const at = this.world();
    if (this.last !== null && dt > 0) { this.velocity = { x: (at.x - this.last.x) / dt, z: (at.z - this.last.z) / dt }; }
    this.last = at;
    const speed = Math.hypot(this.velocity.x, this.velocity.z), clamp = speed > 60 ? 60 / speed : 1; // a respawn's jump is not a velocity
    this.rings.step({ x: at.x, z: at.z, vx: this.velocity.x * clamp, vz: this.velocity.z * clamp });
    this.softWalls.step();
    this.shimmer.step();
    const inside = this.assembly.at(at.x, at.z), active = this.live === null ? this.home.instance : this.live.live.current();
    if (inside === undefined || inside.instance !== active) gridCells.leave();
    else gridCells.enter({ instance: inside.instance, slug: inside.slug });
  }

  /** every visible neighbour is drawn now (the entry reveal's readiness, G98) */
  ringsReady(): boolean { return this.rings.ready(); }

  /** Hold the loading screen until every visible neighbour is drawn (or the time limit: the soft walls hold anyway). */
  async ready(limitMs = 20_000): Promise<boolean> {
    for (let waited = 0; ; waited += 16) {
      this.step(1 / 60);
      if (this.rings.ready()) return true;
      if (waited > limitMs) return false;
      await new Promise<void>((resolve) => { this.host.scope.timeout(16, resolve); });
    }
  }

  /** The readout: what each cell shows, the rings and the allocator. */
  state(): GridSessionState {
    const stats = this.rings.stats(), resident = new Set(this.rings.resident().map((key) => key.split(':')[0]));
    const at = this.world(), cost = this.allocator.cost();
    return {
      home: this.home.instance, inside: gridCells.cell?.instance ?? null, feet: { x: Math.round(at.x * 100) / 100, z: Math.round(at.z * 100) / 100 },
      cells: this.assembly.cells.map((cell) => ({ instance: cell.instance, slug: cell.slug, cell: cell.cell,
        shows: cell.instance === (this.live === null ? this.home.instance : this.live.live.current()) ? 'playing' : cell.instance === this.home.instance ? 'frozen' : resident.has(cell.instance) ? 'far proxy' : 'loading' })),
      strips: this.strips.length, road: this.road, seams: this.seams, softWalls: this.softWalls.state(), shimmer: this.shimmer.state(), ringsReady: this.rings.ready(),
      residentMB: Math.round(cost.accounted / 1e4) / 100, playingMB: Math.round(cost.playing / 1e4) / 100,
      rings: { far: stats.resident.far, l1: stats.resident.l1, l0: stats.resident.l0, refused: stats.refused },
      frame: this.frame?.state() ?? null,
      live: this.live?.state() ?? null,
      life: this.life.state(),
    };
  }
}
