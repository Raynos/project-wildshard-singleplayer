import type { SimExternalPlayer, SimHost } from '@wildshard/engine/sim';
import { snapshotSimHost, snapshotSimHostBytes, finishSimSteps, type SimSnapshot, type SimSnapshotBytes } from '@wildshard/engine/sim/snapshot';
import { prepareFrameMotors, type FrameMember } from '@wildshard/engine/physics/frame';
import type { Physics } from '@wildshard/engine/physics/Physics';
import { TraversalReadiness, readinessModel, type ReadinessBundle, type ReadinessLink, type ReadinessTicket } from '@wildshard/engine/sim/readiness';
import type { ReadinessWalls } from '@wildshard/engine/physics/readinessWalls';
import { CHUNK_HALF, CONTENT_CAPS, ENTRY_WIDTH } from '@wildshard/engine/core/config';
import { diagnosticNow } from '@wildshard/engine/core/clock';
import { GhostWorlds, type GhostRegion } from './ghosts';
import { WORK_SLICE_MS, workSlice } from '@wildshard/engine/core/workSlice';
import type { DisposeStep } from '@wildshard/engine/app/scope';
import type { GridAssembly, GridCell, GridPoint } from './assembly';
import type { ResidencyAllocator, ResidencyLease, ResidencyEviction } from './allocator';
import type { PreparedGridCrossing } from './crossing';
import { GridContinuationCache, GRID_CONTINUATION_CACHE_BYTES } from './continuations';
import type { HomeResidencyClaim } from './pageResidency';
import { ApproachInputsDeferredError } from './productInputs';
import { clientPreparationBatch } from '../shardfile/preparationTiming';
import { tileOf, type CellTile } from '../shardfile/tileOrder';

/** An owned region has authored colliders and logical player state, but no second traveller capsule. */
export interface LiveGridRegion { host: SimHost; dispose: () => void;
  /** M6 (G628): what should be collected once the region retires (its scope, its view root, its world); absent watches the
   *  region itself (`GhostWorlds`) */
  ghostRoots?: readonly object[];
  /** O20: the same disposal as steps (`Scope.disposeSteps`), so a retirement after a crossing spreads over frames */
  retire?: () => Generator<DisposeStep, void>;
  /** Opaque runtimes own logical checkpoints; native shardfile hosts use the exact codec below. */
  checkpoint?: () => boolean; walls?: ReadinessWalls }
/** Immutable content is admitted before its sim claim and world allocation; trusted runtime preparation imports only. */
export interface LiveGridAdmission {
  bytes: number;
  /** `signal` aborts a road-approach build when the traveller commits to a crossing into another cell: stop at the next safe
   * point and reject, disposing what was built (T7). */
  create: (saved: SimSnapshot | undefined, claim: ResidencyLease, signal?: AbortSignal) => Promise<LiveGridRegion>;
  /** Release an unpublished product lease on refusal/cancellation. Idempotent after failed create or region disposal;
   *  successful publication transfers release to the returned region's dispose. */
  cancel?: () => void;
  prepareRuntime?: () => Promise<void>;
  /** Trusted factory reads its durable exact/logical continuation after preparing the immutable physics basis. */
  reloadsCheckpoint?: boolean;
  /** Opaque foundations stay mutually exclusive unless their trusted factory explicitly promises isolated preparation. */
  exclusiveRuntime?: boolean;
  /** Trusted bodyless declarative/client-plan construction owns its bindings and defers entered services.
   * Unknown/legacy factories never opt in merely because they accept an abort signal. */
  isolatedPreparation?: boolean;
  /** Declared render tiles can prepare a neighbour without constructing its region. */
  tilePreparation?: boolean;
}
/** G226: the initial home is an ordinary owned region; the neutral page constructs none of its opaque content. */
export interface LiveGridOwnedHome { mode: 'owned'; instance: string; bytes: number; residency: HomeResidencyClaim }
/** Neutral shell physics and its one traveller remain page-owned; disposal removes only platform installations. */
export interface LiveGridHighway { physics: Physics; dispose: () => void; walls?: ReadinessWalls; afterPlayerStep?: () => void }
/** An infallible prepared assignment rebinds the existing page world/player and the renderer's local origin. */
export interface LiveGridFrame { instance: string | null; physics: Physics; motor: FrameMember['motor']; origin: Readonly<{ x: number; z: number }>; host?: SimHost }
/** One live fixed-step owner supplies movement; region clocks/systems run only after that move. */
export interface LiveGridPorts {
  home: LiveGridOwnedHome; player: SimExternalPlayer & FrameMember; allocator: ResidencyAllocator;
  highway: { bytes: number; create: () => LiveGridHighway };
  /** Passive metadata may defer on headroom; required entry retains ordinary admission. */
  admit: (cell: GridCell, required?: boolean) => Promise<LiveGridAdmission>;
  /** Actual world construction or a verified render approach outranks product-only prefetch until its finite preparation drains. */
  prioritize?: (cell: GridCell) => () => void;
  /** Render-only approach: the signal owns the pin, including after preparation completes. */
  prepareNeighbour?: (cell: GridCell, start: { readonly x: number; readonly z: number }, signal: AbortSignal) => Promise<void>;
  /** Verified, charged inputs for one named source-exit approach, held until
   * abort. No regional world/readiness may publish from this IO-only port. */
  prepareTransport?: (cell: GridCell, signal: AbortSignal) => Promise<void>;
  /** Browser presentation boundary between admission batches; absent leaves the standalone Node scheduler unchanged. */
  pause?: () => Promise<void>;
  /** Metadata-only prefetch eligibility. Unsupported far proxies do not consume cold request slots; explicit transfers
   *  still run normal admission and readiness. Absent: every cell is a candidate, as in standalone Node drivers. */
  prefetchable?: (cell: GridCell) => boolean;
  /** Product-only prefetch waits while this is false (T10: the page's spawn settle); required entry never waits. Absent: always. */
  backgroundReady?: () => boolean;
  save: (instance: string, snapshot: SimSnapshot) => boolean;
  /** The same save in stages (each `yield` may wait a frame) for {@link LiveGridHost.checkpointSteps}; absent saves in one stage. */
  saveSteps?: (instance: string, snapshot: SimSnapshot) => Generator<undefined, boolean>;
  /** Optional durable writer accepting native capture bytes without a boxed physics array. Used only with durable
   *  continuations; absent preserves the legacy capture/cache/save ports exactly. The generator owns no live host. */
  saveBytesSteps?: (instance: string, snapshot: SimSnapshotBytes) => Generator<undefined, boolean>;
  read?: (instance: string) => SimSnapshot | undefined;
  bindFrame: (frame: LiveGridFrame) => void;
  gameplayReady: (instance: string) => boolean;
  readiness: { link: ReadinessLink; bundle: (cell: GridCell) => ReadinessBundle };
  mount?: () => FrameMember | undefined;
  /** Durable-only factories retain no packed snapshots; admission refuses a factory without a durable read capability. */
  continuations?: 'memory' | 'durable';
  /** Keep only the last departed isolated world on the road. Its original
   * full claim stays unneeded/evictable; no new world may overlap it. */
  lastCell?: { readonly windowMs: number; readonly playingBytes: number;
    readonly schedule: (expire: () => void, delayMs: number) => () => void };
  /** G580 T2: told once before a resident's retirement or unload disposes its world, so its compiled programs can be kept
   *  for the next world; never refuses a retirement. Absent keeps nothing. */
  keepPrograms?: (instance: string) => void;
}
/** Crossing telemetry is a production port: the harness verifies real fixed-boundary commits, never a page/debug probe. */
export interface LiveGridState {
  current: string | null; worldFeet: GridPoint; crossings: number;
  /** Last complete world remains fully charged and pressure-evictable on the road. */
  retainedCell?: { readonly instance: string; readonly remainingMs: number; readonly playingBytes: number; readonly capBytes: number } | null;
  transitions: readonly { from: string | null; to: string | null }[];
  residents: readonly string[]; pending: readonly string[]; issues: Readonly<Record<string, string>>;
  gameplayReady: boolean;
  continuations: { entries: number; storedChars: number; capacityChars: number; claimedBytes: number };
  /** O20: the latest region retirements, how long each one's checkpoint and disposal took (ms) */
  retirements?: readonly Retirement[];
  /** O20: regions still retiring in steps (out of `residents`, their claims still held) */
  retiring?: readonly string[];
  /** M6 (G628): ghost worlds (retired regions still alive 30 s on) and every retired region not yet collected */
  ghosts?: { readonly count: number; readonly regions: readonly GhostRegion[] };
}
/** O20: one region retirement: its checkpoint, its disposal's whole span, and for a sliced one its steps and slowest step */
export interface Retirement { instance: string; checkpointMs: number; disposeMs: number; steps?: number; workMs?: number; slowestStepMs?: number; slowestStep?: string; failed?: boolean }
interface RetiringRegion { readonly instance: string; readonly resident: Resident; readonly steps: Generator<DisposeStep, void>;
  readonly checkpointMs: number; readonly start: number; count: number; workMs: number; slowestMs: number; slowest: string; done: boolean;
  /** settles when `finishRetirement` ran (its claim released, or kept on failure) */
  readonly finished: Promise<void>; readonly settle: () => void }
