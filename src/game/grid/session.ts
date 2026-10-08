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
import { CHUNK_HALF, CONTENT_CAPS, ENTRY_WIDTH } from '@wildshard/engine/core/config';
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
import { generatePlatform, type GeneratedStrip, type PlatformCell } from '@wildshard/engine/sim/strips';
import { GridAssembly, type GridCell } from './assembly';
import { gridMode } from './menu';
import { devserverCellOn } from './debug';
import { gridCells, pageGridInstance, pageMode } from './boot';
import type { ResidencyAllocator } from './allocator';
import type { PageResidency } from './pageResidency';
import { PlatformRenderAdmissionError, PlatformRenderResidency } from './renderResidency';
import { RenderRings, levelPorts, type LevelPrepared, type RingPorts } from './rings';
import { farRingPorts, type FarPrepared, type FarProxyView } from './farView';
import { bindCellCover, cellCoverPort } from './cellCover';
import type { FarLookRuntime } from './farProxy';
import { GridFrame, type GridFrameHost, type GridFrameState } from './frame';
import { installHazeBand } from './hazeBand';
import { LiveGridSession, type LiveGridPage, type LiveGridSessionState } from './liveSession';
import { gridShardfileProduct } from './products';
import { jsonResidentBytes } from '../shardfile/productCost';
import { RAIL_OFFSET, roadLayout } from './roadLayout';
import type { RoadLookState } from './roadLook';
import { installPlatformRoad } from './roadLookPlatform';
import { collisionStrips, type CollisionMesh, type CollisionStrip } from './collisionStrips';
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
import { NeighbourPanels } from './neighbourPanels';
import { copyMarks } from './copyIdentity';
import { CellMinimaps } from './minimapBlend';
import { bakedMapUrl } from '../shard/manifest';
import { crossingSaveStatus, installBorderShimmer, type BorderShimmerState, type CrossingSaveStatus } from './borderShimmer';
import { GAME_STRINGS } from '../strings';
import { GridCellWaitingError, classifyRefusal, pageShardRefusals, type FarViewStatus, type ShardRefusal } from './refusal';
import { cellScreenStatus, installCellScreens, type CellScreenInput, type CellScreensState } from './cellScreen';
import { installOpenPlots, openPlotColliders, type OpenPlotState } from './openPlot';
import type { MemoryAdmissionWarning } from './memoryAdmission';
import { TIER } from '@wildshard/engine/core/tier';

declare const __BUILD_ID__: string; // vite.config.ts define; absent under Node

/**
 * In grid mode the level's own chunk-edge walls and veil yield to the platform, and so does its own horizon (G99: every
 * shard is a 500 m cube; a level's horizon rings and cloud sea stand past it, over the road and the neighbours, whose
 * far views are the grid's horizon now). A level without its own horizon keeps the engine's (the painted strips at
 * infinity, the default ridges past the grid's outer road). The standalone path is unchanged.
 */
export function gridLevel(spec: LevelSpec): LevelSpec {
  if (pageMode() !== 'grid') return spec;
  return { ...spec, boundary: { ...spec.boundary, visible: false, walls: false }, ...(spec.horizon === undefined ? {} : { horizon: { rings: [], cloudSea: false } }) };
}

