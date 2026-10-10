import type { SimExternalPlayer, SimHost } from '@wildshard/engine/sim';
import { snapshotSimHost, snapshotSimHostBytes, finishSimSteps, type SimSnapshot, type SimSnapshotBytes } from '@wildshard/engine/sim/snapshot';
import { prepareFrameMotors, type FrameMember } from '@wildshard/engine/physics/frame';
import type { Physics } from '@wildshard/engine/physics/Physics';
import { TraversalReadiness, readinessModel, type ReadinessBundle, type ReadinessLink, type ReadinessTicket } from '@wildshard/engine/sim/readiness';
import type { ReadinessWalls } from '@wildshard/engine/physics/readinessWalls';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import type { GridAssembly, GridCell, GridPoint } from './assembly';
import type { ResidencyAllocator, ResidencyLease, ResidencyEviction } from './allocator';
import type { PreparedGridCrossing } from './crossing';
import { GridContinuationCache, GRID_CONTINUATION_CACHE_BYTES } from './continuations';
import type { HomeResidencyClaim } from './pageResidency';

/** An owned region has authored colliders and logical player state, but no second traveller capsule. */
export interface LiveGridRegion { host: SimHost; dispose: () => void;
  /** Opaque runtimes own logical checkpoints; native shardfile hosts use the exact codec below. */
  checkpoint?: () => boolean; walls?: ReadinessWalls }
/** Immutable content is admitted before its sim claim and world allocation; trusted runtime preparation imports only. */
export interface LiveGridAdmission {
  bytes: number; create: (saved: SimSnapshot | undefined, claim: ResidencyLease) => Promise<LiveGridRegion>;
  /** Release an unpublished product lease on refusal/cancellation. Idempotent after failed create or region disposal;
   *  successful publication transfers release to the returned region's dispose. */
  cancel?: () => void;
  prepareRuntime?: () => Promise<void>;
  /** Trusted factory reads its durable exact/logical continuation after preparing the immutable physics basis. */
  reloadsCheckpoint?: boolean;
  /** Opaque world foundations are mutually exclusive; prefetch admits only their product/module until the road departure. */
  exclusiveRuntime?: boolean;
}
/** The page owns its initial world and continuation. The registry never replaces or disposes that borrowed world. */
export interface LiveGridHome {
  mode?: 'borrowed';
  instance: string; physics: Physics; bytes: number; checkpoint: () => boolean;
  /** The page's pre-allocation claim. The registry acquires its own reference on the same owner and exact cost. */
  residency?: HomeResidencyClaim;
  afterPlayerStep?: () => void; walls?: ReadinessWalls;
}
/** G226: the initial home is an ordinary owned region; the neutral page constructs none of its opaque content. */
export interface LiveGridOwnedHome { mode: 'owned'; instance: string; bytes: number; residency: HomeResidencyClaim }
/** Neutral shell physics and its one traveller remain page-owned; disposal removes only platform installations. */
export interface LiveGridHighway { physics: Physics; dispose: () => void; walls?: ReadinessWalls; afterPlayerStep?: () => void }
/** An infallible prepared assignment rebinds the existing page world/player and the renderer's local origin. */
export interface LiveGridFrame { instance: string | null; physics: Physics; motor: FrameMember['motor']; origin: Readonly<{ x: number; z: number }>; host?: SimHost }
/** One live fixed-step owner supplies movement; region clocks/systems run only after that move. */
export interface LiveGridPorts {
  home: LiveGridHome | LiveGridOwnedHome; player: SimExternalPlayer & FrameMember; allocator: ResidencyAllocator;
  highway: { bytes: number; create: () => LiveGridRegion | LiveGridHighway };
  admit: (cell: GridCell) => Promise<LiveGridAdmission>;
  /** Browser presentation boundary between admission batches; absent leaves the standalone Node scheduler unchanged. */
  pause?: () => Promise<void>;
  /** Metadata-only prefetch eligibility. Unsupported far proxies do not consume cold request slots; explicit transfers
   *  still run normal admission and readiness. Absent: every cell is a candidate, as in standalone Node drivers. */
  prefetchable?: (cell: GridCell) => boolean;
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
  maxResidents?: number;
  /** Durable-only factories retain no packed snapshots; admission refuses a factory without a durable read capability. */
  continuations?: 'memory' | 'durable';
}
/** Crossing telemetry is a production port: the harness verifies real fixed-boundary commits, never a page/debug probe. */
export interface LiveGridState {
  current: string | null; worldFeet: GridPoint; crossings: number;
  transitions: readonly { from: string | null; to: string | null }[];
  residents: readonly string[]; pending: readonly string[]; issues: Readonly<Record<string, string>>;
  gameplayReady: boolean;
  continuations: { entries: number; storedChars: number; capacityChars: number; claimedBytes: number };
}
interface Resident { region: LiveGridRegion; lease: ResidencyLease; reloadsCheckpoint: boolean; exclusiveRuntime: boolean; reservations: number; evicting: boolean; disposalFailed?: boolean; outsideSince?: number }