interface Resident { region: LiveGridRegion; lease: ResidencyLease; reloadsCheckpoint: boolean; reservations: number; evicting: boolean; retainable: boolean; evictionBound?: boolean; disposalFailed?: boolean }

// Contact corrections at a closed readiness wall are not a U-turn. Accumulate real horizontal travel
// before selecting another approach, so sub-centimetre capsule recoil cannot evict the world just prepared.
const APPROACH_TRAVEL_METRES = 0.1;
const entryAxes = [['x', 'z'], ['z', 'x']] as const;
// Distance can decrease while passing parallel to a cell. Only a ray into its first boundary's midpoint mouth
// predicts entry; product downloads remain radial, but an unrelated native world must not block the real turn-in.
function headsToEntry(cell: GridCell, feet: GridPoint, previous: GridPoint): boolean {
  const delta = { x: feet.x - previous.x, z: feet.z - previous.z };
  let first = Infinity, offset = Infinity;
  for (const [axis, other] of entryAxes) for (const side of [-1, 1]) {
    const direction = delta[axis]; if (direction === 0) continue;
    const time = (cell.origin[axis] + side * CHUNK_HALF - feet[axis]) / direction;
    if (time < 0 || time >= first) continue;
    const lateral = Math.abs(feet[other] + time * delta[other] - cell.origin[other]);
    if (lateral <= CHUNK_HALF) { first = time; offset = lateral; }
  }
  return offset <= ENTRY_WIDTH / 2;
}

// A boulevard predicts its next midpoint turn, before the player aims at the perpendicular mouth.
// A small lateral turn names its side before the ray reaches the narrow mouth.
// Straight travel retains both sides, so an undecided junction remains ambiguous.
function boulevardApproachDistance(cell: GridCell, feet: GridPoint, previous: GridPoint, pitch: number): number | undefined {
  const delta = { x: feet.x - previous.x, z: feet.z - previous.z };
  for (const [axis, other] of entryAxes) for (const side of [-1, 1]) {
    const road = cell.origin[axis] + side * pitch / 2, lateral = cell.origin[other] - feet[other];
    if (Math.abs(feet[axis] - road) > ENTRY_WIDTH / 2 || Math.abs(delta[axis]) > Math.abs(delta[other]) / 4
      || delta[other] * lateral <= 0 || delta[axis] * side > Math.abs(delta[other]) / 20) continue;
    return Math.abs(lateral) + pitch / 2 - CHUNK_HALF;
  }
  return undefined;
}

/** Real background failures stay closed until retry. Expected optional headroom
 * deferrals remain retryable after cost changes and never report a load failure. */
async function background(instance: string, admission: Promise<unknown>, alive: () => boolean): Promise<void> {
  try { await admission; }
  catch (error) { if (alive() && !(error instanceof ApproachInputsDeferredError)) console.error(`[grid] ${instance}: admission failed; it stays closed until a retry`, error); }
}

/** One page traveller with frozen owned regions. Borrowed homes keep the existing standalone composition;
 * owned homes begin on neutral page physics and transfer the sole preallocation claim to their first runtime. */
export class LiveGridHost {
  readonly readiness: TraversalReadiness = new TraversalReadiness();
  private readonly residents = new Map<string, Resident>();
  private readonly saved = new GridContinuationCache();
  private readonly cacheLease: ResidencyLease | undefined;
  private readonly requests = new Map<string, Promise<void>>();
  /** Admitted constructors own the product they consumed; queued requests may still prefetch theirs. */
  private readonly constructing = new Set<string>();
  private readonly retirements: Retirement[] = [];
  private readonly ghosts = new GhostWorlds();
  private readonly retiring = new Map<string, RetiringRegion>();
  private readonly products = new Map<string, LiveGridAdmission>();
  /** Verified render capability only; runtime import completion still gates products/readiness. */
  private readonly tileMetadata = new Set<string>();
  private readonly productRequests = new Map<string, { work: Promise<LiveGridAdmission>; required: boolean }>();
  private readonly deferredProducts = new Map<string, number>();
  private readonly issues = new Map<string, string>();
  private readonly refusals = new Map<string, unknown>();
  /** One failed cold unload per excursion; quota failures retain their full claim until retry or re-approach. */
  private readonly coldUnloadRefused = new Set<string>();
  private readonly frames = new Set<() => void>();
  private frameGeneration = 0;
  private readonly transitions: { from: string | null; to: string | null }[] = [];
  private crossings = 0;
  private previousFeet: GridPoint | undefined;
  private readonly candidateDistances = new Map<GridCell,number>();
  private readonly approachWork:{candidates:GridCell[];boulevard:GridCell[]}[]=[];
  /** This host already owns the assembly and its frozen cells for its whole lifetime. */
  private targetCells: readonly GridCell[] | undefined;
  private initialHomePending: boolean;
  private readonly highwayLease: ResidencyLease;
  private readonly highway: LiveGridHighway;
  private sequence: Promise<void> = Promise.resolve();
  private active: string | null;
  private lastCell: { readonly instance: string; readonly until: number; cancel: () => void } | null = null;
  private unbind: (() => void) | undefined;
  private disposed = false;
  /** Each checkpoint of an instance takes a generation; a staged one still waiting is superseded by any later one. */
  private readonly checkpointGenerations = new Map<string, number>();
  private highwayDisposed = false;
  readonly assembly: GridAssembly;
  private readonly ports: LiveGridPorts;