/** What the session reads from the page: the player's feet in the home frame, the scene, the world, the fixed step. */
export interface GridSessionHost {
  /** The root world is neutral highway physics; the initial home is admitted as an owned regional runtime. */
  readonly ownedHome?: boolean;
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
  /** G85's soft walls: how many edges are closed */
  readonly softWalls: SoftWallState;
  /** G78's border shimmer and G119's save panel (status null: no panel up) */
  readonly shimmer: BorderShimmerState;
  /** G217: the cells you can't enter that wear the full loading screen now, and its redraw count */
  readonly screens: CellScreensState;
  /** G198 / G219: the open plots (their showrooms' ideas, which are drawn, their draws and triangles) */
  readonly plots: OpenPlotState;
  /** the allocator's grid content (MB) and the §3.2 playing total with the engine base (MB, the 1.0 GB envelope, G65) */
  readonly residentMB: number; readonly playingMB: number;
  /** Exact category sum before engine base, overlap allowance or calibration factor; used by the soak harness. */
  readonly accountedBytes: number;
  readonly rings: { readonly far: number; readonly l1: number; readonly l0: number; readonly refused: number; readonly inFlight: number; readonly queued: number };
  /** SF19a's one frame (null for a host with no frame: no camera / composer) */
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
  const response = await fetch(versionedUrl(`/assets/baked/${slug}/far.json`));
  if (!response.ok) throw new Error(`far.json ${slug}: ${String(response.status)}`);
  const row: unknown = await response.json();
  const look = farLook(row), bytes = farBytes(row);
  const gltf = await new GLTFLoader().loadAsync(versionedUrl(`/assets/baked/${slug}/far.glb`));
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
  /** G107 / SF66: each shard's baked map, downscaled once and shared by all its copies. */
  private readonly mapImages: CellMinimaps;
  private readonly strips: readonly CollisionStrip[];
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
  /** G222 playtest #7: each neighbour's declared doors and gates, shown exactly when its region has them standing */
  private readonly panels: NeighbourPanels;
  private readonly softWalls: { readonly step: () => void; readonly state: () => SoftWallState };
  private readonly shimmer: { readonly step: () => void; readonly state: () => BorderShimmerState };
  /** G167: why a neighbour's shard can't load (its product refused, with the admission's message) and its far view's status */
  private readonly refusals = new Map<string, ShardRefusal>();
  private readonly issues = new Map<string, string>();
  private readonly farViews = new Set<string>();
  private readonly farMissing = new Set<string>();
  /** each slug's shown name */
  private readonly names = new Map<string, string>();
  /** G217: the full loading screen on every cell you can't enter */
  private readonly screens: { readonly step: () => void; readonly state: () => CellScreensState };
  /** G198 / G219: the open plots, platform ground with four entry showrooms and a centrepiece each */
  private readonly plots: { readonly step: (dt: number) => void; readonly state: () => OpenPlotState };