// The motor's 6/10 m frame bands are independent. Residency waits five continuous fixed-step seconds outside
// a further five seconds of travel distance, so a boulevard U-turn never churns a world at its request threshold.
const COLD_DWELL_TICKS = 5 * 60;
// Contact corrections at a closed readiness wall are not a U-turn. Accumulate real horizontal travel
// before selecting another approach, so sub-centimetre capsule recoil cannot evict the world just prepared.
const APPROACH_TRAVEL_METRES = 0.1;

/** One page traveller with frozen owned regions. Borrowed homes keep the existing standalone composition;
 * owned homes begin on neutral page physics and transfer the sole preallocation claim to their first runtime. */
export class LiveGridHost {
  readonly readiness = new TraversalReadiness();
  private readonly residents = new Map<string, Resident>();
  private readonly saved = new GridContinuationCache();
  private readonly cacheLease: ResidencyLease | undefined;
  private readonly requests = new Map<string, Promise<void>>();
  private readonly products = new Map<string, LiveGridAdmission>();
  private readonly productRequests = new Map<string, Promise<LiveGridAdmission>>();
  private readonly issues = new Map<string, string>();
  private readonly refusals = new Map<string, unknown>();
  /** One failed cold unload per excursion; quota failures retain their full claim until retry or re-approach. */
  private readonly coldUnloadRefused = new Set<string>();
  private readonly frames = new Set<() => void>();
  private readonly transitions: { from: string | null; to: string | null }[] = [];
  private crossings = 0;
  private fixedTick = 0;
  private previousFeet: GridPoint | undefined;
  /** A refused speculative retirement remains charged until an explicit durability retry. */
  private readonly roadRetirementRefused = new Set<string>();
  private readonly homeLease: ResidencyLease | undefined;
  private initialHomePending: boolean;
  private readonly highwayLease: ResidencyLease;
  private readonly highway: LiveGridRegion | LiveGridHighway;
  private readonly limit: number;
  private sequence: Promise<void> = Promise.resolve();
  private active: string | null;
  private unbind: (() => void) | undefined;
  private disposed = false;
  /** Each checkpoint of an instance takes a generation; a staged one still waiting is superseded by any later one. */
  private readonly checkpointGenerations = new Map<string, number>();
  private highwayDisposed = false;
  readonly assembly: GridAssembly;
  private readonly ports: LiveGridPorts;

