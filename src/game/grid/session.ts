/**
 * The grid session (SHARD-PLATFORM SF17b / SF18a / SF18b / SF21a, the grid client): what turns EXPERIMENTAL Wildshard's
 * home-cell boot into a 5 × 5 grid inside the one page. The home cell boots through the normal shard flow (its own
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
import { platformInputs } from './platformInputs';
import { BufferGeometry, Group, Mesh, Vector3, type Material, type Object3D } from 'three';
import { createRigLoader } from '@wildshard/engine/anim/rig';
import * as v from 'valibot';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import { versionedUrl } from '@wildshard/engine/boot/bytes';
import { publicBytes } from '@wildshard/engine/boot/tables';
import type { LevelSpec } from '@wildshard/engine/level/spec';
import type { Scope } from '@wildshard/engine/app/scope';
import type { StepProgress } from '@wildshard/engine/boot/plan';
import { workSlice } from '@wildshard/engine/core/workSlice';
import { app } from '@wildshard/engine/app/runtime';
import { harnessPins } from '@wildshard/engine/app/identity';
import type { Physics } from '@wildshard/engine/physics/Physics';
import { installEntrySockets } from '@wildshard/engine/physics/entrySockets';
import { installStripCollider } from '@wildshard/engine/physics/stripColliders';
import { ReadinessWalls, type ReadinessEdge } from '@wildshard/engine/physics/readinessWalls';
import { installGridBorders } from '@wildshard/engine/physics/gridBorders';
import { WATER_UNBOUNDED, waterExtent } from '@wildshard/engine/world/waves';
import type { Renderer } from '@wildshard/engine/render/renderer';
import { generatePlatform, generatePlatformSliced, type GeneratedStrip, type PlatformCell, type StripProfile } from '@wildshard/engine/sim/strips';
import { GridAssembly, type GridCell } from './assembly';
import { neighbourEdges } from './readinessEdges';
import { DEVSERVER, gridMode } from './menu';
import { gridCells, pageGridInstance, pageMode } from '../plugin/context';
import type { ResidencyAllocator } from './allocator';
import type { PageResidency } from './pageResidency';
import { PlatformRenderResidency } from './renderResidency';
import { RenderRings, levelPorts, type LevelPrepared, type RingPorts } from './rings';
import { farRingPorts, type FarPrepared, type FarProxyView } from './farView';
import { decodeFarImpostor, farBandShare } from './farImpostorView';
import { FarImpostorSchema, type FarImpostor } from '@wildshard/format/shardSections';
import { bindCellCover, cellCoverPort } from './cellCover';
import { FAR_RING, type FarLookRuntime } from './farProxy';
import { bakedNearFiles, NearPlaceholders, type NearPlaceholderState } from './nearPlaceholderView';
import { GridFrame, type GridFrameHost, type GridFrameState } from './frame';
import { installHazeBand } from './hazeBand';
import { LiveGridSession, type LiveGridPage, type LiveGridSessionState } from './liveSession';
import { gridShardfileEdges, gridShardfileProduct } from './products';
import { loadShardfileFar, loadShardfileNear } from './shardfileFar';
import { jsonResidentBytes } from '../shardfile/productCost';
import { RAIL_OFFSET, roadLayout } from './roadLayout';
import type { RoadLookState } from './roadLook';
import { installPlatformRoad, installPlatformRoadSliced, type PlatformRoad } from './roadLookPlatform';
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
import { leaseMapImage } from '../shardfile/mapImage';
import { crossingSaveStatus, installBorderShimmer, type BorderShimmerState, type CrossingSaveStatus } from './borderShimmer';
import { GAME_STRINGS } from '../strings';
import { GridCellWaitingError, classifyRefusal, pageShardRefusals, refusalReason, type ShardRefusal } from './refusal';
import { CellLoading, type CellLoadingInput } from './cellLoading';
import { horizonFade } from './horizonFade';

declare const __GRID_SEAM_PLANS__: readonly (readonly [string, readonly number[][]])[];

declare const __BUILD_ID__: string; // vite.config.ts define; absent under Node

/**
 * In grid mode the level's own chunk-edge walls and veil yield to the platform, and so does its own horizon (G99: every
 * shard is a 500 m cube; a level's horizon rings and cloud sea stand past it, over the road and the neighbours, whose
 * far views are the grid's horizon now). The engine has no default horizon (G552); a level's painted strips at
 * infinity stay. The standalone path is unchanged.
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
  /** Prepare a streamed view while hidden; its current fence cancels work before retirement. */
  readonly prepareView?: (root: Object3D, current: () => boolean) => Promise<void>;
  /** Prepare an admitted, detached ring tile before its budgeted visible upload. */
  readonly prepareTile?: (tile: PreparedRingTile) => Promise<void>;
  /** G371: the drawn camera's horizontal offset from the feet, in the feet's frame (absent: the eye at the feet). The near
   *  tier plans from the eye, so a lifted or free camera gets the cells it is over; a play camera is a few metres off */
  readonly eye?: () => { readonly x: number; readonly z: number };
}
/**
 * What each cell draws now, for the readout and the captures: `playing` (the entered runtime), `frozen` (the home's
 * runtime, not stepping, when no placeholder layer draws it), `near` (its near placeholder, its far proxy hidden), `far proxy`, `tiles` (only its L1 / L0
 * ring tiles: the far proxy wholly refined away), `loading` (nothing yet).
 */