  /** Load every cell's edge rows (`loadGridEdgeProfiles` over the shards' own data), then build the session. */
  static async create(host: GridSessionHost): Promise<GridSession> {
    if (host.residency === undefined) throw new Error('Grid session requires the early page residency owner');
    const allocator = host.residency.allocator;
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
    this.mapImages = new CellMinimaps(host.scope, (slug) => bakedMapUrl(findShard(slug)?.minimap?.image));
    const residency = host.residency;
    if (residency === undefined) throw new Error('Grid session requires the early page residency owner');
    if (allocator !== undefined && allocator !== residency.allocator) throw new Error('Grid session must share the page allocator');
    this.allocator = residency.allocator;
    const instance = pageGridInstance();
    this.assembly = new GridAssembly(gridMode(devserverCellOn()));
    if (instance === null) throw new Error('A grid session needs a grid page');
    this.home = this.assembly.cell(instance);
    const home = this.home, empty = this.assembly.emptyNeighbour.edge;
    this.neighbours = this.assembly.cells.filter((cell) => host.ownedHome === true || cell.instance !== home.instance);
    for (const cell of this.assembly.cells) { const manifest = findShard(cell.slug); this.names.set(cell.slug, manifest?.name ?? cell.slug); }
    // the deck: one generator run, one draw, the same vertices as the platform colliders
    // the shards' real edge rows and observations (loaded once by `create`, before this one generation); a platform the
    // generator refuses (an edge past the cliff envelope, an entry off road height) falls back to road-level edges
    const flat = this.assembly.cells.map((cell): PlatformCell => ({ instance: cell.instance, cell: cell.cell, origin: { x: cell.origin.x, z: cell.origin.z },
      edges: { north: empty, east: empty, south: empty, west: empty } }));
    // G198: an open plot is road-level platform ground with an open entry on all four sides (its showroom faces each one)
    const entry = { entryWidth: ENTRY_WIDTH, geometry: 'ground' } as const;
    const plots = this.assembly.plots.map((plot): PlatformCell => ({ instance: plot.instance, cell: plot.cell, origin: { x: plot.origin.x, z: plot.origin.z },
      edges: { north: empty, east: empty, south: empty, west: empty }, observations: { north: entry, east: entry, south: entry, west: entry } }));
    let strips: readonly GeneratedStrip[];
    try { strips = generatePlatform([...(edges ?? flat), ...plots], empty); } catch (error) { console.warn('[grid] the platform keeps road-level edges:', error); strips = generatePlatform([...flat, ...plots], empty); }
    // SF19a / G158 (on for everyone since Jake's G175 pick, E450): the shard the player stands in owns the whole frame, the
    // road look owns the road, blended over 16 m at the cell edge; a host with no camera / composer builds none
    const frameHost = host.frame;
    this.frame = frameHost !== undefined ? new GridFrame({ host: frameHost, scope: host.scope, home, homeIsFrame: host.ownedHome !== true, half: CHUNK_HALF, feet: () => this.world(),
      cells: this.assembly.cells.map((cell) => ({ instance: cell.instance, origin: { x: cell.origin.x, z: cell.origin.z } })) }) : null;
    const frame = this.frame;
    // SF17b look: the boulevard over the deck's road band (G80 / G81 / G93) and the VR void past the outer road (G89)
    const layout = roadLayout(this.assembly, (slug) => findShard(slug)?.name ?? slug);
    // G112: every grid admits exact CPU/GPU byte plans on its early home/region/ring allocator.
    const admission = new PlatformRenderResidency(this.allocator, host.scope);
    const platformRoad = installPlatformRoad({ strips, home, pitch: this.assembly.pitch, layout,
      scene: host.scene, scope: host.scope, camera: () => host.frame?.camera, plans: this.roadPlans,
      admission });
    this.strips = collisionStrips(strips);
    this.road = platformRoad.road; this.seams = platformRoad.seams;
    // SF17b's per-view road budget (§3.2, G101): what the view camera draws of the road system, and what stays resident
    const roadRoots = platformRoad.roots;
    this.roadBudget = { view: () => { const camera = host.frame?.camera; return camera === undefined ? null : roadViewCost(roadRoots, camera, this.roadPlans); }, resident: () => roadResident(roadRoots, this.roadPlans) };
    // G85: a closed neighbour edge shows as a cyan hex shimmer
    this.softWalls = installSoftWallLook({ scene: host.scene, scope: host.scope, time: () => app.clock.now,
      edges: this.neighbours.flatMap((cell) => neighbourEdges(cell, home).map((edge) => ({ instance: cell.instance, x: edge.x, z: edge.z, axis: edge.axis, halfLength: edge.halfLength }))),
      ports: { closed: (id) => this.live === null || !this.live.live.ready(id) } });
    // G217: every cell you can't enter (loading, waiting or refused) wears the full Developer loading screen at its soft wall
    // (a page whose envelope can't fit the screens' one claim keeps its closed walls without them, rather than no grid)
    try {
      this.screens = installCellScreens({ scene: host.scene, admission, time: () => app.clock.real, wall: CHUNK_HALF + 6,
        build: typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : '', tier: TIER,
        cells: this.neighbours.map((cell) => ({ instance: cell.instance, x: cell.origin.x - home.origin.x, z: cell.origin.z - home.origin.z, art: findShard(cell.slug)?.card.thumb ?? null })),
        ports: { read: () => this.screenInputs(), ready: id => this.screenReady(id),
          feet: () => { const at = this.world(); return { x: at.x - home.origin.x, z: at.z - home.origin.z }; } } });
    } catch (error) {
      if (!(error instanceof PlatformRenderAdmissionError)) throw error;
      console.warn('[grid] the cell screens did not fit the envelope:', error);
      this.screens = { step: () => undefined, state: () => ({ shown: [], draws: 0 }) };
    }
    // G78: a shimmer line at every shard border on its real ground; G119: SAVING… / SAVE FAILED, RETRY while a crossing waits
    const rows = new Map((edges ?? []).map((cell) => [cell.instance, cell.edges]));
    let status: CrossingSaveStatus = null, polled = 0;
    this.shimmer = installBorderShimmer({ scene: host.scene, scope: host.scope, time: () => app.clock.now,
      cells: this.assembly.cells.map((cell) => ({ x: cell.origin.x - home.origin.x, z: cell.origin.z - home.origin.z, edges: rows.get(cell.instance) ?? null })),
      ports: { feet: () => { const at = this.world(); return { x: at.x - home.origin.x, z: at.z - home.origin.z }; },
        status: () => { if (++polled % 4 === 0) status = crossingSaveStatus(this.live?.state().crossing); return status; },
        text: (shown) => (shown === 'saving' ? GAME_STRINGS.grid.saving : GAME_STRINGS.grid.saveFailed) } });
    const nativeOrigin = host.ownedHome === true ? { origin: { x: 0, z: 0 } } : home;
    const nativeMesh = (mesh: CollisionMesh): CollisionMesh => host.ownedHome === true ? mesh : this.rebased(mesh);
    for (const { mesh } of this.strips) installStripCollider(host.physics, nativeMesh(mesh), host.scope);
    // G219: the open plots' floors, showrooms and centrepieces collide as platform ground (the highway gets the same, `attach`)
    for (const mesh of openPlotColliders(this.assembly.plots)) installStripCollider(host.physics, nativeMesh(mesh), host.scope);
    try {
      this.plots = installOpenPlots({ plots: this.assembly.plots, home, scene: host.scene, scope: host.scope, admission,
        feet: () => { const at = this.world(); return { x: at.x - home.origin.x, z: at.z - home.origin.z }; } });
    } catch (error) {
      if (!(error instanceof PlatformRenderAdmissionError)) throw error;
      console.warn('[grid] the open plots did not fit the envelope:', error);
      this.plots = { step: () => undefined, state: () => ({ plots: [], pictures: 0, draws: 0, triangles: 0 }) };
    }
    // The normal world stage owns the home's sockets; this scope adds only rebased neighbours.
    installEntrySockets(host.physics, host.scope, this.neighbours.map((cell) => ({ x: cell.origin.x - nativeOrigin.origin.x, z: cell.origin.z - nativeOrigin.origin.z })));
    this.walls = new ReadinessWalls(host.physics, [...this.neighbours.flatMap((cell) => neighbourEdges(cell, nativeOrigin)), ...rimEdges(this.assembly, nativeOrigin)], host.scope);
    if (host.ownedHome !== true) installGridBorders(host.physics, host.scope); // owned regions install their own creature borders
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
      // playtest 1: a shared product's copy wears its own number panels (copyIdentity.ts)
      const marks = copyMarks(cell.instance, cell.identity);
      if (marks !== null) { root.add(marks.object); marks.object.updateMatrixWorld(true); host.scope.onDispose(marks.dispose); }
    }
    // G223: an entered regional runtime draws its own cell; its coarse root (far proxy, tiles) hides until it leaves
    host.scope.onDispose(bindCellCover(host.scene, cellCoverPort((id) => roots.get(id))));
    const far = farRingPorts({
      root: (id) => { const root = roots.get(id); if (root === undefined) throw new Error(`No grid cell root ${id}`); return root; },
      load: async (id) => {
        let loaded: Awaited<ReturnType<typeof loadFar>>;
        try { loaded = await loadFar(this.assembly.cell(id).slug); } catch (error) { this.farMissing.add(id); throw error; } // G167: no far view, A's fallback
        this.farMissing.delete(id);
        const { prepared, bytes } = loaded; this.costs.set(id, bytes); frame?.declare(id, prepared.look);
        return prepared;
      },
    });
    const framedPorts = frame === null ? far : { ...far, upload: (tile: { instance: string }, data: FarPrepared) => {
      const band = data.look.band, view = far.upload(tile, data), untag = frame.proxy(view), dispose = view.dispose;
      // SF19b (G94 / G95): a shard that declares a band shows its mood at its border from the road; inside its cell it owns the frame (G158)
      const root = roots.get(tile.instance), unband = band === undefined || root === undefined ? () => undefined : installHazeBand(root, band, CHUNK_HALF);
      view.dispose = () => { unband(); untag(); dispose(); };
      return view;
    } };
    // the drawn far views, for the cell screen's far-view row
    const farPorts = { ...framedPorts, upload: (tile: { instance: string }, data: FarPrepared) => {
      const view: FarProxyView = framedPorts.upload(tile, data), dispose = view.dispose;
      this.farViews.add(tile.instance);
      view.dispose = () => { this.farViews.delete(tile.instance); dispose(); };
      return view;
    } };
    // SF25 / G66: frozen neighbours look alive (presentation-only client scripts; their sims never step here)
    this.life = new NeighbourLife({ scope: host.scope, simulation: (id) => this.live?.simulation(id), active: (id) => (this.live === null ? this.home.instance : this.live.live.current()) === id });
    // one late system for the grid (the page's onLate takes one label): the alive neighbours, then the one frame's weights
    this.panels = new NeighbourPanels({ scope: host.scope, simulation: (id) => this.live?.simulation(id) });
    host.frame?.onLate((dt) => { this.life.late(dt); this.panels.late(); frame?.frame(); });
    const tiles = neighbourTiles(host.scope), tileCost = clientRingCatalogue(tiles.instances);
    this.rings = new RenderRings(this.neighbours, this.allocator, (id, level, x, z) => (level === 'far' ? this.costs.get(id) ?? 1_600_000 : tileCost(id, level, x, z)),
      levelPorts<FarPrepared, PreparedRingTile>(farPorts, tiles.ports));
    if (host.renderer !== undefined) void this.admitTiles(host.renderer, roots, tiles.instances);
    host.scope.onDispose(() => {
      this.rings.dispose();
      for (const root of roots.values()) root.removeFromParent();
    });
    host.onFixed((dt) => { this.step(dt); this.life.fixed(); });
    const homeResidency = { instance: residency.home().instance, bytes: residency.home().bytes };
    host.scope.onDispose(app.debug.scopedExpose('grid', { state: () => this.state(), roadView: () => this.roadBudget.view(), roadResident: () => this.roadBudget.resident(),
      // G144 admission receipts read the same allocator, without reserving or changing any claim.
      residency: () => ({ cost: this.allocator.cost(), claims: this.allocator.entries(), home: homeResidency }),
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
        try { await this.panels.admit(cell, root, source, bytes, views); } catch (error) { console.warn(`[grid] ${cell.instance} draws no doors (declared panels):`, error); }
      } catch (error) { this.refuse(cell, error); } // G167 / G217: a refused shard's cell screen names the reason
    }
  }