  constructor(assembly: GridAssembly, ports: LiveGridPorts) {
    this.assembly = assembly; this.ports = ports;
    const home = assembly.cell(ports.home.instance), homeEstimate = readinessModel(ports.readiness.bundle(home), ports.readiness.link);
    this.active = ports.home.mode === 'owned' ? null : ports.home.instance; this.limit = ports.maxResidents ?? 4;
    this.initialHomePending = ports.home.mode === 'owned';
    if (!Number.isInteger(this.limit) || this.limit < 1 || this.limit > 8) throw new RangeError('Invalid live grid resident limit');
    if (ports.continuations !== 'durable') {
      const cacheId = `sim-continuations:live:${ports.home.instance}`;
      if (ports.allocator.has(cacheId)) throw new Error('Live continuation cache already has an owner');
      const cacheLease = ports.allocator.reserve({ id: cacheId, category: 'sim', owner: ports.home.instance, bytes: GRID_CONTINUATION_CACHE_BYTES, distance: 0, needed: true });
      if (cacheLease === null) throw new Error('Live continuation cache admission deferred by the shared budget');
      this.cacheLease = cacheLease;
    }
    try {
      if (ports.home.mode === 'owned') {
        this.validateHomeClaim(ports.home.residency);
      } else this.homeLease = this.retainHome();
      try {
        this.highwayLease = this.claim('platform.highway', ports.highway.bytes, true);
        try { this.highway = ports.highway.create(); try {
          if (ports.home.mode === 'owned') {
            if ('host' in this.highway) throw new Error('Owned home requires neutral page highway physics');
            if (this.highway.physics.world.getCollider(ports.player.motor.collider.handle) !== ports.player.motor.collider) throw new Error('Neutral highway must contain the existing page traveller');
          } else {
            if (!('host' in this.highway)) throw new Error('Borrowed home requires its owned highway host');
            this.checkRegion(this.highway);
          }
        } catch (error) { this.highway.dispose(); throw error; } }
        catch (error) { this.highwayLease.release(); throw error; }
      } catch (error) { this.homeLease?.release(); throw error; }
    } catch (error) { this.cacheLease?.release(); throw error; }
    if (ports.home.mode !== 'owned') {
      const ticket = this.readiness.request(ports.home.instance, 0, homeEstimate, false);
      if (ticket !== null) for (const part of ['colliders', 'sim', 'runtime'] as const) this.readiness.complete(ticket, part);
    }
  }
  private validateHomeClaim(claim: HomeResidencyClaim): void {
    const home = this.ports.home;
    if (claim.instance !== home.instance || claim.bytes !== home.bytes || claim.allocator !== this.ports.allocator) throw new Error('Live home residency differs from its admitted page claim');
  }
  private retainHome(): ResidencyLease {
    const home = this.ports.home, claim = home.residency;
    if (claim === undefined) return this.claim(home.instance, home.bytes, true);
    this.validateHomeClaim(claim);
    return claim.retain();
  }
  private claim(instance: string, bytes: number, needed: boolean): ResidencyLease {
    const lease = this.ports.allocator.reserve({ id: `sim:${instance}`, category: 'sim', owner: instance, bytes, distance: 0, needed,
      ...(this.ports.home.mode === 'owned' || this.borrowedHome(instance) || instance === 'platform.highway' ? {} : { prepareEvict: () => this.prepareUnload(instance) }) });
    if (lease === null) throw new Error('Live sim admission deferred by the shared budget');
    return lease;
  }
  private checkRegion(region: LiveGridRegion): void {
    if (region.host.embedded || region.host.hasPlayerMotor) throw new Error('Live regional host must be owned and bodyless');
  }
  /** Null identifies the permanent highway/strip world; home is the already-running page world. */
  current(): string | null { return this.active; }
  private borrowedHome(instance: string | null): boolean { return this.ports.home.mode !== 'owned' && instance === this.ports.home.instance; }
  private origin(instance: string | null): { x: number; z: number } { return instance === null ? { x: 0, z: 0 } : this.assembly.cell(instance).origin; }
  private region(instance: string | null): LiveGridRegion | undefined { return instance === null ? 'host' in this.highway ? this.highway : undefined : this.residents.get(instance)?.region; }
  private physics(instance: string | null): Physics {
    if (instance === null) return 'host' in this.highway ? this.highway.host.physics : this.highway.physics;
    if (this.ports.home.mode !== 'owned' && instance === this.ports.home.instance) return this.ports.home.physics;
    const region = this.region(instance); if (region === undefined) throw new Error('Live grid region is not admitted'); return region.host.physics;
  }
  /** Render/global coordinates are derived, never written into an authored regional host. */
  worldFeet(): GridPoint { const p = this.ports.player.position, origin = this.origin(this.active); return { x: p.x + origin.x, y: p.y, z: p.z + origin.z }; }
  /** Pure 6 m enter / 10 m leave selection; calling it does not change the live page frame. */
  target(feet: Readonly<GridPoint>): string | null {
    if (![feet.x, feet.y, feet.z].every(Number.isFinite)) throw new RangeError('Invalid live grid feet');
    const distance = (cell: GridCell): number => Math.max(Math.abs(feet.x - cell.origin.x), Math.abs(feet.z - cell.origin.z)) - CHUNK_HALF;
    if (this.active !== null && distance(this.assembly.cell(this.active)) <= 10) return this.active;
    return [...this.assembly.cells].sort((a, b) => a.instance.localeCompare(b.instance)).find((cell) => distance(cell) <= 6)?.instance ?? null;
  }
  /** Admission includes colliders, initialized sim and parsed runtime module; entered hooks are a separate gameplay fence. */
  ready(instance: string | null): boolean {
    return !this.disposed && (instance === null || this.borrowedHome(instance) || (this.residents.has(instance) && !this.residents.get(instance)?.evicting && !this.residents.get(instance)?.disposalFailed && this.readiness.status(instance).ready));
  }
  /** Submit whole-shard requests in stable order. Failed attempts remain closed until an explicit retry. */
  prefetch(instances: readonly string[]): Promise<void> { return Promise.all([...new Set(instances)].sort().map((id) => this.ports.home.mode === 'owned' ? this.residents.has(id) ? Promise.resolve() : this.prefetchProduct(id) : this.ensure(id))).then(() => undefined); }
  private prefetchProduct(instance: string): Promise<LiveGridAdmission> {
    this.assertAlive(); const cell = this.assembly.cell(instance);
    const product = this.products.get(instance); if (product !== undefined) return Promise.resolve(product);
    const pending = this.productRequests.get(instance); if (pending !== undefined) return pending;
    const issue = this.issues.get(instance); if (issue !== undefined) return Promise.reject(new Error(issue));
    const request = (async (): Promise<LiveGridAdmission> => {
      let admission: LiveGridAdmission | undefined;
      try {
        await Promise.resolve(); this.assertAlive();
        admission = await this.ports.admit(cell); this.assertAlive();
        const bundle = this.ports.readiness.bundle(cell);
        if ((bundle.hybridWireBytes > 0 || admission.exclusiveRuntime === true) && admission.prepareRuntime === undefined) throw new Error('Hybrid runtime admission is missing');
        await admission.prepareRuntime?.(); this.assertAlive();
        this.products.set(instance, admission); return admission;
      } catch (error) {
        this.issues.set(instance, error instanceof Error ? error.message : String(error)); this.refusals.set(instance, error);
        try { admission?.cancel?.(); }
        catch (cleanup) { throw new AggregateError([error, cleanup], 'Live product admission and cancellation failed', { cause: cleanup }); }
        throw error;
      } finally { this.productRequests.delete(instance); }
    })();
    this.productRequests.set(instance, request); return request;
  }
  private ensure(instance: string): Promise<void> {
    if (this.disposed) return Promise.reject(new Error('Live grid is disposed'));
    const cell = this.assembly.cell(instance);
    if (this.borrowedHome(instance) || this.residents.has(instance)) return Promise.resolve();
    const pending = this.requests.get(instance); if (pending !== undefined) return pending;
    const issue = this.issues.get(instance); if (issue !== undefined) return Promise.reject(new Error(issue));
    const bundle = this.ports.readiness.bundle(cell), estimate = readinessModel(bundle, this.ports.readiness.link);
    const ticket = this.readiness.request(instance, 0, estimate, bundle.hybridWireBytes > 0);
    if (ticket === null) return Promise.reject(new Error('Stale live grid readiness request'));
    const request = this.admitRegion(cell, bundle, ticket, this.sequence);
    this.requests.set(instance, request); this.sequence = this.settle(request); return request;
  }
  private assertAlive(): void { if (this.disposed) throw new Error('Live grid is disposed'); }
  private async settle(request: Promise<void>): Promise<void> { try { await request; } catch { /* The requesting owner receives the admission error. */ } }
  private async admitRegion(cell: GridCell, bundle: ReadinessBundle, ticket: ReadinessTicket, previous: Promise<void>): Promise<void> {
    const instance = cell.instance;
    let admission: LiveGridAdmission | undefined;
    try {
      await previous; this.assertAlive(); this.retireColdRegions();
      const admitted = this.ports.home.mode === 'owned' ? await this.prefetchProduct(instance) : await this.ports.admit(cell);
      admission = admitted;
      this.assertAlive();
      if (this.ports.home.mode === 'owned') {
        if (this.active !== null || [...this.residents.values()].some((row) => row.exclusiveRuntime || row.disposalFailed)
          || (admitted.exclusiveRuntime === true && this.residents.size > 0)) throw new Error('Exclusive runtime awaits source departure and successful disposal');
        this.products.delete(instance);
      }
      if (this.ports.continuations === 'durable' && admitted.reloadsCheckpoint !== true && this.ports.read === undefined) throw new Error('Durable-only live regions require a checkpoint reader before allocation');
      // The borrowed home is a resident too; the permanent highway is outside the per-shard count.
      while (this.residents.size + (this.ports.home.mode === 'owned' ? 0 : 1) >= this.limit) {
        const candidate = [...this.residents].filter(([id, value]) => id !== this.active && value.reservations === 0 && !value.evicting)
          .sort(([a], [b]) => this.distance(this.assembly.cell(b)) - this.distance(this.assembly.cell(a)) || a.localeCompare(b))[0];
        if (candidate === undefined || !this.unload(candidate[0])) throw new Error('No durable frozen live region can be evicted');
      }
      let lease: ResidencyLease;
      if (instance === this.ports.home.instance && this.initialHomePending && this.ports.home.mode === 'owned') {
        // Runtime admission has checked the same measured source and manifest. Transfer only that exact whole cost;
        // until then the boot owner retains its sole reference and can abort without any regional world existing.
        lease = this.ports.home.residency.handoff(admitted.bytes); this.initialHomePending = false;
      } else {
        if (this.initialHomePending && this.ports.home.mode === 'owned') {
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
        if (this.ports.home.mode !== 'owned') await admitted.prepareRuntime?.();
        this.assertAlive(); this.readiness.complete(ticket, 'runtime');
        if (this.ports.pause !== undefined) await this.ports.pause();
        this.assertAlive();
        region = await admitted.create(prior, lease); this.checkRegion(region);
        if (this.ports.pause !== undefined) await this.ports.pause();
        this.assertAlive();
        if (packed !== undefined) this.saved.store(instance, packed);
        this.residents.set(instance, { region, lease, reloadsCheckpoint: admitted.reloadsCheckpoint === true || this.ports.read !== undefined, exclusiveRuntime: admitted.exclusiveRuntime === true, reservations: 0, evicting: false });
        this.readiness.complete(ticket, 'colliders'); this.readiness.complete(ticket, 'sim');
        lease.update({ needed: false, distance: this.distance(cell) });
      } catch (error) {
        try { region?.dispose(); }
        catch (cleanup) {
          if (region !== undefined) this.residents.set(instance, { region, lease, reloadsCheckpoint: admitted.reloadsCheckpoint === true,
            exclusiveRuntime: true, reservations: 0, evicting: false, disposalFailed: true });
          admission = undefined; // The retained world still owns its product and its full claim.
          throw new AggregateError([error, cleanup], 'Live region creation and disposal failed', { cause: cleanup });
        }
        lease.release(); throw error;
      }
    } catch (error) {
      this.readiness.invalidate(instance); this.issues.set(instance, error instanceof Error ? error.message : String(error)); this.refusals.set(instance, error);
      if (this.ports.home.mode === 'owned') this.products.delete(instance);
      try { admission?.cancel?.(); }
      catch (cleanup) { throw new AggregateError([error, cleanup], 'Live admission and product cancellation failed', { cause: cleanup }); }
      throw error;
    }
    finally { this.requests.delete(instance); }
  }
  private distance(cell: GridCell, p = this.worldFeet()): number { return Math.hypot(Math.max(0, Math.abs(p.x - cell.origin.x) - CHUNK_HALF), Math.max(0, Math.abs(p.z - cell.origin.z) - CHUNK_HALF)); }
  /** Automatic retirement uses a wider release radius and a continuous five-second dwell; explicit durable departure
   * still retires an exclusive runtime immediately before another foundation can allocate. */
  private retireColdRegions(): void {
    for (const cell of this.assembly.cells) {
      if (this.borrowedHome(cell.instance)) continue;
      const estimate = readinessModel(this.ports.readiness.bundle(cell), this.ports.readiness.link), distance = this.distance(cell);
      const resident = this.residents.get(cell.instance);
      const inside = distance <= estimate.distance + Math.max(10, this.ports.readiness.link.speed * 5);
      if (inside) {
        this.coldUnloadRefused.delete(cell.instance);
        if (resident !== undefined) delete resident.outsideSince;
      } else if (resident !== undefined) resident.outsideSince ??= this.fixedTick;
      const dwelling = resident !== undefined && (resident.outsideSince === undefined || this.fixedTick - resident.outsideSince < COLD_DWELL_TICKS);
      resident?.lease.update({ distance, needed: cell.instance === this.active || resident.reservations > 0 || resident.disposalFailed === true || dwelling });
      if (!inside && !dwelling && resident !== undefined && cell.instance !== this.active && resident.reservations === 0 && !resident.evicting
        && !this.coldUnloadRefused.has(cell.instance) && !this.unload(cell.instance)) this.coldUnloadRefused.add(cell.instance);
    }
  }
  /** Retry after a durability/budget change, instead of fetching the same failed request every tick. */
  retry(instance: string): void {
    if (this.requests.has(instance) || this.productRequests.has(instance)) throw new Error('Live admission is still pending');
    this.coldUnloadRefused.delete(instance);
    this.roadRetirementRefused.delete(instance);
    // A quota-refused unload kept a complete native region: retry must not invalidate its valid readiness ticket.
    if (this.residents.has(instance)) return;
    this.issues.delete(instance); this.refusals.delete(instance); this.readiness.invalidate(instance);
  }
  /** Preserve the original error identity for classified UI, instead of inferring failure type from a message. */
  refusal(instance: string): unknown { return this.refusals.get(instance); }
  /** Before the existing page physics/player step: radial requests are U-turn safe, and current-world walls synchronize first. */
  beforeFixed(): void {
    if (this.disposed) return;
    this.fixedTick++;
    const feet = this.worldFeet(), previous = this.previousFeet;
    const travelled = previous !== undefined && Math.hypot(feet.x - previous.x, feet.z - previous.z) >= APPROACH_TRAVEL_METRES;
    if (previous === undefined || travelled) this.previousFeet = feet;
    // Request the closest cells that fit the shard count. Requesting all eight within a wide cold bound
    // would repeatedly evict and rebuild earlier admissions even while the traveller stands still.
    // Unsupported far proxies do not consume the count before enterable cells inside the cold readiness bound.
    // Borrowed home remains allocated; an active non-home world also occupies a resident slot.
    // Owned-mode prefetch prepares products without allocating worlds, so it needs no such reservation.
    const reserved = this.ports.home.mode === 'owned' ? 0 : 1 + (this.active !== null && !this.borrowedHome(this.active) ? 1 : 0);
    const candidates = this.assembly.cells.filter((cell) => !this.borrowedHome(cell.instance) && cell.instance !== this.active && (this.ports.prefetchable?.(cell) ?? true))
      .sort((a, b) => this.distance(a) - this.distance(b) || a.instance.localeCompare(b.instance));
    const nearby = candidates.slice(0, Math.max(0, this.limit - reserved));
    // Active/prepared frames and recently nearby worlds remain protected without changing motor bands.
    this.retireColdRegions();
    for (const cell of nearby) {
      const estimate = readinessModel(this.ports.readiness.bundle(cell), this.ports.readiness.link), distance = this.distance(cell);
      if (distance <= estimate.distance && !this.issues.has(cell.instance)) void this.prefetch([cell.instance]).catch(() => undefined);
    }
    // Once the source has left, spend the road approach on the destination's admitted world rather than waiting
    // at its wall. Actual world-space movement selects the approaching cell: proximity alone would rebuild the
    // just-retired source behind the traveller. Stationary/missed first samples retain the original wall reach.
    if (this.ports.home.mode === 'owned' && this.active === null && this.requests.size === 0) {
      const wallReach = 6 + this.ports.player.motor.opts.radius + 0.5 + this.ports.readiness.link.speed / 60;
      const moving = !travelled ? undefined : candidates.find(cell => this.distance(cell, feet) < this.distance(cell, previous) - 0.000001);
      const approach = moving ?? nearby.find(cell => this.distance(cell, feet) <= wallReach);
      if (approach !== undefined && !this.issues.has(approach.instance)) {
        const reach = moving === undefined ? wallReach : Math.max(wallReach, readinessModel(this.ports.readiness.bundle(approach), this.ports.readiness.link).distance);
        if (this.distance(approach, feet) <= reach) {
          // A turn replaces any speculative world, including a declarative copy, only after durable disposal succeeds.
          // Never overlap opaque worlds, retry a failed save each tick, or discard an in-flight crossing reservation.
          for (const [instance] of this.residents) if (instance !== approach.instance
            && !this.roadRetirementRefused.has(instance) && !this.unload(instance)) this.roadRetirementRefused.add(instance);
          if (this.residents.size === 0) void this.ensure(approach.instance).catch(() => undefined);
        }
      }
    }
    const walls = this.ports.home.mode !== 'owned' && this.active === this.ports.home.instance ? this.ports.home.walls
      : this.active === null ? this.highway.walls : this.region(this.active)?.walls;
    walls?.sync(this.readiness);
  }
  /** Once after the existing player move; paused hook installation does not advance the region's simulation. */
  afterPlayerStep(): void {
    if (this.disposed || (this.active !== null && !this.ports.gameplayReady(this.active))) return;
    if (this.ports.home.mode !== 'owned' && this.active === this.ports.home.instance) this.ports.home.afterPlayerStep?.();
    else if (this.active === null && !('host' in this.highway)) this.highway.afterPlayerStep?.();
    else this.region(this.active)?.host.stepExternal();
  }
  /** Borrowed home uses its logical save owner; owned regions capture the current traveller without acquiring its motor. */
  checkpoint(instance: string): boolean { return finishSimSteps(this.checkpointSteps(instance)); }
  /** The same checkpoint in stages, for a periodic autosave spread over frames (rt3-freeze): the first `next()` captures
   *  at the caller's fixed-step boundary; later stages encode and write. A later checkpoint, a crossing or an unload
   *  supersedes it: it then returns false without writing, so an older capture never replaces a newer save. */
  *checkpointSteps(instance: string): Generator<undefined, boolean> {
    if (this.disposed) return false;
    const generation = (this.checkpointGenerations.get(instance) ?? 0) + 1; this.checkpointGenerations.set(instance, generation);
    if (this.ports.home.mode !== 'owned' && instance === this.ports.home.instance) return this.ports.home.checkpoint();
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
    try { if (!resident.disposalFailed && !this.checkpoint(instance)) return null; } catch { return null; }
    resident.evicting = true; let closed = false;
    return { abort: () => { if (closed) return; closed = true; resident.evicting = false; }, commit: () => {
      if (closed) return; closed = true;
      try { resident.region.dispose(); }
      catch (error) {
        resident.evicting = false; resident.disposalFailed = true; resident.lease.update({ needed: true });
        this.readiness.invalidate(instance); this.issues.set(`cleanup:${instance}`, error instanceof Error ? error.message : String(error)); return;
      }
      this.residents.delete(instance); this.readiness.invalidate(instance);
      if (resident.reloadsCheckpoint) this.saved.drop(instance);
      resident.lease.release();
    } };
  }
  /** Leave active/home/highway worlds intact; unload only a durably checkpointed frozen region. */
  unload(instance: string): boolean { if (this.borrowedHome(instance)) return false; if (!this.residents.has(instance)) return true; const prepared = this.prepareUnload(instance); if (prepared === null) return false; prepared.commit(); return !this.residents.has(instance); }
  /** Prepare disabled replacement controllers while the existing page stays authoritative; no entered runtime hooks run here. */
  async prepare(from: string | null, to: string | null): Promise<PreparedGridCrossing> {
    if (this.disposed || this.active !== from || from === to) throw new Error('Stale live frame preparation');
    if (this.ports.home.mode === 'owned' && from !== null && to !== null) throw new Error('Owned runtime crossing must commit onto the neutral road first');
    if (to !== null) await this.ensure(to);
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
    function finish(): void { closed = true; frames.delete(cancel); if (resident !== undefined) resident.reservations--; releaseHold?.(); }
    function cancel(): void { if (closed) return; motors.cancel(); finish(); }
    this.frames.add(cancel);
    return { cancel, commit: () => {
      if (closed || this.disposed || this.active !== from || !this.ready(to)) throw new Error('Stale live frame commit');
      motors.commit(); this.unbind?.(); this.unbind = undefined;
      this.ports.player.motor = rider.motor; this.active = to;
      const host = this.region(to)?.host; if (host !== undefined) this.unbind = host.bindExternalPlayer(this.ports.player);
      this.ports.bindFrame({ instance: to, physics: this.physics(to), motor: rider.motor, origin, ...(host === undefined ? {} : { host }) });
      this.residents.get(to ?? '')?.lease.update({ needed: true }); this.residents.get(from ?? '')?.lease.update({ needed: false });
      this.crossings++; this.transitions.push({ from, to }); if (this.transitions.length > 256) this.transitions.shift(); finish();
    } };
  }
  /** Read-only crossing evidence and failures for the real grid physics harness. */
  state(): LiveGridState { return { current: this.active, worldFeet: this.worldFeet(), crossings: this.crossings, transitions: this.transitions.map((row) => ({ ...row })), residents: [...this.residents.keys()].sort(), pending: [...new Set([...this.requests.keys(), ...this.productRequests.keys()])].sort(), issues: Object.fromEntries(this.issues), gameplayReady: this.active === null || this.ports.gameplayReady(this.active), continuations: this.ports.continuations === 'durable' ? { entries: 0, storedChars: 0, capacityChars: 0, claimedBytes: 0 } : { ...this.saved.state(), claimedBytes: this.disposed ? 0 : GRID_CONTINUATION_CACHE_BYTES } }; }
  /** Return the traveller to its page world before retiring regions. Failed disposals keep their full claims
   * and can be retried; the neutral highway disposer never owns the page physics or latest traveller motor. */
  dispose(): void {
    this.disposed = true;
    for (const cancel of this.frames) cancel(); this.unbind?.(); this.unbind = undefined;
    // Return the still-live page traveller before freeing a world that contains its current controller.
    const page = this.ports.home.mode === 'owned' ? null : this.ports.home.instance;
    if (this.active !== page) {
      const source = this.origin(this.active), origin = this.origin(page), physics = this.physics(page);
      const rider = { position: this.ports.player.position, motor: this.ports.player.motor }, mount = this.ports.mount?.();
      prepareFrameMotors(mount === undefined ? [rider] : [rider, mount], physics, { x: source.x - origin.x, z: source.z - origin.z }).commit();
      this.ports.player.motor = rider.motor; this.active = page;
      this.ports.bindFrame({ instance: page, physics, motor: rider.motor, origin });
    }
    const failures: unknown[] = [];
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
    this.homeLease?.release();
    this.saved.clear(); this.cacheLease?.release();
    if (failures.length > 0) throw new AggregateError(failures, 'Live grid disposal failed');
  }
}