export type GridCellShows = 'playing' | 'frozen' | 'near' | 'far proxy' | 'tiles' | 'loading';
/** Which of a cell's presentation layers draw now (meshes visible), for the readout and the captures. */
export interface GridCellDrawn { readonly far: boolean; readonly near: boolean; readonly l1: number; readonly l0: number }
/** The session's readout (tests, harness, the board). */
export interface GridSessionState {
  readonly home: string; readonly inside: string | null; readonly feet: { x: number; z: number };
  readonly cells: readonly { readonly instance: string; readonly slug: string; readonly cell: readonly [number, number]; readonly shows: GridCellShows; readonly drawn: GridCellDrawn }[];
  readonly strips: number; readonly ringsReady: boolean;
  /** SF17b's boulevard look: segments, junctions, roundabouts, signs, lights and draws */
  readonly road: RoadLookState;
  /** the seams' materials: triangles and draws per material (phase 2, G90 / G91 / G101) */
  readonly seams: SeamLookState;
  /** G85's soft walls: how many edges are closed */
  readonly softWalls: SoftWallState;
  /** G78's border shimmer and G119's save panel (status null: no panel up) */
  readonly shimmer: BorderShimmerState;
  /** G555: the cell whose step-by-step loading screen is open (its entry or re-entry waits), or null */
  readonly cellLoading: string | null;
  /** the allocator's grid content (MB) and the §3.2 playing total with the engine base (MB, the 1.0 GB envelope, G65) */
  readonly residentMB: number; readonly playingMB: number;
  /** Exact category sum before engine base, overlap allowance or calibration factor; used by the soak harness. */
  readonly accountedBytes: number;
  readonly rings: { readonly frame?: number; readonly far: number; readonly l1: number; readonly l0: number; readonly refused: number; readonly inFlight: number; readonly queued: number };
  /** SF19a's one frame (null for a host with no frame: no camera / composer) */
  readonly frame: GridFrameState | null;
  /** step 2's live crossing (null until the page attaches its player) */
  readonly live: LiveGridSessionState | null;
  /** SF25 / G66: each shardfile neighbour's client-script life (frozen cells breathe and graze) */
  readonly life: readonly NeighbourLifeCell[];
  /** G342 / G385: the near-placeholder tier's cells and resident bytes */
  readonly near: NearPlaceholderState;
}

/** The shardfile neighbours' L1 / L0 tiles (sources load late: until then the catalogue has no tile and the far proxy draws). */
function neighbourTiles(scope: Scope, prepare: (tile: PreparedRingTile) => Promise<void>): { instances: Map<string, ClientRingInstance>; ports: RingPorts<PreparedRingTile> } {
  const instances = new Map<string, ClientRingInstance>(), decoder = new TileDecoder();
  scope.onDispose(() => { decoder.dispose(); });
  return { instances, ports: clientRingPorts(instances, { scope, decoder, prepare }) };
}

/** The far proxy and its row, fetched from the shard's baked folder (`public/assets/baked/<slug>/far.*`). */
async function loadFar(slug: string, owner: Parameters<typeof gridShardfileProduct>[1]): Promise<{ prepared: FarPrepared; bytes: number }> {
  // Pure authored projects have no repo bake. Read their admitted proxy instead of requesting a nonexistent far.json.
  if (findShard(slug)?.shardfile !== undefined) {
    const product = gridShardfileProduct(slug, owner);
    if (product !== null) {
      const retained = await product;
      try {
        const { source } = retained.admitted;
        if (source.meshCollision !== null) {
          const assets = new ClientAssets(source, retained.admitted.assets, retained.options);
          const release = assets.lease(source.far?.files ?? []);
          try { return await loadShardfileFar(source, ref => assets.read(ref)); }
          finally { release(); }
        }
      } finally { retained.release(); }
    }
  }
  const response = await fetch(versionedUrl(`/assets/baked/${slug}/far.json`));
  if (!response.ok) throw new Error(`far.json ${slug}: ${String(response.status)}`);
  const row: unknown = await response.json();
  const look = farLook(row), bytes = farBytes(row), impostorRow = farImpostorRow(row);
  // G539: its camera-facing impostor beside it (a far row baked before G539 has none: the proxy draws at every distance)
  const impostor = impostorRow === undefined ? null : await (async () => {
    const image = await fetch(versionedUrl(`/assets/baked/${slug}/far-impostor.png`));
    if (!image.ok) throw new Error(`far-impostor.png ${slug}: ${String(image.status)}`);
    return decodeFarImpostor(impostorRow, new Uint8Array(await image.arrayBuffer()));
  })();
  const gltf = await createRigLoader().loadAsync(versionedUrl(`/assets/baked/${slug}/far.glb`));
  const meshes: BufferGeometry[] = [];
  gltf.scene.traverse((node) => { if (!(node instanceof Mesh)) return; const found: unknown = node.geometry; if (found instanceof BufferGeometry) meshes.push(found as BufferGeometry); });
  const geometry = meshes[0];
  if (geometry === undefined) throw new Error(`far.glb ${slug}: no mesh`);
  return { prepared: { geometry, look, impostor }, bytes };
}
const num = v.pipe(v.number(), v.finite());
/** The part of `far.json` the client reads: the resident cost and the look (the bake writes more). */
const FarRow = v.object({ far: v.object({ gpu: num, decoded: num, impostor: v.optional(FarImpostorSchema) }),
  look: v.object({ family: v.picklist(['toon', 'painterly', 'pbr']), haze: v.object({ colour: v.tuple([num, num, num]), near: num, far: num, max: num }),
    grade: v.optional(v.object({ exposure: num, saturation: num, contrast: num, tint: v.optional(v.tuple([num, num, num])) })),
    band: v.optional(v.object({ colour: v.tuple([num, num, num]), height: num, opacity: num, own: num })) }) });