  /** G167: note a neighbour whose shard can't load (an M3 wait or a closing page is not a refusal), for its cell and SHARD SELECT. */
  private refuse(cell: GridCell, error: unknown): void {
    const refusal = classifyRefusal(error);
    if (refusal === null || this.host.scope.disposed) return;
    console.warn(`[grid] ${cell.instance} can't load (${refusal}):`, error);
    this.refusals.set(cell.instance, refusal); this.issues.set(cell.instance, error instanceof Error ? error.message : String(error)); pageShardRefusals().note(cell.slug, refusal);
  }
  /**
   * G217's read-only port: every neighbour you can't enter now, with its readiness stages, its refusal or wait, its claims in
   * the one allocator (its own and its shared product) and its far view. Read a few times a second by the cell screens.
   */
  private screenInputs(): ReadonlyMap<string, CellScreenInput> {
    const out = new Map<string, CellScreenInput>(), live = this.live, cost = this.allocator.cost(), claimed = new Map<string, { bytes: number; count: number }>();
    for (const entry of this.allocator.entries()) {
      const key = entry.owner === 'grid' && entry.id.startsWith('product:grid:') ? entry.id : entry.owner, was = claimed.get(key);
      claimed.set(key, { bytes: (was?.bytes ?? 0) + entry.bytes, count: (was?.count ?? 0) + 1 });
    }
    // G216: a claim Developer admitted past the envelope reports its full numbers (the newest report per cell wins)
    const over = new Map<string, MemoryAdmissionWarning>();
    for (const report of this.allocator.memory.reports()) over.set(report.owner === 'grid' && report.id.startsWith('product:grid:') ? report.id : report.owner, report);
    for (const cell of this.neighbours) {
      const id = cell.instance;
      const raw = live?.refusal(id), refusal = this.refusal(id), manifest = findShard(cell.slug);
      const status = cellScreenStatus({ ready: live?.live.ready(id) === true,
        gameplayReady: live?.live.current() !== id || live.gameplayReady(),
        declared: (manifest?.shardfile ?? manifest?.gridShardfile) !== undefined,
        pending: live?.live.state().pending.includes(id) === true,
        waiting: raw instanceof GridCellWaitingError || (raw !== undefined && classifyRefusal(raw) === null), refusal });
      if (status === null) continue;
      const waiting = status === 'waiting';
      const message = raw instanceof Error ? raw.message : raw === undefined ? this.issues.get(id) ?? null : typeof raw === 'string' ? raw : null;
      const stages = live?.live.readiness.status(id), own = claimed.get(id), product = claimed.get(`product:grid:${cell.slug}`);
      const warning = over.get(id) ?? over.get(`product:grid:${cell.slug}`);
      out.set(id, { instance: id, slug: cell.slug, name: this.shardName(id), status, refusal,
        wait: waiting ? (message !== null && /hybrid/u.test(message) ? 'hybrid' : 'format') : null, issue: message, far: this.farStatus(id),
        requested: stages?.requested ?? false, product: product !== undefined, runtime: stages?.runtime ?? false, colliders: stages?.colliders ?? false, sim: stages?.sim ?? false,
        claimedBytes: (own?.bytes ?? 0) + (product?.bytes ?? 0), claims: (own?.count ?? 0) + (product?.count ?? 0), declaredBytes: product?.bytes ?? 0,
        pageBytes: warning?.playingBytes ?? cost.playing, capBytes: warning?.playingCap ?? CONTENT_CAPS.playing, overBytes: warning?.playingOverBytes ?? 0 });
    }
    return out;
  }
  /** A data-ready active region keeps G217 visible until its entered world/kit/play hooks finish. */
  private screenReady(instance: string): boolean {
    const live = this.live;
    return live !== null && live.live.ready(instance) && (live.live.current() !== instance || live.gameplayReady());
  }
  private refusal(instance: string): ShardRefusal | null {
    const live = this.live?.refusal(instance);
    return this.refusals.get(instance) ?? (live === undefined ? null : classifyRefusal(live));
  }
  private farStatus(instance: string): FarViewStatus { return this.farViews.has(instance) ? 'resident' : this.farMissing.has(instance) ? 'none' : 'loading'; }
  private shardName(instance: string): string { const slug = this.assembly.cell(instance).slug; return this.names.get(slug) ?? slug; }