  constructor(assembly: GridAssembly, ports: LiveGridPorts) {
    this.assembly = assembly; this.ports = ports;
    if (ports.lastCell !== undefined && (!Number.isFinite(ports.lastCell.windowMs) || ports.lastCell.windowMs <= 0 || ports.lastCell.windowMs > 60_000
      || !Number.isSafeInteger(ports.lastCell.playingBytes) || ports.lastCell.playingBytes <= 0)) throw new RangeError('Invalid last-cell retention policy');
    this.active = null; this.initialHomePending = true;
    if (ports.continuations !== 'durable') {
      const cacheId = `sim-continuations:live:${ports.home.instance}`;
      if (ports.allocator.has(cacheId)) throw new Error('Live continuation cache already has an owner');
      const cacheLease = ports.allocator.reserve({ id: cacheId, category: 'sim', owner: ports.home.instance, bytes: GRID_CONTINUATION_CACHE_BYTES, distance: 0, needed: true });
      if (cacheLease === null) throw new Error('Live continuation cache admission deferred by the shared budget');
      this.cacheLease = cacheLease;
    }
    try {
      this.validateHomeClaim(ports.home.residency);
      this.highwayLease = this.claim('platform.highway', ports.highway.bytes, true);
      try { this.highway = ports.highway.create(); try {
        if (this.highway.physics.world.getCollider(ports.player.motor.collider.handle) !== ports.player.motor.collider) throw new Error('Neutral highway must contain the existing page traveller');
      } catch (error) { this.highway.dispose(); throw error; } }
      catch (error) { this.highwayLease.release(); throw error; }
    } catch (error) { this.cacheLease?.release(); throw error; }
  }
  private validateHomeClaim(claim: HomeResidencyClaim): void {
    const home = this.ports.home;
    if (claim.instance !== home.instance || claim.bytes !== home.bytes || claim.allocator !== this.ports.allocator) throw new Error('Live home residency differs from its admitted page claim');
  }
  private claim(instance: string, bytes: number, needed: boolean): ResidencyLease {
    const lease = this.ports.allocator.reserve({ id: `sim:${instance}`, category: 'sim', owner: instance, bytes, distance: 0, needed });
    if (lease === null) throw new Error('Live sim admission deferred by the shared budget');
    return lease;
  }
  private checkRegion(region: LiveGridRegion): void {
    if (region.host.embedded || region.host.hasPlayerMotor) throw new Error('Live regional host must be owned and bodyless');
  }
  /** Null identifies the permanent highway/strip world. */
  current(): string | null { return this.active; }
  private origin(instance: string | null): { x: number; z: number } { return instance === null ? { x: 0, z: 0 } : this.assembly.cell(instance).origin; }
  private region(instance: string | null): LiveGridRegion | undefined { return instance === null ? undefined : this.residents.get(instance)?.region; }
  private physics(instance: string | null): Physics {
    if (instance === null) return this.highway.physics;
    const region = this.region(instance); if (region === undefined) throw new Error('Live grid region is not admitted'); return region.host.physics;
  }
  /** Render/global coordinates are derived, never written into an authored regional host. */
  worldFeet(): GridPoint { const p = this.ports.player.position, origin = this.origin(this.active); return { x: p.x + origin.x, y: p.y, z: p.z + origin.z }; }
  /** Pure 6 m enter / 10 m leave selection; calling it does not change the live page frame. */
  target(feet: Readonly<GridPoint>): string | null {
    if (![feet.x, feet.y, feet.z].every(Number.isFinite)) throw new RangeError('Invalid live grid feet');
    const distance = (cell: GridCell): number => Math.max(Math.abs(feet.x - cell.origin.x), Math.abs(feet.z - cell.origin.z)) - CHUNK_HALF;
    if (this.active !== null && distance(this.assembly.cell(this.active)) <= 10) return this.active;
    const cells = this.targetCells ??= [...this.assembly.cells].sort((a, b) => a.instance.localeCompare(b.instance));
    return cells.find((cell) => distance(cell) <= 6)?.instance ?? null;
  }
  /** Admission includes colliders, initialized sim and parsed runtime module; entered hooks are a separate gameplay fence. */
  ready(instance: string | null): boolean {
    if (this.disposed) return false;
    if (instance === null) return true;
    const resident = this.residents.get(instance);
    return resident !== undefined && !resident.evicting && !resident.disposalFailed && this.readiness.isReady(instance);
  }
  /** Submit whole-shard requests in stable order. Failed attempts remain closed until an explicit retry. */
  prefetch(instances: readonly string[]): Promise<void> { return Promise.all([...new Set(instances)].sort().map((id) => this.residents.has(id) || (!this.disposed && this.constructing.has(id)) || this.deferredProducts.get(id) === this.ports.allocator.revision ? Promise.resolve() : this.prefetchProduct(id))).then(() => undefined); }
  private async requireProduct(instance: string, pending: Promise<LiveGridAdmission>): Promise<LiveGridAdmission> {
    try { return await pending; }
    catch (error) {
      if (!(error instanceof ApproachInputsDeferredError)) throw error;
      return this.prefetchProduct(instance, true);
    }
  }
  private prefetchProduct(instance: string, required = false): Promise<LiveGridAdmission> {
    this.assertAlive(); const cell = this.assembly.cell(instance);
    const product = this.products.get(instance); if (product !== undefined) return Promise.resolve(product);
    const pending = this.productRequests.get(instance);
    if (pending !== undefined) return !required || pending.required ? pending.work : this.requireProduct(instance, pending.work);
    const issue = this.issues.get(instance); if (issue !== undefined) return Promise.reject(new Error(issue));
    const timing = clientPreparationBatch(cell.slug, `grid.product:${instance}`, ['admission', 'runtime']);
    const request = (async (): Promise<LiveGridAdmission> => {
      let admission: LiveGridAdmission | undefined;
      try {
        await Promise.resolve(); this.assertAlive();
        const admitted = timing === undefined ? await this.ports.admit(cell, required) : await timing.run('admission', () => this.ports.admit(cell, required));
        admission = admitted; this.assertAlive();
        if (admission.tilePreparation === true) this.tileMetadata.add(instance);
        const bundle = this.ports.readiness.bundle(cell);
        if ((bundle.hybridWireBytes > 0 || admission.exclusiveRuntime === true) && admission.prepareRuntime === undefined) throw new Error('Hybrid runtime admission is missing');
        await (timing === undefined ? admission.prepareRuntime?.() : timing.run('runtime', async () => { await admitted.prepareRuntime?.(); }));
        this.assertAlive();
        this.deferredProducts.delete(instance); this.products.set(instance, admission); return admission;
      } catch (error) {
        this.tileMetadata.delete(instance);
        if (this.tileApproach?.instance === instance) { this.tileApproach.controller.abort(); this.tileApproach = null; }
        if (!required && error instanceof ApproachInputsDeferredError) this.deferredProducts.set(instance, this.ports.allocator.revision);
        else { this.issues.set(instance, error instanceof Error ? error.message : String(error)); this.refusals.set(instance, error); }
        try { admission?.cancel?.(); }
        catch (cleanup) { throw new AggregateError([error, cleanup], 'Live product admission and cancellation failed', { cause: cleanup }); }
        throw error;
      } finally { this.productRequests.delete(instance); timing?.finish(); }
    })();
    this.productRequests.set(instance, { work: request, required }); return request;
  }
  private tileApproach: { instance: string; tile: CellTile; controller: AbortController } | null = null;
  private transportApproach: { instance: string; controller: AbortController; work: Promise<void> } | null = null;
  private retiredTransport: Promise<void> = Promise.resolve();
  private stopApproachTransport(): void {
    const previous = this.transportApproach; if (previous === null) return;
    this.transportApproach = null; previous.controller.abort();
    this.retiredTransport = this.settle(previous.work);
  }
  private prepareApproachTransport(cell: GridCell): void {
    const prepare = this.ports.prepareTransport;
    if (prepare === undefined || this.transportApproach?.instance === cell.instance) return;
    this.stopApproachTransport();
    const controller = new AbortController(), previous = this.retiredTransport;
    // Acquire priority synchronously, before this tick's speculative IO runs.
    // The old key keeps its own priority until its already-started reads drain.
    const releasePriority = this.ports.prioritize?.(cell);
    const work = (async (): Promise<void> => {
      try { await previous; if (!this.disposed && !controller.signal.aborted) await prepare(cell, controller.signal); }
      finally { releasePriority?.(); }
    })();
    const approach = { instance: cell.instance, controller, work }; this.transportApproach = approach;
    void background(cell.instance, work, () => !this.disposed && !controller.signal.aborted);
  }
  private prepareNeighbour(cell: GridCell, feet: GridPoint): void {
    const start = { x: Math.max(-CHUNK_HALF, Math.min(CHUNK_HALF, feet.x - cell.origin.x)),
      z: Math.max(-CHUNK_HALF, Math.min(CHUNK_HALF, feet.z - cell.origin.z)) };
    const tile = tileOf(start.x, start.z), prior = this.tileApproach;
    if (prior?.instance === cell.instance && prior.tile.i === tile.i && prior.tile.j === tile.j) return;
    // A diagonal approach can reach another mouth of the same destination.
    // Retarget only across tile boundaries; keep exactly one speculative pin.
    prior?.controller.abort();
    const controller = new AbortController();
    this.tileApproach = { instance: cell.instance, tile, controller };
    const prepare = this.ports.prepareNeighbour;
    if (prepare === undefined) return;
    const pending = (async (): Promise<void> => {
      const releasePriority = this.ports.prioritize?.(cell);
      try { await prepare(cell, start, controller.signal); }
      finally { releasePriority?.(); }
    })();
    void background(cell.instance, pending, () => !this.disposed && !controller.signal.aborted);
  }
  private ensure(instance: string): Promise<void> {
    if (this.disposed) return Promise.reject(new Error('Live grid is disposed'));
    const cell = this.assembly.cell(instance);
    if (this.transportApproach?.instance !== instance) this.stopApproachTransport();
    if (this.residents.has(instance)) return Promise.resolve();
    const pending = this.requests.get(instance); if (pending !== undefined) return pending;
    const issue = this.issues.get(instance); if (issue !== undefined) return Promise.reject(new Error(issue));
    const bundle = this.ports.readiness.bundle(cell), estimate = readinessModel(bundle, this.ports.readiness.link);
    const ticket = this.readiness.request(instance, 0, estimate, bundle.hybridWireBytes > 0);
    if (ticket === null) return Promise.reject(new Error('Stale live grid readiness request'));
    const transport = this.transportApproach, releasePriority = this.ports.prioritize?.(cell);
    const request = this.admitRegion(cell, bundle, ticket, this.sequence).finally(() => {
      if (transport !== null && this.transportApproach === transport) this.stopApproachTransport();
      releasePriority?.();
    });
    this.requests.set(instance, request); this.sequence = this.settle(request); return request;
  }
  private assertAlive(): void { if (this.disposed) throw new Error('Live grid is disposed'); }
  private async settle(request: Promise<void>): Promise<void> { try { await request; } catch { /* The requesting owner receives the admission error. */ } }
  private async admitRegion(cell: GridCell, bundle: ReadinessBundle, ticket: ReadinessTicket, previous: Promise<void>): Promise<void> {
    const instance = cell.instance, timing = clientPreparationBatch(cell.slug, `grid.prepare:${cell.instance}`, ['queue', 'metadata', 'create']);
    let admission: LiveGridAdmission | undefined;
    try {
      await (timing === undefined ? previous : timing.run('queue', () => previous));
      await this.retiredTransport;
      this.assertAlive();
      const admitted = timing === undefined ? await this.prefetchProduct(instance, true) : await timing.run('metadata', () => this.prefetchProduct(instance, true));
      admission = admitted;
      this.assertAlive();
      // its previous world may still be retiring (a stepped eviction or `retire`): its claim, under the same id, is released
      // only at its last step, so this admission's claim waits for it (T10 sliced eviction)
      for (let retiring = this.retiring.get(instance); retiring !== undefined; retiring = this.retiring.get(instance)) { await retiring.finished; this.assertAlive(); }
      // A failed disposal stays fully charged and blocks construction even if the pair's budget would fit.
      if ([...this.residents.values()].some((row) => row.disposalFailed === true)) throw new Error('Exclusive runtime awaits successful disposal');
      this.products.delete(instance);
      this.constructing.add(instance);
      if (this.ports.continuations === 'durable' && admitted.reloadsCheckpoint !== true && this.ports.read === undefined) throw new Error('Durable-only live regions require a checkpoint reader before allocation');
      let lease: ResidencyLease;
      if (instance === this.ports.home.instance && this.initialHomePending) {
        // Runtime admission has checked the same measured source and manifest. Transfer only that exact whole cost;
        // until then the boot owner retains its sole reference and can abort without any regional world existing.
        lease = this.ports.home.residency.handoff(admitted.bytes); this.initialHomePending = false;
      } else {
        if (this.initialHomePending) {
          // Road recovery may enter another opaque runtime first. No home content has been allocated, so retire its
          // unused boot reservation before requesting the destination budget; a future home visit is ordinary admission.
          this.ports.home.residency.releasePending(); this.initialHomePending = false;
        }
        lease = this.claim(instance, admitted.bytes, true);
      }
      let region: LiveGridRegion | undefined;
      try {
        const prior = this.saved.read(instance) ?? this.ports.read?.(instance);
        const packed = prior === undefined || this.ports.continuations === 'durable' ? undefined : this.saved.pack(instance, prior);
        if (packed === null) throw new Error('Live continuation cache capacity exceeded');
        if (bundle.hybridWireBytes > 0 && admitted.prepareRuntime === undefined) throw new Error('Hybrid runtime admission is missing');
        this.assertAlive(); this.readiness.complete(ticket, 'runtime');
        if (this.ports.pause !== undefined) await this.ports.pause();
        this.assertAlive();
        region = timing === undefined ? await admitted.create(prior, lease) : await timing.run('create', () => admitted.create(prior, lease));
        this.checkRegion(region);
        if (this.ports.pause !== undefined) await this.ports.pause();
        this.assertAlive();
        if (packed !== undefined) this.saved.store(instance, packed);
        this.residents.set(instance, { region, lease, reloadsCheckpoint: admitted.reloadsCheckpoint === true || this.ports.read !== undefined, reservations: 0, evicting: false, retainable: admitted.isolatedPreparation === true });
        this.readiness.complete(ticket, 'colliders'); this.readiness.complete(ticket, 'sim');
        lease.update({ needed: false, distance: this.distance(cell) });
      } catch (error) {
        try { region?.dispose(); }
        catch (cleanup) {
          if (region !== undefined) this.residents.set(instance, { region, lease, reloadsCheckpoint: admitted.reloadsCheckpoint === true,
            reservations: 0, evicting: false, retainable: false, disposalFailed: true });
          admission = undefined; // The retained world still owns its product and its full claim.
          throw new AggregateError([error, cleanup], 'Live region creation and disposal failed', { cause: cleanup });
        }
        lease.release(); throw error;
      }
    } catch (error) {
      this.readiness.invalidate(instance);
      this.issues.set(instance, error instanceof Error ? error.message : String(error)); this.refusals.set(instance, error);
      this.products.delete(instance);
      try { admission?.cancel?.(); }
      catch (cleanup) { throw new AggregateError([error, cleanup], 'Live admission and product cancellation failed', { cause: cleanup }); }
      throw error;
    } finally { this.constructing.delete(instance); this.requests.delete(instance); timing?.finish(); }
  }
  private forgetLastCell(instance?: string): void {
    const last = this.lastCell;
    if (last === null || instance !== undefined && last.instance !== instance) return;
    this.lastCell = null; last.cancel();
  }
  private retainedFits(instance: string): boolean {
    const policy = this.ports.lastCell;
    return policy !== undefined && this.ports.allocator.ownerCost(instance).playing <= Math.min(CONTENT_CAPS.playing, policy.playingBytes);
  }
  /** Call only after entered leave hooks finish. Keep the same ready world,
   * without a second claim, snapshot, physics host or shader preparation. */
  retainDeparted(instance: string): boolean {
    const policy = this.ports.lastCell, resident = this.residents.get(instance);
    if (this.disposed || this.active !== null || policy === undefined || resident?.retainable !== true
      || resident.evicting || resident.disposalFailed === true || !this.retainedFits(instance)) return false;
    if (this.lastCell?.instance === instance) return true;
    // Install the existing program keeper before this world can be an allocator
    // eviction candidate: eviction callbacks may not reserve their own claims.
    this.ports.keepPrograms?.(instance);
    if (!this.retainedFits(instance)) return false;
    if (resident.evictionBound !== true) {
      const bind = resident.lease.evictWith;
      if (bind === undefined) return false;
      try {
        bind(() => {
          if (this.residents.get(instance) !== resident) return null;
          const prepared = this.prepareUnload(instance);
          if (prepared === null) return null;
          const steps = prepared.steps;
          return { abort: prepared.abort, commit: () => {
            prepared.commit();
            // A failed disposer keeps its full claim; never let allocator
            // eviction remove it merely because the callback returned.
            if (this.residents.get(instance) === resident) throw new Error('Retained world disposal failed');
          }, ...(steps === undefined ? {} : { steps: () => this.checkedEviction(steps(), instance, resident) }) };
        });
        resident.evictionBound = true;
      } catch { return false; }
    }
    this.forgetLastCell();
    const last = { instance, until: diagnosticNow() + policy.windowMs, cancel: (): void => undefined };
    this.lastCell = last;
    try {
      last.cancel = policy.schedule(() => {
        if (this.lastCell !== last) return;
        this.forgetLastCell();
        this.retire(instance);
      }, policy.windowMs);
    } catch { this.forgetLastCell(); return false; }
    if (this.lastCell !== last) last.cancel();
    resident.lease.update({ needed: false, distance: this.distance(this.assembly.cell(instance)) });
    return this.lastCell === last;
  }
  private distance(cell: GridCell, p = this.worldFeet()): number { return Math.hypot(Math.max(0, Math.abs(p.x - cell.origin.x) - CHUNK_HALF), Math.max(0, Math.abs(p.z - cell.origin.z) - CHUNK_HALF)); }
  /** Only the active/reserved world and one bounded departed world can remain.
   * A different actual entry retires the departure before any new allocation. */
  private retireInactiveRegions(destination?: string): boolean {
    const last = this.lastCell;
    if (last !== null && (diagnosticNow() >= last.until || !this.retainedFits(last.instance)
      || this.active !== null || destination !== undefined && destination !== last.instance)) this.forgetLastCell();
    let released = true;
    for (const [instance, resident] of this.residents) {
      const needed = instance === this.active || instance === destination || this.requests.has(instance) || resident.reservations > 0;
      resident.lease.update({ distance: this.distance(this.assembly.cell(instance)), needed: needed || resident.disposalFailed === true });
      if (needed || this.lastCell?.instance === instance) continue;
      if (resident.disposalFailed === true || resident.evicting || this.coldUnloadRefused.has(instance)) { released = false; continue; }
      if (!this.retire(instance)) { this.coldUnloadRefused.add(instance); released = false; }
    }
    return released;
  }
  /** Retry after a durability/budget change, instead of fetching the same failed request every tick. */
  retry(instance: string): void {
    if (this.requests.has(instance) || this.productRequests.has(instance)) throw new Error('Live admission is still pending');
    this.coldUnloadRefused.delete(instance); this.deferredProducts.delete(instance);
    // A quota-refused unload kept a complete native region: retry must not invalidate its valid readiness ticket.
    if (this.residents.has(instance)) return;
    this.issues.delete(instance); this.refusals.delete(instance); this.readiness.invalidate(instance);
  }
  /** Preserve the original error identity for classified UI, instead of inferring failure type from a message. */
  refusal(instance: string): unknown { return this.refusals.get(instance); }
  /** Before the existing page physics/player step: radial requests are U-turn safe, and current-world walls synchronize first. */
  beforeFixed(): void {
    if (this.disposed) return;
    const work=this.approachWork.pop()??{candidates:[],boulevard:[]};
    try{this.beforeFixedWithWork(work);}
    finally{work.candidates.length=0;work.boulevard.length=0;if(!this.disposed)this.approachWork.push(work);}
  }
  private beforeFixedWithWork(work:{candidates:GridCell[];boulevard:GridCell[]}):void{
    if (this.tileApproach?.instance === this.active && this.ports.gameplayReady(this.tileApproach.instance)) {
      this.tileApproach.controller.abort(); this.tileApproach = null;
    }
    const feet = this.worldFeet(), previous = this.previousFeet;
    const travelledDistance = previous === undefined ? 0 : Math.hypot(feet.x - previous.x, feet.z - previous.z);
    // More than a second of modeled travel between fixed samples is a pose/portal jump.
    // Establish a new origin instead of spending a constructor on its accidental direction.
    const travelled = previous !== undefined && travelledDistance >= APPROACH_TRAVEL_METRES && travelledDistance <= this.ports.readiness.link.speed;
    if (previous === undefined || travelledDistance >= APPROACH_TRAVEL_METRES) this.previousFeet = feet;
    // Prefetch the closest cells' products (never their worlds: G663). Unsupported far proxies do not consume the count
    // before enterable cells inside the cold readiness bound.
    const candidates=work.candidates,cells=this.assembly.cells;
    for(let i=0,length=cells.length;i<length;i++){
      const cell=cells[i];if(cell!==undefined&&cell.instance!==this.active&&(this.ports.prefetchable?.(cell)??true))candidates.push(cell);
    }
    // Fixed cell poses and this tick's captured feet: avoid repeating hypot inside every sort comparison.
    for (const cell of candidates) this.candidateDistances.set(cell,this.distance(cell,feet));
    candidates.sort((a,b) => (this.candidateDistances.get(a) ?? Infinity) - (this.candidateDistances.get(b) ?? Infinity) || a.instance.localeCompare(b.instance));
    // Immutable products are selected by distance, without a whole-world count cap.
    const nearby = candidates;
    // The frame-transfer reservation protects an actual entry; inactive whole worlds retire in steps.
    this.retireInactiveRegions();
    for (const cell of nearby) {
      const estimate = readinessModel(this.ports.readiness.bundle(cell), this.ports.readiness.link), distance = this.distance(cell, feet);
      if (this.assembly.approaching(distance, estimate.distance) && !this.issues.has(cell.instance) && this.ports.backgroundReady?.() !== false) void background(cell.instance, this.prefetch([cell.instance]), () => !this.disposed);
    }
    // Approach preparation owns render tiles only, never a regional world or gameplay hooks.
    const moving = !travelled ? undefined : candidates.find(cell => headsToEntry(cell, feet, previous)
      && this.distance(cell, feet) < this.distance(cell, previous) - 0.000001);
    const source = this.active === null ? undefined : this.assembly.cell(this.active);
    const sourceDistance = source === undefined ? Infinity : Math.max(Math.abs(feet.x - source.origin.x), Math.abs(feet.z - source.origin.z));
    const transportApproach = this.transportApproach;
    if (transportApproach !== null) {
      const cell = this.assembly.cell(transportApproach.instance);
      if (moving !== undefined && moving.instance !== cell.instance
        || this.distance(cell, feet) >= this.assembly.pitch
        || source !== undefined && source.instance !== cell.instance && sourceDistance < CHUNK_HALF - 1) this.stopApproachTransport();
    }
    const tileApproach = this.tileApproach;
    if (tileApproach !== null) {
      const cell = this.assembly.cell(tileApproach.instance);
      if (moving !== undefined && moving.instance !== cell.instance
        || this.distance(cell, feet) > readinessModel(this.ports.readiness.bundle(cell), this.ports.readiness.link).distance) {
        tileApproach.controller.abort(); this.tileApproach = null;
      }
    }
    if (this.requests.size === 0) {
      const wallReach = 6 + this.ports.player.motor.opts.radius + 0.5 + this.ports.readiness.link.speed / 60;
      const departed = this.transitions.at(-1)?.from;
      const boulevard=work.boulevard;
      if(travelled&&moving===undefined)for(let i=0,length=candidates.length;i<length;i++){
        const cell=candidates[i];if(cell!==undefined&&cell.instance!==departed
          &&(boulevardApproachDistance(cell,feet,previous,this.assembly.pitch)??Infinity)
            <=readinessModel(this.ports.readiness.bundle(cell),this.ports.readiness.link).distance)boulevard.push(cell);
      }
      // Product metadata identifies bounded native alternatives even when the nearer opaque product filled
      // the radial prefetch count. This admits immutable products/modules, never their foundations.
      for (const cell of boulevard) if (!this.issues.has(cell.instance)) void background(cell.instance, this.prefetch([cell.instance]), () => !this.disposed);
      // A unique next junction can prepare tiles. Equidistant sides wait for a turn.
      let predicted: GridCell | undefined, nextDistance = Infinity;
      for (const cell of boulevard) {
        const distance = boulevardApproachDistance(cell, feet, previous ?? feet, this.assembly.pitch);
        if (distance === undefined) continue;
        if (distance < nextDistance - 0.000001) { predicted = cell; nextDistance = distance; }
        else if (Math.abs(distance - nextDistance) <= 0.000001) predicted = undefined;
      }
      // A stationary sample is not a redirect. Keep the verified render owner
      // until a named heading or the distance fence replaces it; the cell just
      // left must not steal that pin merely because its wall is still nearest.
      const heldApproach = this.tileApproach === null ? undefined : this.assembly.cell(this.tileApproach.instance);
      const approach = moving ?? predicted ?? heldApproach
        ?? nearby.find(cell => cell.instance !== departed && this.distance(cell, feet) <= wallReach);
      const named = moving ?? predicted, outsideSource = sourceDistance >= CHUNK_HALF;
      if (named !== undefined && outsideSource && !this.residents.has(named.instance) && !this.issues.has(named.instance)
        && this.distance(named, feet) < this.assembly.pitch) this.prepareApproachTransport(named);
      if (approach !== undefined && this.ports.prepareNeighbour !== undefined && this.tileMetadata.has(approach.instance)
        && !this.residents.has(approach.instance) && !this.issues.has(approach.instance)
        && (this.active === null || moving === approach)
        // A held owner survives a stationary/teleported sample without moving
        // its entry tile. Only a real named approach may retarget that pin.
        && (heldApproach === undefined || moving === approach || predicted === approach)
        && this.assembly.approaching(this.distance(approach, feet), readinessModel(this.ports.readiness.bundle(approach), this.ports.readiness.link).distance)) {
        this.prepareNeighbour(approach, feet);
      }
    }
    const walls = this.active === null ? this.highway.walls : this.region(this.active)?.walls;
    walls?.sync(this.readiness);
  }
  /** Once after the existing player move; paused hook installation does not advance the region's simulation. */
  afterPlayerStep(): void {
    if (this.disposed || (this.active !== null && !this.ports.gameplayReady(this.active))) return;
    if (this.active === null) this.highway.afterPlayerStep?.();
    else this.region(this.active)?.host.stepExternal();
  }
  /** Owned regions capture the current traveller without acquiring its motor. */
  checkpoint(instance: string): boolean { return finishSimSteps(this.checkpointSteps(instance)); }
  /** The same checkpoint in stages, for a periodic autosave spread over frames (rt3-freeze): the first `next()` captures
   *  at the caller's fixed-step boundary; later stages encode and write. A later checkpoint, a crossing or an unload
   *  supersedes it: it then returns false without writing, so an older capture never replaces a newer save. */
  *checkpointSteps(instance: string): Generator<undefined, boolean> {
    if (this.disposed) return false;
    const generation = (this.checkpointGenerations.get(instance) ?? 0) + 1; this.checkpointGenerations.set(instance, generation);
    const resident = this.residents.get(instance); if (resident === undefined) return false;
    if (resident.region.checkpoint !== undefined) return resident.region.checkpoint();
    let snapshot = this.saved.read(instance);
    const active = instance === this.active;
    const stale = (): boolean => this.disposed || generation !== this.checkpointGenerations.get(instance) || this.residents.get(instance) !== resident || (instance === this.active) !== active;
    let nativeSteps: Generator<undefined, boolean> | undefined;
    if (active) {
      const host = resident.region.host; host.player.position.copy(this.ports.player.position); host.player.yaw = this.ports.player.yaw;
      host.attachPlayerMotor(this.ports.player.motor);
      try {
        if (this.ports.continuations === 'durable' && this.ports.saveBytesSteps !== undefined) nativeSteps = this.ports.saveBytesSteps(instance, snapshotSimHostBytes(host));
        else snapshot = snapshotSimHost(host);
      } finally { host.releasePlayerMotor(); }
    }
    if (nativeSteps !== undefined) return yield* this.writeCheckpointSteps(nativeSteps, stale);
    if (snapshot === undefined) return true; // Never-entered bodyless content is reconstructed from immutable admission.
    const packed = this.ports.continuations === 'durable' ? undefined : this.saved.pack(instance, snapshot); if (packed === null) return false;
    const steps = this.ports.saveSteps?.(instance, snapshot);
    const saved = steps === undefined ? this.ports.save(instance, snapshot) : yield* this.writeCheckpointSteps(steps, stale);
    if (!saved) return false;
    if (packed !== undefined) this.saved.store(instance, packed); return true;
  }
  private *writeCheckpointSteps(steps: Generator<undefined, boolean>, stale: () => boolean): Generator<undefined, boolean> {
    for (;;) {
      yield;
      if (stale()) { steps.return(false); return false; }
      const step = steps.next(); if (step.done === true) return step.value;
    }
  }
  /** Prepare durability before allocator eviction; commit only disposes an already-frozen world. */
  prepareUnload(instance: string): ResidencyEviction | null {
    const resident = this.residents.get(instance);
    if (resident === undefined || this.disposed || instance === this.active || resident.reservations > 0 || resident.evicting) return null;
    const checkpointStart = diagnosticNow();
    try { if (!resident.disposalFailed && !this.checkpoint(instance)) return null; } catch { return null; }
    const checkpointMs = diagnosticNow() - checkpointStart;
    resident.evicting = true; let closed = false;
    const retire = resident.region.retire;
    return { abort: () => { if (closed) return; closed = true; resident.evicting = false; },
      ...(retire === undefined || resident.disposalFailed === true ? {} : { steps: (): Generator<void, void> => {
        if (closed) throw new Error('Residency eviction already settled');
        closed = true; return this.evictionSteps(instance, resident, retire, checkpointMs);
      } }),
      commit: () => {
      if (closed) return; closed = true;
      this.ports.keepPrograms?.(instance);
      const disposeStart = diagnosticNow();
      try { resident.region.dispose(); this.noteRetirement({ instance, checkpointMs, disposeMs: diagnosticNow() - disposeStart }); this.ghosts.retired(instance, resident.region.ghostRoots ?? [resident.region]); }
      catch (error) {
        resident.evicting = false; resident.disposalFailed = true; resident.lease.update({ needed: true });
        this.readiness.invalidate(instance); this.issues.set(`cleanup:${instance}`, error instanceof Error ? error.message : String(error)); return;
      }
      this.residents.delete(instance); this.readiness.invalidate(instance);
      this.forgetLastCell(instance);
      if (resident.reloadsCheckpoint) this.saved.drop(instance);
      resident.lease.release();
    } };
  }
  /** Leave active/home/highway worlds intact; unload only a durably checkpointed frozen region. */
  /**
   * O20: retire a frozen region after its crossing without a long frame: checkpoint it now, take it out of the residents
   * (its readiness closes), then run its disposal in steps under the loading slice budget. Its claim stays held until the
   * last step, and every later admission waits for it (`sequence`), so its memory is released before anything replaces
   * it. A region with no stepped disposal, or one that cannot retire now, takes `unload`.
   */
  retire(instance: string): boolean {
    const resident = this.residents.get(instance), retire = resident?.region.retire;
    if (resident === undefined || retire === undefined || this.disposed || instance === this.active || resident.reservations > 0
      || resident.evicting || resident.disposalFailed === true) return this.unload(instance);
    const checkpointStart = diagnosticNow();
    try { if (!this.checkpoint(instance)) return false; } catch { return false; }
    const checkpointMs = diagnosticNow() - checkpointStart;
    resident.evicting = true;
    const record = this.startRetirement(instance, resident, retire, checkpointMs);
    this.sequence = this.settle(Promise.all([this.sequence, this.drainRetirement(record)]).then(() => undefined));
    return true;
  }
  /** a frozen, checkpointed world leaves the residents (its readiness closes) and starts its stepped disposal; its claim
   *  stays held until `finishRetirement` */
  private startRetirement(instance: string, resident: Resident, retire: () => Generator<DisposeStep, void>, checkpointMs: number): RetiringRegion {
    this.ports.keepPrograms?.(instance);
    this.forgetLastCell(instance);
    this.residents.delete(instance); this.readiness.invalidate(instance);
    this.ghosts.retired(instance, resident.region.ghostRoots ?? [resident.region]);
    let settle = (): void => undefined;
    const finished = new Promise<void>(resolve => { settle = resolve; });
    const record: RetiringRegion = { instance, resident, steps: retire(), checkpointMs, start: diagnosticNow(), count: 0, workMs: 0, slowestMs: 0, slowest: '', done: false, finished, settle };
    this.retiring.set(instance, record);
    return record;
  }
  /** one disposal step of a retiring world; true once its last step ran */
  private advance(record: RetiringRegion): boolean {
    const at = diagnosticNow(), step = record.steps.next(), ms = diagnosticNow() - at;
    record.count++; record.workMs += ms;
    if (ms > record.slowestMs) { record.slowestMs = ms; record.slowest = step.done === true ? 'final' : `${step.value.scope}:${step.value.kind}`; }
    return step.done === true;
  }
  private async drainRetirement(record: RetiringRegion): Promise<void> {
    // Its own stretch per frame, not the builds' shared one: starved by tile and prefetch work it took 31-35 s on the
    // Simulator, holding the left region's memory and the next admission (which waits on `sequence`) that long
    const slice = workSlice();
    let stretch = diagnosticNow();
    try {
      for (;;) {
        if (record.done) return;
        if (this.advance(record)) break;
        if (diagnosticNow() - stretch >= WORK_SLICE_MS) { await slice.yield(); stretch = diagnosticNow(); }
      }
      this.finishRetirement(record, undefined);
    } catch (error) { this.finishRetirement(record, { error }); }
  }
  /** a stepped eviction, then the same check as its one-shot commit: a failed disposer keeps its full claim */
  private *checkedEviction(steps: Generator<void, void>, instance: string, resident: Resident): Generator<void, void> {
    yield* steps;
    if (this.residents.get(instance) === resident) throw new Error('Retained world disposal failed');
  }
  /**
   * T10: an allocator eviction of a world with stepped disposal, driven by the evicting caller one disposal step per yield
   * (a road's render admission in a drive disposed a whole retained world in one 118 ms frame). The same order as `retire`:
   * out of the residents first, its claim held until the last step, every later admission waiting on `sequence`. Left
   * unfinished (the caller stopped), the rest drains on its own; a failure keeps the full claim, as `retire`'s does.
   */
  private *evictionSteps(instance: string, resident: Resident, retire: () => Generator<DisposeStep, void>, checkpointMs: number): Generator<void, void> {
    const record = this.startRetirement(instance, resident, retire, checkpointMs);
    let settle = (): void => undefined;
    const finished = new Promise<void>(resolve => { settle = resolve; });
    this.sequence = this.settle(Promise.all([this.sequence, finished]).then(() => undefined));
    let ended = false;
    try {
      for (;;) {
        if (record.done) { ended = true; return; }
        let last: boolean;
        try { last = this.advance(record); }
        catch (error) { ended = true; this.finishRetirement(record, { error }); return; }
        if (last) { ended = true; this.finishRetirement(record, undefined); return; }
        yield;
      }
    } finally {
      if (ended) settle();
      else void this.drainRetirement(record).finally(settle);
    }
  }
  private finishRetirement(record: RetiringRegion, failure: { readonly error: unknown } | undefined): void {
    if (record.done) return;
    record.done = true; this.retiring.delete(record.instance); record.settle();
    const { instance, resident } = record, row = { instance, checkpointMs: record.checkpointMs, disposeMs: diagnosticNow() - record.start,
      steps: record.count, workMs: Math.round(record.workMs), slowestStepMs: Math.round(record.slowestMs), slowestStep: record.slowest };
    if (failure !== undefined) {
      const { error } = failure;
      // A partly freed world keeps its full claim and blocks exclusive admissions, as a failed `unload` does.
      resident.evicting = false; resident.disposalFailed = true; resident.lease.update({ needed: true }); this.residents.set(instance, resident);
      this.issues.set(`cleanup:${instance}`, error instanceof Error ? error.message : String(error)); this.noteRetirement({ ...row, failed: true }); return;
    }
    if (resident.reloadsCheckpoint) this.saved.drop(instance);
    resident.lease.release(); this.noteRetirement(row);
  }
  private noteRetirement(row: Retirement): void { this.retirements.push(row); if (this.retirements.length > 16) this.retirements.shift(); }
  unload(instance: string): boolean { if (!this.residents.has(instance)) return true; const prepared = this.prepareUnload(instance); if (prepared === null) return false; prepared.commit(); return !this.residents.has(instance); }
  /** Prepare disabled replacement controllers while the existing page stays authoritative; no entered runtime hooks run here. */
  async prepare(from: string | null, to: string | null): Promise<PreparedGridCrossing> {
    if (this.disposed || this.active !== from || from === to) throw new Error('Stale live frame preparation');
    if (from !== null && to !== null) throw new Error('Owned runtime crossing must commit onto the neutral road first');
    // Protect a ready return before yielding: expiry/pressure cannot free it
    // between its selection and the final prepared-frame reservation.
    const returning = to === null ? undefined : this.residents.get(to), releaseReturn = returning?.lease.hold();
    if (returning !== undefined) returning.reservations++;
    try {
    const generation = ++this.frameGeneration;
    for (const cancelPrevious of this.frames) cancelPrevious();
    const current = (): void => {
      this.assertAlive();
      if (generation !== this.frameGeneration || this.active !== from) throw new Error('Stale live frame preparation');
    };
    if (from === null && to !== null) {
      // Drain any superseded requested entry, then release every unentered world
      // before the requested destination allocates. Refused disposal stays charged.
      await this.sequence;
      current();
      if (!this.retireInactiveRegions(to)) throw new Error('Exclusive runtime awaits successful disposal');
      await this.sequence;
      current();
      if (this.current() !== from) throw new Error('Stale live frame preparation');
    }
    if (to !== null) await this.ensure(to);
    current();
    if (this.active !== from || !this.ready(to)) throw new Error('Unready live frame preparation');
    const destination = this.region(to)?.host;
    if (destination !== undefined && (destination.hasPlayerMotor || destination.player.id !== this.ports.player.health.id)) throw new Error('Invalid destination traveller');
    const resident = to === null ? undefined : this.residents.get(to), releaseHold = resident?.lease.hold();
    if (resident !== undefined) resident.reservations++;
    const source = this.origin(from), origin = this.origin(to), rider = { position: this.ports.player.position, motor: this.ports.player.motor }, mount = this.ports.mount?.();
    let motors: ReturnType<typeof prepareFrameMotors>;
    try { motors = prepareFrameMotors(mount === undefined ? [rider] : [rider, mount], this.physics(to), { x: source.x - origin.x, z: source.z - origin.z }); }
    catch (error) { if (resident !== undefined) resident.reservations--; releaseHold?.(); throw error; }
    let closed = false;
    const frames = this.frames;
    let cancel: () => void = () => undefined;
    const finish = (): void => { closed = true; frames.delete(cancel); if (resident !== undefined) resident.reservations--; releaseHold?.(); };
    cancel = (): void => { if (closed) return; motors.cancel(); finish(); };
    this.frames.add(cancel);
    return { cancel, commit: () => {
      if (closed || this.disposed || this.active !== from || !this.ready(to)) throw new Error('Stale live frame commit');
      motors.commit(); this.unbind?.(); this.unbind = undefined;
      this.ports.player.motor = rider.motor; this.active = to;
      if (to !== null) this.forgetLastCell();
      this.previousFeet = this.worldFeet(); // A committed spawn/frame placement is not the traveller's heading.
      const host = this.region(to)?.host; if (host !== undefined) this.unbind = host.bindExternalPlayer(this.ports.player);
      this.ports.bindFrame({ instance: to, physics: this.physics(to), motor: rider.motor, origin, ...(host === undefined ? {} : { host }) });
      this.residents.get(to ?? '')?.lease.update({ needed: true }); this.residents.get(from ?? '')?.lease.update({ needed: to === null });
      this.crossings++; this.transitions.push({ from, to }); if (this.transitions.length > 256) this.transitions.shift(); finish();
    } };
    } finally { if (returning !== undefined) returning.reservations--; releaseReturn?.(); }
  }
  private retainedState(): Exclude<LiveGridState['retainedCell'], undefined> {
    const last = this.lastCell, policy = this.ports.lastCell;
    return last === null || policy === undefined ? null : { instance: last.instance, remainingMs: Math.max(0, last.until - diagnosticNow()),
      playingBytes: this.ports.allocator.ownerCost(last.instance).playing, capBytes: Math.min(CONTENT_CAPS.playing, policy.playingBytes) };
  }
  /** Read-only crossing evidence and failures for the real grid physics harness. */
  state(): LiveGridState { return { current: this.active, worldFeet: this.worldFeet(), crossings: this.crossings, transitions: this.transitions.map((row) => ({ ...row })), residents: [...this.residents.keys()].sort(), pending: [...new Set([...this.requests.keys(), ...this.productRequests.keys()])].sort(), issues: Object.fromEntries(this.issues), gameplayReady: this.active === null || this.ports.gameplayReady(this.active), ...(this.ports.lastCell === undefined ? {} : { retainedCell: this.retainedState() }), retirements: this.retirements.map(row => ({ ...row })), retiring: [...this.retiring.keys()], ghosts: { count: this.ghosts.count(), regions: this.ghosts.regions() }, continuations: this.ports.continuations === 'durable' ? { entries: 0, storedChars: 0, capacityChars: 0, claimedBytes: 0 } : { ...this.saved.state(), claimedBytes: this.disposed ? 0 : GRID_CONTINUATION_CACHE_BYTES } }; }
  /** Return the traveller to its page world before retiring regions. Failed disposals keep their full claims
   * and can be retried; the neutral highway disposer never owns the page physics or latest traveller motor. */
  dispose(): void {
    this.disposed = true;
    this.forgetLastCell();
    this.stopApproachTransport();
    this.tileApproach?.controller.abort(); this.tileApproach = null;
    this.tileMetadata.clear();
    for (const cancel of this.frames) cancel(); this.unbind?.(); this.unbind = undefined;
    // Return the still-live page traveller before freeing a world that contains its current controller.
    const page = null;
    if (this.active !== page) {
      const source = this.origin(this.active), origin = this.origin(page), physics = this.physics(page);
      const rider = { position: this.ports.player.position, motor: this.ports.player.motor }, mount = this.ports.mount?.();
      prepareFrameMotors(mount === undefined ? [rider] : [rider, mount], physics, { x: source.x - origin.x, z: source.z - origin.z }).commit();
      this.ports.player.motor = rider.motor; this.active = page;
      this.ports.bindFrame({ instance: page, physics, motor: rider.motor, origin });
    }
    const failures: unknown[] = [];
    // O20: a stepped retirement still running finishes now, before the residents' own disposal
    for (const record of this.retiring.values()) {
      try { for (let step = record.steps.next(); step.done !== true; step = record.steps.next()) { /* drained */ } this.finishRetirement(record, undefined); }
      catch (error) { this.finishRetirement(record, { error }); failures.push(error); }
    }
    for (const [instance, resident] of this.residents) {
      try { resident.region.dispose(); }
      catch (error) { resident.disposalFailed = true; resident.lease.update({ needed: true }); failures.push(error); continue; }
      this.residents.delete(instance); resident.lease.release();
    }
    for (const [instance, product] of this.products) {
      try { product.cancel?.(); this.products.delete(instance); } catch (error) { failures.push(error); }
    }
    if (!this.highwayDisposed) {
      try { this.highway.dispose(); this.highwayDisposed = true; this.highwayLease.release(); }
      catch (error) { failures.push(error); }
    }
    this.deferredProducts.clear(); this.saved.clear(); this.cacheLease?.release();
    if (failures.length > 0) throw new AggregateError(failures, 'Live grid disposal failed');
  }
}