/** The part of `near.json` the client reads. */
const NearRow = v.object({ near: v.object({ gpu: num, decoded: num, content: v.optional(num), tiles: v.optional(v.literal(true)) }), look: FarRow.entries.look });
/**
 * G342 / G348: a shard's near placeholder. Its admitted shardfile's own `near` row first (`wildshard build` bakes one for
 * any terrain shardfile, so an unknown uploaded shard draws its own); else its baked folder like the far proxy
 * (`scripts/bake/near-placeholder.mjs`, the first-party shards until their shardfiles carry the row). A baked view whose
 * world carries the shard's own props owns its cell; one built from the shard's own coarse tiles (`near.tiles`) never does,
 * as a shardfile's own near row never does: those tiles keep refining over it.
 */
async function loadNear(slug: string, owner: Parameters<typeof gridShardfileProduct>[1]): Promise<{ prepared: FarPrepared; bytes: number; owns: boolean }> {
  const product = gridShardfileProduct(slug, owner);
  const retained = product === null ? null : await product.catch(() => null);
  if (retained !== null) {
    try {
      const { source } = retained.admitted;
      if (source.near !== undefined && source.near.content.length > 0) {
        const assets = new ClientAssets(source, retained.admitted.assets, retained.options), release = assets.lease(source.near.content);
        try { return await loadShardfileNear(source, ref => assets.read(ref)); }
        finally { release(); }
      }
    } finally { retained.release(); }
  }
  const baked = bakedNearFiles(slug, publicBytes());
  if (baked === null) throw new Error('No declared near placeholder; retain far proxy');
  const response = await fetch(versionedUrl(baked.row));
  if (!response.ok) throw new Error(`near.json ${slug}: ${String(response.status)}`);
  const row = v.parse(NearRow, await response.json());
  const gltf = await createRigLoader().loadAsync(versionedUrl(baked.mesh));
  let geometry: BufferGeometry | undefined;
  gltf.scene.traverse((node) => { if (geometry === undefined && node instanceof Mesh) { const found: unknown = node.geometry; if (found instanceof BufferGeometry) geometry = found as BufferGeometry; } });
  if (geometry === undefined) throw new Error(`near.glb ${slug}: no mesh`);
  return { prepared: { geometry, look: row.look }, bytes: Math.round(row.near.gpu + row.near.decoded), owns: (row.near.content ?? 0) > 0 && row.near.tiles !== true };
}
function farLook(row: unknown): FarLookRuntime { return v.parse(FarRow, row).look; }
function farImpostorRow(row: unknown): FarImpostor | undefined { return v.parse(FarRow, row).far.impostor; }
function farBytes(row: unknown): number { const { far } = v.parse(FarRow, row); return Math.round(far.gpu + far.decoded); }

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
  private readonly admitNeighbour: ((cell: GridCell) => void) | undefined;
  /** G222 playtest #7: each neighbour's declared doors and gates, shown exactly when its region has them standing */
  private readonly panels: NeighbourPanels;
  private readonly softWalls: { readonly step: () => void; readonly state: () => SoftWallState };
  /** G342 / G385: the near-placeholder tier, shipped for everyone: the four nearest cells draw their near view */
  private readonly near: NearPlaceholders;
  private readonly shimmer: { readonly step: () => void; readonly state: () => BorderShimmerState };
  /** G167: why a neighbour's shard can't load (its product refused, with the admission's message) and its far view's status */
  private readonly refusals = new Map<string, ShardRefusal>();
  private readonly issues = new Map<string, string>();
  private readonly farViews = new Set<string>();
  /** each uploaded far view, for the readout's `drawn.far` (its mesh's own visibility) */
  private readonly farMeshes = new Map<string, FarProxyView>();
  private readonly farMissing = new Set<string>();
  /** each slug's shown name */
  private readonly names = new Map<string, string>();
  /** G555: the one step-by-step loading screen over a cell entry or re-entry that waits */
  private readonly cellLoading = new CellLoading();
  private cellLoadingPolled = 0;
  /** when each cell's current wait began, so its screen counts only the hooks of this load */
  private readonly loadingSince = new Map<string, number>();

  /** Load every cell's edge rows (`loadGridEdgeProfiles` over the shards' own data), then build the session. */
  static async create(host: GridSessionHost, progress?: StepProgress): Promise<GridSession> {
    if (host.residency === undefined) throw new Error('Grid session requires the early page residency owner');
    const allocator = host.residency.allocator;
    const assembly = new GridAssembly(gridMode(DEVSERVER)), empty = assembly.emptyNeighbour.edge;
    let prepared = 0;
    progress?.set(0, 3, `Cell edges · 0 / ${assembly.cells.length}`);
    const edges = await loadGridEdgeProfiles(assembly.cells, async (cell) => {
      try {
        const edge = await readGridEdges(cell, { edges: slug => gridShardfileEdges(slug, { allocator, scope: host.scope }), fetch: url => fetch(url) });
        const claim = allocator.reserve({ id: `product:grid:edge:${cell.instance}`, category: 'product', owner: cell.instance, bytes: jsonResidentBytes(edge), distance: 0, needed: true });
        if (claim === null) throw new Error('Grid edge metadata residency deferred');
        host.scope.onDispose(() => { claim.release(); }); return edge;
      } catch (error) {
        console.warn(`[grid] ${cell.instance} edges stay at road level:`, error);
        const closed = { entryWidth: 0 };
        return { kind: 'declared', profiles: { north: empty, east: empty, south: empty, west: empty }, observations: { north: closed, east: closed, south: closed, west: closed } };
      } finally {
        prepared++; progress?.detail(`Cell edges · ${prepared} / ${assembly.cells.length}`);
      }
    });
    if (host.scope.disposed) throw new Error('Grid session left during cell preparation');
    // Loading has no game frames to wait for. Share the usual 30 ms loading budget across cheap generator batches;
    // workSlice still observes the drawn-frame budget if this is called while the game is presenting.
    const construction = workSlice(30, host.scope);
    let batches = 0;
    progress?.set(1, 3, 'Terrain seams · 0 batches');
    const seamPlans = new Map(__GRID_SEAM_PLANS__);
    const strips = await platformStrips(assembly, edges, (platform, edge) => generatePlatformSliced(platform, edge, async () => {
      progress?.detail(`Terrain seams · ${++batches} batches`); await construction.check();
    }, 12, seamPlans));
    batches = 0; progress?.set(2, 3, `Road geometry · 0 batches · ${strips.length} seams`);
    const instance = pageGridInstance();
    if (instance === null) throw new Error('A grid session needs a grid page');
    const home = assembly.cell(instance), roadScope = host.scope.child('grid-road-construction');
    const admission = new PlatformRenderResidency(allocator, roadScope), plans = new Map<Mesh, CullPlan>();
    try {
      const road = await installPlatformRoadSliced({ strips, home, pitch: assembly.pitch,
        layout: roadLayout(assembly, slug => findShard(slug)?.name ?? slug), scene: host.scene, scope: roadScope,
        camera: () => host.frame?.camera, plans, admission }, async () => {
          progress?.detail(`Road geometry · ${++batches} batches · ${strips.length} seams`); await construction.check();
        });
      await construction.yield();
      const session = new GridSession(host, edges, allocator, strips, { road, plans });
      progress?.set(3, 3, `${assembly.cells.length} cells · ${strips.length} seams · road ready`);
      await construction.yield();
      return session;
    } catch (error) { roadScope.dispose(); throw error; }
  }

  constructor(host: GridSessionHost, edges?: readonly PlatformCell[], allocator?: ResidencyAllocator, prebuilt?: readonly GeneratedStrip[], preparedRoad?: { readonly road: PlatformRoad; readonly plans: Map<Mesh, CullPlan> }) {
    this.host = host;
    this.mapImages = new CellMinimaps(host.scope, async slug => {
      const pending = gridShardfileProduct(slug, { allocator: this.allocator, scope: host.scope });
      if (pending === null) return undefined;
      const product = await pending;
      try { return leaseMapImage(product.admitted.source, product.admitted.assets, this.allocator, host.scope); }
      finally { product.release(); }
    }, identity => { const { slug: homeIdentity } = this.home; return identity === homeIdentity; });
    const residency = host.residency;
    if (residency === undefined) throw new Error('Grid session requires the early page residency owner');
    if (allocator !== undefined && allocator !== residency.allocator) throw new Error('Grid session must share the page allocator');
    this.allocator = residency.allocator;
    const instance = pageGridInstance();
    this.assembly = new GridAssembly(gridMode(DEVSERVER));
    if (instance === null) throw new Error('A grid session needs a grid page');
    this.home = this.assembly.cell(instance);
    const home = this.home;
    this.neighbours = this.assembly.cells.filter((cell) => host.ownedHome === true || cell.instance !== home.instance);
    for (const cell of this.assembly.cells) { const manifest = findShard(cell.slug); this.names.set(cell.slug, manifest?.name ?? cell.slug); }
    // the deck: one generator run (`create` runs it sliced and hands it over), one draw, the same vertices as the platform colliders
    const strips = prebuilt ?? platformStripsNow(this.assembly, edges);
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
    if (preparedRoad !== undefined) for (const [mesh, plan] of preparedRoad.plans) this.roadPlans.set(mesh, plan);
    const platformRoad = preparedRoad?.road ?? installPlatformRoad({ strips, home, pitch: this.assembly.pitch, layout,
      scene: host.scene, scope: host.scope, camera: () => host.frame?.camera, plans: this.roadPlans,
      admission });
    this.strips = collisionStrips(strips);
    this.road = platformRoad.road; this.seams = platformRoad.seams;
    // G321: inside a cell whose shard draws its own sky, its backdrop owns the horizon: the road's void floor fades by it
    if (frame !== null) host.scope.onDispose(frame.horizon(platformRoad.horizon));
    // G103: the asphalt forced 15 m into each cell keeps the road's light under that cell's own (the road's frame weight)
    if (frame !== null) host.scope.onDispose(frame.stack(null, { weight: platformRoad.overlayLight }));
    // G321 part 4: and what stands outside that cell (the road's far reaches here; the neighbours' far proxies, haze bands
    // and ring tiles as they arrive) dithers out by it beyond the near road
    const horizon = horizonFade(host.scope);
    for (const root of platformRoad.roots) if (root.name !== 'grid-void') horizon.patch(root); // the void floor fades itself
    if (frame !== null) host.scope.onDispose(frame.horizon((owned, cell) => {
      horizon.set(owned, cell === null ? null : { x: cell.origin.x - home.origin.x, z: cell.origin.z - home.origin.z, half: CHUNK_HALF });
    }));
    // SF17b's per-view road budget (§3.2, G101): what the view camera draws of the road system, and what stays resident
    const roadRoots = platformRoad.roots;
    this.roadBudget = { view: () => { const camera = host.frame?.camera; return camera === undefined ? null : roadViewCost(roadRoots, camera, this.roadPlans); }, resident: () => roadResident(roadRoots, this.roadPlans) };
    // G85: a closed neighbour edge shows as a cyan hex shimmer
    this.softWalls = installSoftWallLook({ scene: host.scene, scope: host.scope, time: () => app.clock.now,
      edges: this.neighbours.flatMap((cell) => neighbourEdges(cell, home).map((edge) => ({ instance: cell.instance, x: edge.x, z: edge.z, axis: edge.axis, halfLength: edge.halfLength }))),
      ports: { closed: (id) => this.live === null || !this.live.live.ready(id) } });
    host.scope.onDispose(() => { this.cellLoading.close(); });
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
    const preparedBands = new WeakMap<FarProxyView, Object3D>();
    const far = farRingPorts({
      ...(host.prepareView === undefined ? {} : { prepare: async (view: FarProxyView, data: FarPrepared) => {
        const root = view.mesh.parent;
        if (root === null) throw new Error('Far view left before preparation');
        if (frame !== null && data.look.band !== undefined) {
          const unband = installHazeBand(root, data.look.band, CHUNK_HALF), dispose = view.dispose;
          view.dispose = () => { unband(); dispose(); };
          const haze = root.getObjectByName('haze-band');
          if (haze === undefined) throw new Error('Far haze band was not installed');
          horizon.patch(haze); haze.visible = false; preparedBands.set(view, haze);
        }
        await host.prepareView?.(root, () => !host.scope.disposed && view.mesh.parent === root);
      } }), decorate: horizon.patch,
      root: (id) => { const root = roots.get(id); if (root === undefined) throw new Error(`No grid cell root ${id}`); return root; },
      load: async (id) => {
        let loaded: Awaited<ReturnType<typeof loadFar>>;
        try { loaded = await loadFar(this.assembly.cell(id).slug, { allocator: this.allocator, scope: host.scope }); } catch (error) { this.farMissing.add(id); throw error; } // G167: no far view, A's fallback
        this.farMissing.delete(id);
        const { prepared, bytes } = loaded; this.costs.set(id, bytes); frame?.declare(id, prepared.look);
        return prepared;
      },
    });
    const framedPorts = frame === null ? far : { ...far, upload: (tile: { instance: string }, data: FarPrepared) => {
      const band = data.look.band, view = far.upload(tile, data), untag = frame.proxy(view), dispose = view.dispose;
      // SF19b (G94 / G95): a shard that declares a band shows its mood at its border from the road; inside its cell it owns the frame (G158)
      const prepared = preparedBands.get(view);
      const root = roots.get(tile.instance), unband = prepared !== undefined || band === undefined || root === undefined ? () => undefined : installHazeBand(root, band, CHUNK_HALF);
      if (prepared !== undefined) prepared.visible = true;
      else { const haze = root?.getObjectByName('haze-band'); if (haze !== undefined) horizon.patch(haze); }
      view.dispose = () => { unband(); untag(); dispose(); };
      return view;
    } };
    // the drawn far views, for the cell screen's far-view row; G342: each one's mask is mirrored onto its near view
    const drawnFar = new Map<string, { view: FarProxyView; excluded: ReadonlySet<number> }>();
    // G385: the near tier draws for everyone. C (G380) is the hero captures' alone: every neighbour draws its near view,
    // whatever its distance or the four-cell cap, pinned by the capture's init script (`__wildshardHarness.nearEvery`)
    const near = new NearPlaceholders({ every: typeof window !== 'undefined' && window.__wildshardHarness?.nearEvery === true,
      allocator: this.allocator, cells: this.assembly.cells, pitch: this.assembly.pitch, root: (id) => roots.get(id),
      load: (id) => loadNear(this.assembly.cell(id).slug, { allocator: this.allocator, scope: host.scope }),
      cover: (id, covered) => { const drawn = drawnFar.get(id); if (drawn !== undefined) drawn.view.mesh.visible = !covered && drawn.excluded.size < 16; },
      mask: (id) => drawnFar.get(id)?.excluded ?? new Set<number>(),
      adopt: (view) => (frame === null ? () => undefined : frame.proxy(view)), decorate: horizon.patch,
      ...(host.prepareView === undefined ? {} : { prepare: (view: FarProxyView, current: () => boolean) => host.prepareView?.(view.mesh, current) ?? Promise.resolve() }) });
    this.near = near;
    host.scope.onDispose(() => { near.dispose(); });
    const farPorts = { ...framedPorts, upload: (tile: { instance: string }, data: FarPrepared) => {
      const view: FarProxyView = framedPorts.upload(tile, data), dispose = view.dispose;
      this.farViews.add(tile.instance); this.farMeshes.set(tile.instance, view);
      view.dispose = () => { this.farViews.delete(tile.instance); if (this.farMeshes.get(tile.instance) === view) this.farMeshes.delete(tile.instance); dispose(); };
      const id = tile.instance, entry = { view, excluded: new Set<number>() as ReadonlySet<number> }, mask = view.mask, gone = view.dispose;
      drawnFar.set(id, entry);
      view.mask = (excluded) => { entry.excluded = excluded; mask(excluded); if (near.shows(id)) view.mesh.visible = false; near.remask(id); };
      view.dispose = () => { if (drawnFar.get(id) === entry) drawnFar.delete(id); gone(); };
      if (near.shows(id)) view.mesh.visible = false;
      return view;
    } };
    // SF25 / G66: frozen neighbours look alive (presentation-only client scripts; their sims never step here)
    this.life = new NeighbourLife({ scope: host.scope, simulation: (id) => this.live?.simulation(id), active: (id) => (this.live === null ? this.home.instance : this.live.live.current()) === id });
    // one late system for the grid (the page's onLate takes one label): the alive neighbours, then the one frame's weights
    this.panels = new NeighbourPanels({ scope: host.scope, simulation: (id) => this.live?.simulation(id) });
    // G539: each drawn far view's band (proxy, impostor or the dithered fade between) by the camera's distance to its cell
    const eye = new Vector3();
    const bands = (): void => {
      const camera = host.frame?.camera; if (camera === undefined) return;
      camera.getWorldPosition(eye);
      for (const [id, { view }] of drawnFar) {
        const root = roots.get(id); if (root === undefined || view.band === undefined) continue;
        view.band(farBandShare(Math.hypot(Math.max(0, Math.abs(eye.x - root.position.x) - CHUNK_HALF), Math.max(0, Math.abs(eye.z - root.position.z) - CHUNK_HALF))));
      }
    };
    host.frame?.onLate((dt) => { this.viewStep(); this.life.late(dt); this.panels.late(); bands(); frame?.frame(); });
    const tiles = neighbourTiles(host.scope, async (tile) => {
      // Patch the final shader identity before preparation; no live parent or visibility changes while it yields.
      horizon.patch(tile.group, 'outside');
      await host.prepareTile?.(tile);
    }), tileCost = clientRingCatalogue(tiles.instances);
    // G342 round 3: a cell whose near view draws and carries its own world owns it whole (its dense
    // ground over the cell), so the rings stop refining it to its own L1 / L0 tiles, which would mask the near view near
    // the road (round 3's first A = B); a terrain-only near view (the template, its world in its tiles) keeps them
    this.rings = new RenderRings(this.neighbours, this.allocator, (id, level, x, z) => (level === 'far' ? this.costs.get(id) ?? 1_600_000
      : this.near.owns(id) ? null : tileCost(id, level, x, z)),
      levelPorts<FarPrepared, PreparedRingTile>(farPorts, tiles.ports), { farRadius: FAR_RING.reach });
    this.admitNeighbour = host.renderer === undefined ? undefined : this.tileAdmission(host.renderer, roots, tiles.instances);
    host.scope.onDispose(() => {
      this.rings.dispose();
      for (const root of roots.values()) root.removeFromParent();
    });
    // O15: with a drawn frame, what only draws (rings, screens, shimmer, near view) steps once a frame in the late
    // system above, not on every 60 Hz fixed step: at the phone's 30 fps cap the second step of each frame redid it
    // (rings.step's tile choice and its per-frame upload budget twice a frame, on Driftwood's road entry ~1.6k Simulator
    // samples); headless hosts keep it in the fixed step
    host.onFixed((dt) => { this.step(dt, host.frame === undefined); this.life.fixed(); });
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
  private tileAdmission(renderer: Renderer, roots: ReadonlyMap<string, Group>, instances: Map<string, ClientRingInstance>): (cell: GridCell) => void {
    const scope = this.host.scope, skins = new Map<string, Promise<ReadonlyMap<string, ClientSkin>>>();
    const shared = new Map<string, Promise<{ source: ClientRingInstance['source']; assets: ClientAssets; views: ClientTileViews; bytes: ReadonlyMap<string, Uint8Array>; compile: (entry: unknown) => Material }>>();
    const requested = new Set<string>();
    const admit = async (cell: GridCell): Promise<void> => {
      const root = roots.get(cell.instance); if (root === undefined) return;
      let loading = shared.get(cell.slug);
      if (loading === undefined) {
        const product = gridShardfileProduct(cell.slug, { allocator: this.allocator, scope });
        if (product === null) return;
        loading = (async () => {
          const retained = await product, { admitted, options } = retained, source = admitted.source;
          try {
            if (scope.disposed) throw new Error('Grid product view disposed during admission');
            scope.onDispose(retained.release);
            const presentation = await clientMaterials(source, admitted.assets, renderer, scope);
            return { source, assets: new ClientAssets(source, admitted.assets, options), views: clientTileViews({ terrain: source.terrain, terrainShadow: source.terrain?.shadow, terrainOrder: source.terrain?.order, ...presentation }), bytes: admitted.assets, compile: presentation.compile };
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
    };
    return cell => {
      if (scope.disposed || requested.has(cell.instance)) return;
      requested.add(cell.instance); void admit(cell);
    };
  }

  /** G167: note a neighbour whose shard can't load (an M3 wait or a closing page is not a refusal), for its cell and SHARD SELECT. */
  private refuse(cell: GridCell, error: unknown): void {
    const refusal = classifyRefusal(error);
    if (refusal === null || this.host.scope.disposed) return;
    console.warn(`[grid] ${cell.instance} can't load (${refusal}):`, error);
    this.refusals.set(cell.instance, refusal); this.issues.set(cell.instance, error instanceof Error ? error.message : String(error)); pageShardRefusals().note(cell.slug, refusal);
  }
  /**
   * G555's read-only port: the cell whose entry waits (the one the traveller is in before its gameplay is ready, else the
   * nearest unready cell within 12 m of its edge), with its readiness fences, its claims, its entered hooks since this wait
   * began and its refusal; null when none waits.
   */
  private cellLoadingInput(): CellLoadingInput | null {
    const live = this.live; if (live === null) return null;
    const current = live.live.current(), ready = (id: string): boolean => live.live.ready(id) && (current !== id || live.gameplayReady());
    let target: GridCell | undefined = current !== null && !ready(current) ? this.assembly.cell(current) : undefined;
    if (target === undefined) {
      const at = this.world();
      let best = 12;
      for (const cell of this.assembly.cells) {
        if (ready(cell.instance)) continue;
        const d = Math.hypot(Math.max(0, Math.abs(at.x - cell.origin.x) - CHUNK_HALF), Math.max(0, Math.abs(at.z - cell.origin.z) - CHUNK_HALF));
        if (d <= best) { best = d; target = cell; }
      }
    }
    if (target === undefined) { this.loadingSince.clear(); return null; }
    const id = target.instance, since = this.loadingSince.get(id) ?? performance.now(); this.loadingSince.set(id, since);
    const raw = live.refusal(id), refusal = this.refusal(id);
    const reason = refusal !== null ? refusalReason(refusal)
      : raw instanceof GridCellWaitingError ? GAME_STRINGS.grid.waiting(this.shardName(id)) : null;
    let claimed = 0, product = false;
    for (const entry of this.allocator.claims()) {
      if (entry.owner === id) claimed += entry.bytes;
      if (entry.owner === 'grid' && entry.id === `product:grid:${target.slug}`) { claimed += entry.bytes; product = true; }
    }
    // its entered hooks of this run: from its latest beforeWorld (a road-prepared world ran some before the screen opened)
    const stages = live.live.readiness.status(id), timings = live.hookTimings(), own = timings.completed.filter(row => row.instance === id);
    let run = -1; own.forEach((row, index) => { if (row.hook === 'beforeWorld') run = index; });
    const hooks = new Set((run === -1 ? own.filter(row => row.start >= since) : own.slice(run)).map(row => row.hook));
    const hook = timings.current?.instance === id ? timings.current.hook : null;
    return { instance: id, slug: target.slug, name: this.shardName(id), refusal: reason, product: product || stages.runtime || stages.ready,
      claimedMB: claimed / 1e6, requested: stages.requested, runtime: stages.runtime, colliders: stages.colliders, sim: stages.sim,
      hooks, hook, hybrid: hooks.size > 0 || hook !== null, entered: current === id, gameplayReady: current === id && live.gameplayReady() };
  }
  /** At most four times a second: the loading screen reads the allocator and the live session. */
  private stepCellLoading(): void {
    const now = performance.now(); if (now - this.cellLoadingPolled < 250) return;
    this.cellLoadingPolled = now; this.cellLoading.step(this.cellLoadingInput());
  }
  private refusal(instance: string): ShardRefusal | null {
    const live = this.live?.refusal(instance);
    return this.refusals.get(instance) ?? (live === undefined ? null : classifyRefusal(live));
  }
  private shardName(instance: string): string { const slug = this.assembly.cell(instance).slug; return this.names.get(slug) ?? slug; }

  /** Step 2: the live crossing, once the page's player health and equipment exist (play.ts). */
  attach(page: LiveGridPage): LiveGridSession {
    if (this.live !== null) throw new Error('The grid session already has its live crossing');
    if (this.host.residency === undefined) throw new Error('Grid session requires the early page residency owner');
    this.live = new LiveGridSession({ assembly: this.assembly, home: this.home, physics: this.host.physics, scope: this.host.scope, walls: this.walls, strips: this.strips, allocator: this.allocator,
      residency: this.host.residency.home(),
      neighbourEdges: (cell, origin) => neighbourEdges(cell, { origin }), rimEdges: (origin) => rimEdges(this.assembly, { origin }) }, page);
    return this.live;
  }

  private rebased(mesh: CollisionMesh): CollisionMesh { return { ...mesh, origin: { x: mesh.origin.x - this.home.origin.x, z: mesh.origin.z - this.home.origin.z } }; }
  /** G107 / SF66: a cell's admitted baked map once loaded, retaining the home's full raster size. */
  mapImage(instance: string): HTMLCanvasElement | ImageBitmap | null { return this.mapImages.image(this.assembly.cell(instance).slug); }
  /** the neighbours' baked maps held now (bytes), for the memory readouts */
  get mapImageBytes(): number { return this.mapImages.bytes; }
  /** The traveller's feet in grid metres, whatever frame it is in. */
  worldFeet(): { x: number; z: number } { return this.world(); }

  /** World feet (grid metres) from the home-frame feet. */
  private world(): { x: number; z: number } {
    if (this.live !== null) { const feet = this.live.worldFeet(); return { x: feet.x, z: feet.z }; }
    const feet = this.host.feet(); return { x: feet.x + this.home.origin.x, z: feet.z + this.home.origin.z };
  }

  /** One fixed step: the rings from the player's world pose and velocity, then the cell events. `view` false: the
   *  drawn parts (`viewStep`) wait for the frame's late system. */
  step(dt: number, view = true): void {
    const at = this.world();
    if (this.last !== null && dt > 0) { this.velocity = { x: (at.x - this.last.x) / dt, z: (at.z - this.last.z) / dt }; }
    this.last = at;
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    // Match L1's 400 m reach plus the rings' four-second travel lookahead. Distant
    // cells keep their baked proxy without admitting their full product at boot.
    for (const cell of this.neighbours) {
      const distance = Math.hypot(Math.max(0, Math.abs(at.x - cell.origin.x) - CHUNK_HALF), Math.max(0, Math.abs(at.z - cell.origin.z) - CHUNK_HALF));
      if (this.assembly.approaching(distance, 400 + Math.min(speed, 60) * 4)) this.admitNeighbour?.(cell);
    }
    this.softWalls.step();
    if (view) this.viewStep();
    const inside = this.assembly.at(at.x, at.z), active = this.live === null ? this.home.instance : this.live.live.current();
    if (inside === undefined || inside.instance !== active) gridCells.leave();
    else gridCells.enter({ instance: inside.instance, slug: inside.slug });
  }

  /** What only draws, from the last fixed step's pose and velocity: the rings, the screens, the shimmer, the near view. */
  private viewStep(): void {
    const at = this.last ?? this.world(), speed = Math.hypot(this.velocity.x, this.velocity.z), clamp = speed > 60 ? 60 / speed : 1; // a respawn's jump is not a velocity
    this.rings.step({ x: at.x, z: at.z, vx: this.velocity.x * clamp, vz: this.velocity.z * clamp });
    for (const cell of this.neighbours) if (this.near.owns(cell.instance)) this.rings.retireRefinement(cell.instance);
    this.stepCellLoading();
    this.shimmer.step();
    const active = this.live === null ? this.home.instance : this.live.live.current();
    const eye = this.host.eye?.();
    this.near.update(eye === undefined || !Number.isFinite(eye.x) || !Number.isFinite(eye.z) ? at : { x: at.x + eye.x, z: at.z + eye.z }, active);
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

  /** Publish the current feet's existing sky/grade owners before boot shader preparation.
   * This runs only the presentation frame; no neighbour tick, input, physics or simulation is advanced. */
  prepareFrame(): void { this.frame?.frame(); }

  /** The readout: what each cell shows, the rings and the allocator. */
  state(): GridSessionState {
    const stats = this.rings.stats(), residentKeys = this.rings.resident(), resident = new Set(residentKeys.map((key) => key.split(':')[0]));
    const at = this.world(), cost = this.allocator.cost(), playing = this.live === null ? this.home.instance : this.live.live.current();
    const tiles = (instance: string, level: 'l1' | 'l0'): number => residentKeys.filter((key) => key.startsWith(`${instance}:${level}/`)).length;
    const drawn = (instance: string): GridCellDrawn => ({ far: this.farMeshes.get(instance)?.mesh.visible === true, near: this.near.visible(instance), l1: tiles(instance, 'l1'), l0: tiles(instance, 'l0') });
    // the home off its cell (an owned home on the road) is drawn like any neighbour; `frozen` only when no layer draws it
    const shows = (instance: string, d: GridCellDrawn): GridCellShows => instance === playing ? 'playing'
      : d.near ? 'near' : d.far ? 'far proxy' : d.l1 + d.l0 > 0 ? 'tiles' : instance === this.home.instance ? 'frozen' : resident.has(instance) ? 'far proxy' : 'loading';
    return {
      home: this.home.instance, inside: gridCells.cell?.instance ?? null, feet: { x: Math.round(at.x * 100) / 100, z: Math.round(at.z * 100) / 100 },
      cells: this.assembly.cells.map((cell) => { const d = drawn(cell.instance); return { instance: cell.instance, slug: cell.slug, cell: cell.cell, shows: shows(cell.instance, d), drawn: d }; }),
      strips: this.strips.length, road: this.road, seams: this.seams, softWalls: this.softWalls.state(), shimmer: this.shimmer.state(), cellLoading: this.cellLoading.open, ringsReady: this.rings.ready(),
      residentMB: Math.round(cost.accounted / 1e4) / 100, playingMB: Math.round(cost.playing / 1e4) / 100,
      accountedBytes: cost.accounted,
      rings: { frame: stats.frame, far: stats.resident.far, l1: stats.resident.l1, l0: stats.resident.l0, refused: stats.refused, inFlight: stats.inFlight, queued: stats.queued },
      frame: this.frame?.state() ?? null,
      live: this.live?.state() ?? null,
      life: this.life.state(),
      near: this.near.state(),
    };
  }
}

/** Generate the platform; a platform the generator refuses (an edge past the cliff envelope, an entry off road height)
 *  falls back to road-level edges. A disposed page stops between slices and builds nothing more. */
async function platformStrips(assembly: GridAssembly, edges: readonly PlatformCell[] | undefined,
  generate: (cells: readonly PlatformCell[], empty: StripProfile) => Promise<readonly GeneratedStrip[]>): Promise<readonly GeneratedStrip[]> {
  const { cells, flat, empty } = platformInputs(assembly, edges);
  try { return await generate(cells, empty); } catch (error) {
    if (error instanceof Error && error.message === 'Grid admission scope disposed') throw error; // the page left mid-generation
    console.warn('[grid] the platform keeps road-level edges:', error); return generate(flat, empty);
  }
}
function platformStripsNow(assembly: GridAssembly, edges: readonly PlatformCell[] | undefined): readonly GeneratedStrip[] {
  const { cells, flat, empty } = platformInputs(assembly, edges);
  try { return generatePlatform(cells, empty); } catch (error) { console.warn('[grid] the platform keeps road-level edges:', error); return generatePlatform(flat, empty); }
}