  /** Step 2: the live crossing, once the page's player health and equipment exist (play.ts). */
  attach(page: LiveGridPage): LiveGridSession {
    if (this.live !== null) throw new Error('The grid session already has its live crossing');
    if (this.host.residency === undefined) throw new Error('Grid session requires the early page residency owner');
    this.live = new LiveGridSession({ assembly: this.assembly, home: this.home, physics: this.host.physics, scope: this.host.scope, walls: this.walls, strips: this.strips, allocator: this.allocator,
      platform: openPlotColliders(this.assembly.plots),
      residency: this.host.residency.home(),
      neighbourEdges: (cell, origin) => neighbourEdges(cell, { origin }), rimEdges: (origin) => rimEdges(this.assembly, { origin }) }, page);
    return this.live;
  }

  private rebased(mesh: CollisionMesh): CollisionMesh { return { ...mesh, origin: { x: mesh.origin.x - this.home.origin.x, z: mesh.origin.z - this.home.origin.z } }; }
  /** G107 / SF66: a cell's baked map once loaded; null for the home cell, whose full-size map is the minimap's own ground. */
  mapImage(instance: string): HTMLCanvasElement | null { return instance === this.home.instance ? null : this.mapImages.image(this.assembly.cell(instance).slug); }
  /** the neighbours' baked maps held now (bytes), for the memory readouts */
  get mapImageBytes(): number { return this.mapImages.bytes; }
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
    this.screens.step();
    this.shimmer.step();
    this.plots.step(dt);
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
      strips: this.strips.length, road: this.road, seams: this.seams, softWalls: this.softWalls.state(), shimmer: this.shimmer.state(), screens: this.screens.state(), plots: this.plots.state(), ringsReady: this.rings.ready(),
      residentMB: Math.round(cost.accounted / 1e4) / 100, playingMB: Math.round(cost.playing / 1e4) / 100,
      accountedBytes: cost.accounted,
      rings: { far: stats.resident.far, l1: stats.resident.l1, l0: stats.resident.l0, refused: stats.refused, inFlight: stats.inFlight, queued: stats.queued },
      frame: this.frame?.state() ?? null,
      live: this.live?.state() ?? null,
      life: this.life.state(),
    };
  }
}
