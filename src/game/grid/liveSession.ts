/**
 * The live crossing inside EXPERIMENTAL Wildshard (SHARD-PLATFORM SF18a / SF20a / SF17b, the grid client step 2): what
 * turns the step-1 session's closed soft walls into a real crossing. It composes sp-x2's `LiveGridHost` and sp-x1's
 * `GridCrossing` into the page's one fixed step:
 *
 * - **pre** (before the page's physics step): `beforeFixed` requests neighbours at their readiness distance and syncs the
 *   current world's soft walls; the crossing commits a prepared re-frame at the fixed boundary (one fixed step, the same
 *   page traveller: `Player.bindFrame`, `world.physics` and `app.physics` switch to the destination world).
 * - **post** (after the player's move): `afterPlayerStep` advances only the active owned region.
 * - **the render origin** (C39): the scene stays in the home cell's frame; while the traveller is in another frame the
 *   camera is offset by that frame's origin minus the home origin for the update / late / render phases only, and the
 *   offset comes off again at the next frame's input phase, so every fixed-step query reads the frame-local camera.
 * - **G68, the safe zone**: leaving a shard's cell stows silently to bare hands (no toast); entering the home cell restores
 *   its weapon; a template cell's weapon is its empty equipment (hands). G130 combat permission follows the feet's
 *   geometric cell at hit delivery, independently of the motor frame's 6/10 m hysteresis. The road is safe; each
 *   authoritative pipeline only admits the traveller inside its own cell, with regional actor-object provenance.
 * - **which cells are enterable**: shardfile shards (the template copies), each admitted as `createShardfileSim` in its
 *   own bodyless regional host with its strip duplicates; the rest refuse admission and stay far proxies behind closed
 *   walls until M3.
 */
import { Vector3, type PerspectiveCamera } from 'three';
import { CHUNK_HALF, ENTRY_ASPHALT } from '@wildshard/engine/core/config';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Events } from '@wildshard/engine/events/events';
import type { Physics } from '@wildshard/engine/physics/Physics';
import type { CharacterMotor } from '@wildshard/engine/physics/CharacterMotor';
import { castRay } from '@wildshard/engine/physics/query';
import type { PlayerFrameQueries } from '@wildshard/engine/player/Player';
import type { PlayerHealth } from '@wildshard/engine/combat/health';
import type { SaveStore } from '@wildshard/engine/saves/store';
import type { EquipmentService } from '@wildshard/engine/combat/EquipmentService';
import { createSimHost, SIM_API_VERSION, type SimHost, type SimLevel } from '@wildshard/engine/sim';
import { restoreSimHost } from '@wildshard/engine/sim/snapshot';
import { installStripCollider, PLATFORM_COLLIDER_OWNER } from '@wildshard/engine/physics/stripColliders';
import { installEntrySockets } from '@wildshard/engine/physics/entrySockets';
import { gridCreatureConstraint, installGridBorders } from '@wildshard/engine/physics/gridBorders';
import { ReadinessWalls, type ReadinessEdge } from '@wildshard/engine/physics/readinessWalls';
import { TransferWalls, TRANSFER_WALL_BYTES } from '@wildshard/engine/physics/transferWalls';
import type { ReadinessBundle, ReadinessLink } from '@wildshard/engine/sim/readiness';
import type { StripMesh } from '@wildshard/engine/sim/strips';
import type { GridAssembly, GridCell } from './assembly';
import type { ResidencyAllocator } from './allocator';
import type { HomeResidencyClaim } from './pageResidency';
import { LiveGridHost, type LiveGridAdmission, type LiveGridFrame, type LiveGridState } from './live';
import { installGridCrossing, type GridCheckpointResult, type GridCrossingSession, type GridCrossingState } from './crossing';
import { GridWallet, stowGridMount, type GridLoadout } from './wallet';
import { GridRegionDurability } from './durability';
import type { LedgerCatalogueItem } from '../ledger';
import { installGridHoverSpeed, installGridTravellerCombat } from './rules';
import { gridHomeSim, gridCells, type GridHomeSimulation } from './boot';
import { findShard } from '../shard/registry';
import { gridShardfileProduct } from './products';
import { gridRecovery, type GridRecoveryReason, type GridRecoveryRecord } from './recovery';
import { RoadRecovery, onRoad, type RoadPoint, type RoadRecoveryCell } from './roadRecovery';
import { GridCellWaitingError } from './refusal';
import { scriptDisabledNotice, type ScriptNoticePorts } from '../shardfile/scriptNotice';
import { bindShardfileSim, createShardfileSim, type ShardfileSimulation } from '../shardfile/simulation';
import { withCopyLayout } from './copyLayout';
import type { CollisionStrip } from './collisionStrips';
import { loadNavmesh } from '@wildshard/engine/physics/navmesh';
import { yieldGridAdmission } from './admissionYield';
import { HybridRuntimeSession, type HybridResident } from '../shardfile/hybrid';
import { prepareTrustedRuntime, type TrustedRuntimeEntry } from '../shardfile/runtime';
import { createRegionalRuntimeFactory, regionalRuntimeAccountedBytes, type PreparedRegionalRuntime, type RegionalRuntimePage } from './regionalRuntime';
import { createRegionalWorldFoundation } from './regionalWorld';
import { regionalRuntimeCheckpoint } from './runtimeCheckpoint';

/** The page traveller the live host rebinds (the existing Player; never a second capsule). */
export interface LiveTraveller {
  readonly position: Vector3; readonly yaw: number; readonly motor: CharacterMotor; readonly camera: PerspectiveCamera;
  /** feet on the ground this step (the road respawn remembers only where the traveller stood, G101; absent: never) */
  readonly onGround?: boolean;
  /** Shard-owned riding ends at its cell border through the ride's own dismount; the hoverboard stays with the traveller. */
  readonly ride?: { dismount: () => void } | null;
  /** `queries`: the frame's own ground, water and surfaces (null: the home level's, sp-x2's frame-query primitive) */
  bindFrame: (physics: Physics, motor: CharacterMotor, queries: PlayerFrameQueries | null) => void;
  /** the board's live speed cap (SF20d `installGridHoverSpeed` owns it while the grid runs) */
  hoverSpeedLimit: (() => number) | null;
}
/** What the live wiring reads from the page once the player's health and equipment exist. */
export interface LiveGridPage {
  /** G226: the page has no shard world; its catalogue home uses the same owned factory as every other hybrid. */
  readonly ownedHome?: boolean;
  /** Actual staged services; a neighbour never constructs another page shell. */
  readonly runtimePage?: () => RegionalRuntimePage | null;
  readonly traveller: LiveTraveller;
  readonly health: PlayerHealth;
  readonly equipment: EquipmentService;
  readonly events: Events;
  /** The existing page save service; regional continuations use stable catalogue instance ids. */
  readonly saves: SaveStore;
  /** Flush the page's real progress/loadout owner; storage refusal must hold the source frame. */
  readonly checkpoint: () => boolean;
  /** Optional polled storage readiness. Pending never grants permission; true is followed by a fresh local/native checkpoint. */
  readonly crossingSaveReady?: (instance: string) => GridCheckpointResult;
  /** Page-owned script notices; regional scripts never construct another HUD. */
  readonly scriptNotices?: ScriptNoticePorts;
  /** The home runtime's resolved higher fall floor; neighbour floors come from their own declarations. */
  readonly homeFallFloor?: number;
  /** Profile rewards are restricted to the platform's admitted catalogue. */
  readonly catalogue: readonly LedgerCatalogueItem[];
  /** Clear harmful player effects when fixed-step feet cross the cell edge into the safe zone. */
  readonly onSafeZone?: () => void;
  /** switch the page's stepped world (world.physics and app.physics) */
  readonly setPhysics: (physics: Physics) => void;
  readonly onFixedPre: (fn: () => void) => void;
  readonly onFixedPost: (fn: () => void) => void;
  readonly onInput: (fn: () => void) => void;
  /** registered after the player's update (the camera is placed by then) */
  readonly onUpdate: (fn: () => void) => void;
}
/** What the session lends: the assembly, the home world and its walls, the strips and the one allocator. */
export interface LiveGridSessionPorts {
  readonly residency: HomeResidencyClaim;
  readonly assembly: GridAssembly; readonly home: GridCell; readonly physics: Physics; readonly scope: Scope;
  readonly walls: ReadinessWalls; readonly strips: readonly CollisionStrip[]; readonly allocator: ResidencyAllocator;
  /** G219: platform ground past the strips (the open plots' floors and showrooms), grid metres; the highway collides with it too */
  readonly platform?: readonly StripMesh[];
  readonly neighbourEdges: (cell: GridCell, origin: Readonly<{ x: number; z: number }>) => ReadinessEdge[];
  readonly rimEdges: (origin: Readonly<{ x: number; z: number }>) => ReadinessEdge[];
}
/** The readout: the live host's crossing telemetry, the crossing coordinator and the safe-zone state. */
export interface LiveGridSessionState {
  readonly live: LiveGridState; readonly crossing: GridCrossingState; readonly stowed: boolean; readonly renderOrigin: { x: number; z: number };
  /** Entered hook intervals in the same performance clock as browser long tasks. */
  readonly runtimeTiming: ReturnType<HybridRuntimeSession['timings']>;
  /** the board's cap now (m/s; null off the board's grid rule) and whether the home client's simulation runs (null: no handoff) */
  readonly hoverCap: number | null; readonly homeActive: boolean | null;
}
/** The highway's own surfaces: the deck and strips at road level, no water (G72: the outer ring is land). */
const HIGHWAY_QUERIES: PlayerFrameQueries = { heightAt: () => 0, waterSurfaceAt: () => null, platforms: [] };
/** A spawn in the active frame's local coordinates (fall recovery and respawn in a region that is not the home). */
export interface LiveGridSpawn { readonly x: number; readonly y: number | undefined; readonly z: number; readonly yaw: number }

/** The platform travel envelope at the deck's 30 m/s; a shardfile's critical bundle is its declared compressed sim. */
const LINK: ReadinessLink = { speed: 30, linkBitsPerSecond: 5_000_000, requestLatencySeconds: 0.25, maxStallSeconds: 10 };
const PLATFORM_LEVEL: SimLevel = { version: SIM_API_VERSION, id: 'platform.highway', seed: 1, ground: { size: 2000, height: 0 }, player: { at: { x: 0, y: 0, z: 0 }, yaw: 0, speed: 30 }, entities: [], quests: [],
  weapon: { id: 'platform.hands', shape: { kind: 'point', radius: 0 }, windup: 0, active: 0, recover: 0, cooldown: 0, range: 0, damage: 0, tags: [] } };

/** The home cell's G68 loadout: stow silently to hands at the border, restore the shard's weapon on re-entry. */
function homeLoadout(equipment: EquipmentService, scope: Scope, checkpoint: () => boolean, stowMount: () => void): GridLoadout {
  let before: { stowed: boolean; tools: readonly { tool: EquipmentService['tools'][number]; enabled: boolean }[] } | undefined;
  return {
    checkpoint,
    stow: () => {
      if (scope.disposed) return;
      stowMount();
      if (before !== undefined) return;
      before = { stowed: equipment.stowed, tools: equipment.tools.map((tool) => ({ tool, enabled: tool.enabled })) };
      equipment.stowed = true; equipment.adsHeld = false; equipment.altHeld = false;
      for (const tool of equipment.tools) tool.enabled = false;
    },
    interior: () => {
      if (scope.disposed || before === undefined) return;
      const prior = before; before = undefined;
      equipment.stowed = prior.stowed;
      for (const { tool, enabled } of prior.tools) tool.enabled = enabled;
    },
  };
}
function regionTransferWalls(host: SimHost, radius: number, restoring = false): TransferWalls {
  const walls = new TransferWalls(() => host.physics, [{ x: 0, z: 0 }], radius, 'exit', host.scope, restoring);
  host.onStep('platform.transferWalls', () => undefined, { snapshot: () => walls.snapshot(), restore: value => { walls.restore(value); } });
  return walls;
}
/** The live crossing for one grid page; disposed with the level scope. */
export class LiveGridSession {
  readonly live: LiveGridHost;
  private crossing: GridCrossingSession;
  private readonly ports: LiveGridSessionPorts;
  private readonly page: LiveGridPage;
  private readonly durability = new Map<string, GridRegionDurability>();
  private readonly transferWalls = new Map<string | null, TransferWalls>();
  private readonly offset = new Vector3();
  private framePhysics: Physics;
  private readonly applied = new Vector3();
  private readonly loadout: GridLoadout;
  private readonly roadWallet: GridWallet;
  /** each admitted region's authored spawn (its level's player start) and its ground / water queries, local */
  private readonly regions = new Map<string, { readonly spawn: LiveGridSpawn; readonly queries: PlayerFrameQueries; readonly simulation: ShardfileSimulation }>();
  private homeSim: GridHomeSimulation | null = null;
  private readonly runtimeScope: Scope;
  private readonly runtimeRegions = new Map<string, PreparedRegionalRuntime>();
  private readonly runtimeResidents = new Map<string, HybridResident>();
  private readonly runtimeEntries: TrustedRuntimeEntry[] = [];
  private readonly hybrid: HybridRuntimeSession;
  private readonly startedRuntimes = new Set<string>();
  private activation: Promise<boolean> | undefined;
  private checkpointsSuppressed = false;
  /** G101: the last road point, where a fall that began from the road recovers */
  private readonly road: RoadRecovery;
  private readonly respawnCells = new Map<string, RoadRecoveryCell>();

  constructor(ports: LiveGridSessionPorts, page: LiveGridPage) {
    if (ports.residency.allocator !== ports.allocator || ports.residency.instance !== ports.home.instance) throw new Error('Live grid requires its admitted home on the page allocator');
    this.ports = ports; this.page = page;
    // The one-shot boot intent identifies the home before GridSession constructs; an owned page starts on the road.
    if (page.ownedHome === true) gridCells.leave();
    this.framePhysics = ports.physics;
    const { assembly, home, scope } = ports, rapier = ports.physics.R;
    const traveller = page.traveller;
    // Register the resident parent before the live host disposer: the traveller returns before native children free.
    this.runtimeScope = scope.child('grid.runtime.residents');
    this.hybrid = new HybridRuntimeSession(this.runtimeResidents, this.runtimeEntries, scope, { pause: yieldGridAdmission });
    scope.onDispose(gridCells.onLeave(() => { this.hybrid.leave(); }));
    scope.onDispose(gridCells.onEnter(cell => {
      if (!this.runtimeResidents.has(cell.instance)) return;
      this.startedRuntimes.add(cell.instance);
      const activation = this.hybrid.enter(cell);
      this.activation = activation;
      const report = async (): Promise<void> => { try { await activation; } catch (error) { console.error('Regional runtime entry failed', error); } };
      void report();
    }));
    const transferScope = scope.child('grid.transfer.home');
    this.roadWallet = new GridWallet(page.saves, { id: home.instance, shard: home.slug });
    const transferLease = page.ownedHome === true ? undefined : ports.allocator.reserve({ id: `sim-transfer:${home.instance}`, category: 'sim', owner: home.instance,
      bytes: TRANSFER_WALL_BYTES, distance: 0, needed: true });
    if (transferLease === null) { transferScope.dispose(); throw new Error('Home transfer fence exceeds residency budget'); }
    transferScope.onDispose(() => { transferLease?.release(); });
    try { if (page.ownedHome !== true) this.transferWalls.set(home.instance, new TransferWalls(() => ports.physics, [{ x: 0, z: 0 }], traveller.motor.opts.radius, 'exit', transferScope)); }
    catch (error) { transferScope.dispose(); throw error; }
    this.road = new RoadRecovery(assembly);
    for (const cell of assembly.cells) {
      const entryways = ports.strips.flatMap((strip): RoadRecoveryCell['entryways'] => {
        const duplicate = strip.duplicates.find((row) => row.instance === cell.instance), turn = strip.turnIn;
        if (duplicate === undefined || turn === undefined) return [];
        const axis = strip.id.startsWith('gap.x.') ? 'x' : 'z', positive = duplicate.mesh.origin[axis] > 0;
        const width = turn.widths[positive ? 0 : 1];
        if (width <= 0) return [];
        return [{ edge: axis === 'x' ? positive ? 'east' : 'west' : positive ? 'north' : 'south', width }];
      });
      this.respawnCells.set(cell.instance, { instance: cell.instance, origin: cell.origin, entryways });
    }
    const player = { get position() { return traveller.position; }, get yaw() { return traveller.yaw; }, health: page.health, owner: traveller, motor: traveller.motor };
    const highwayBytes = ports.strips.reduce((sum, strip) => sum + strip.mesh.positions.byteLength + strip.mesh.indices.byteLength, 0)
      + (ports.platform ?? []).reduce((sum, mesh) => sum + mesh.positions.byteLength + mesh.indices.byteLength, 0)
      + assembly.cells.length * TRANSFER_WALL_BYTES;
    try { this.live = new LiveGridHost(assembly, {
      continuations: 'durable', // Every owned production region below reconstructs its basis and reloads its durable save.
      home: page.ownedHome === true ? { mode: 'owned', instance: home.instance, bytes: ports.residency.bytes, residency: ports.residency }
        : { instance: home.instance, physics: ports.physics, bytes: ports.residency.bytes, residency: ports.residency, checkpoint: () => this.checkpointHome(), walls: ports.walls },
      player, allocator: ports.allocator,
      highway: { bytes: highwayBytes, create: () => {
        if (page.ownedHome === true) {
          const highwayScope = scope.child('grid.highway.platform');
          this.transferWalls.set(null, new TransferWalls(() => ports.physics, assembly.cells.map(cell => cell.origin), traveller.motor.opts.radius, 'entry', highwayScope));
          // GridSession already installed global strips/sockets/readiness walls in this neutral root. It never frees
          // root Physics or the latest traveller motor; page teardown runs after the live registry returns that motor.
          return { physics: ports.physics, walls: ports.walls, dispose: () => { highwayScope.dispose(); } };
        }
        const host = createSimHost(PLATFORM_LEVEL, { rapier, playerBody: false, ground: false });
        try {
          for (const strip of ports.strips) installStripCollider(host.physics, strip.mesh, host.scope);
          for (const mesh of ports.platform ?? []) installStripCollider(host.physics, mesh, host.scope);
          const origin = { x: 0, z: 0 };
          const walls = new ReadinessWalls(host.physics, [...assembly.cells.flatMap((cell) => ports.neighbourEdges(cell, origin)), ...ports.rimEdges(origin)], host.scope);
          this.transferWalls.set(null, new TransferWalls(() => host.physics, assembly.cells.map(cell => cell.origin), traveller.motor.opts.radius, 'entry', host.scope));
          return { host, walls, dispose: () => { host.dispose(); } };
        } catch (error) { host.dispose(); throw error; }
      } },
      admit: (cell) => this.admit(cell),
      pause: () => yieldGridAdmission(scope),
      prefetchable: (cell) => { const manifest = findShard(cell.slug); return (manifest?.shardfile ?? manifest?.gridShardfile) !== undefined; },
      save: (instance, snapshot) => this.regionSave(instance).checkpoint(snapshot),
      bindFrame: (frame) => { this.bind(frame); },
      gameplayReady: () => this.gameplayReady(),
      readiness: { link: LINK, bundle: (cell) => this.bundle(cell) },
    }); } catch (error) { transferScope.dispose(); throw error; }
    scope.onDispose(() => { this.live.dispose(); });
    this.loadout = homeLoadout(page.equipment, scope, page.checkpoint, () => { stowGridMount(traveller); });
    this.crossing = this.installCrossing();
    installGridTravellerCombat(page.events, scope, page.health, () => {
      const active = this.hybrid.state();
      return active.ready ? active.instance : home.instance;
    }, () => {
      const feet = this.live.worldFeet();
      return assembly.at(feet.x, feet.z)?.instance ?? null;
    }, () => {
      const active = this.hybrid.state();
      return active.instance === null ? undefined : this.runtimeRegions.get(active.instance)?.combatActors();
    });
    // SF20d: 30 m/s on the deck, easing to the shard's 14 over the strip (the cell nearest the feet; the outer ring is deck too)
    installGridHoverSpeed(traveller, scope, () => {
      const feet = this.live.worldFeet(), p = assembly.pitch;
      const local = { x: feet.x - Math.round(feet.x / p) * p, y: feet.y, z: feet.z - Math.round(feet.z / p) * p };
      return { local, shardCap: 14, onHighwayDeck: feet.y < 4 };
    });
    // the freeze fence: the home client's existing driver runs only while the traveller is in the home frame (sp-x5's handoff)
    scope.onDispose(gridHomeSim.take((sim) => {
      if (sim.residency !== ports.residency) throw new Error('Home simulation handoff must retain its admitted page claim');
      this.homeSim = sim; sim.setActive(this.live.current() === home.instance);
      if (this.checkpointsSuppressed) sim.suppressCheckpoint?.();
    }));
    scope.onDispose(() => { this.homeSim?.setActive(true); this.homeSim = null; });
    page.onFixedPre(() => {
      if (scope.disposed) return;
      this.live.beforeFixed(); this.crossing.step(this.live.worldFeet());
      const walls = this.transferWalls.get(this.live.current());
      if (walls === undefined) throw new Error('Active transfer fence is missing');
      walls.sync();
    });
    let saveTicks = 0, wasInside = assembly.at(this.live.worldFeet().x, this.live.worldFeet().z) !== undefined;
    page.onFixedPost(() => {
      if (scope.disposed) return;
      const feet = this.live.worldFeet();
      const cell = assembly.at(feet.x, feet.z);
      // G189 is geometric, even while the physical motor still belongs to the source across the strip.
      if (wasInside && cell === undefined) page.onSafeZone?.();
      wasInside = cell !== undefined;
      this.live.afterPlayerStep();
      const recoveryCell = cell === undefined ? undefined : this.respawnCells.get(cell.instance);
      const p = traveller.position;
      const hit = traveller.onGround === true ? castRay(this.framePhysics, { x: p.x, y: p.y + 0.6, z: p.z }, { x: 0, y: -1, z: 0 }, 1.35, ['WORLD'], traveller.motor.collider) : null;
      const grounded = hit !== null && Math.abs(hit.point.y - p.y) <= 0.75;
      // Shared strips/aprons never establish a shard checkpoint. The declared 8x15 asphalt socket does.
      const entry = recoveryCell?.entryways.some(({ edge, width }) => {
        const axis = edge === 'east' || edge === 'west' ? 'x' : 'z', along = axis === 'x' ? 'z' : 'x';
        const sign = edge === 'east' || edge === 'north' ? 1 : -1;
        const depth = CHUNK_HALF - sign * (feet[axis] - recoveryCell.origin[axis]);
        return depth >= 0 && depth <= ENTRY_ASPHALT && Math.abs(feet[along] - recoveryCell.origin[along]) <= width / 2;
      }) === true;
      const shardGround = grounded && cell?.instance === this.live.current() && (hit.owner !== PLATFORM_COLLIDER_OWNER || entry);
      this.road.observe(feet, traveller.yaw, grounded, recoveryCell, shardGround);
      if (++saveTicks >= 300) { saveTicks = 0; this.checkpoint(); }
    });
    page.onInput(() => { traveller.camera.position.sub(this.applied); this.applied.set(0, 0, 0); });
    page.onUpdate(() => { if (this.offset.lengthSq() === 0) return; traveller.camera.position.add(this.offset); this.applied.copy(this.offset); });
    scope.onDispose(() => { traveller.camera.position.sub(this.applied); this.applied.set(0, 0, 0); });
    scope.listen(window, 'pagehide', () => { this.checkpoint(); });
    scope.listen(document, 'visibilitychange', () => { if (document.visibilityState === 'hidden') this.checkpoint(); });
    scope.onDispose(() => { this.checkpoint(); });
  }

  private installCrossing(): GridCrossingSession {
    return installGridCrossing({ current: () => this.live.current(), prepare: (from, to) => this.prepareCrossing(from, to),
      ready: (instance) => this.live.ready(instance), checkpoint: (instance) => {
        const readiness = this.page.crossingSaveReady?.(instance) ?? true;
        return readiness === true ? this.live.checkpoint(instance) : readiness;
      }, target: (feet) => this.live.target(feet) },
    this.ports.assembly, (instance) => instance === this.ports.home.instance && this.page.ownedHome !== true ? this.loadout : this.runtimeRegions.get(instance)?.loadout ?? {
      checkpoint: () => this.regionSave(instance).flush(), stow: () => { stowGridMount(this.page.traveller); }, interior: () => undefined,
    }, this.ports.scope, (from, to) => {
      if (this.page.ownedHome !== true || to !== null || from === null) return;
      gridCells.leave(); // entered callbacks must finish before their retained native world retires
      this.live.unload(from); // false retains the full source claim and the next materialization fence
    });
  }

  private prepareCrossing(from: string | null, to: string | null): ReturnType<LiveGridHost['prepare']> {
    if (this.page.ownedHome === true && from === null && to !== null) {
      // Retry a refused source cleanup before any destination foundation/whole-runtime claim is allocated.
      for (const instance of this.live.state().residents) {
        if (instance !== to && !this.live.unload(instance)) throw new Error('Previous region is not durably retired');
      }
      if (!this.live.state().pending.includes(to)) this.live.retry(to);
    }
    return this.live.prepare(from, to);
  }

  private checkpointHome(): boolean {
    if (this.checkpointsSuppressed) return false;
    // There is no home gameplay owner in the neutral shell. Retry the real stored local purse/bag without flushing
    // the page's inert Progress/Inventory copies over a newer owned runtime continuation.
    if (this.page.ownedHome === true) return this.roadWallet.flush();
    const sim = this.homeSim;
    return sim !== null && !sim.disposed() ? sim.checkpoint() : this.page.checkpoint();
  }

  private regionSave(instance: string): GridRegionDurability {
    const saved = this.durability.get(instance);
    if (saved === undefined) throw new Error('Regional durability was not admitted');
    return saved;
  }

  /** Save the active region and retry its pending profile/local rewards before a reload or page exit. */
  checkpoint(): boolean {
    if (this.checkpointsSuppressed) return false;
    const current = this.live.current();
    const durable = current === null ? this.checkpointHome() : this.live.checkpoint(current);
    if (!durable) return false;
    const cell = current === null ? this.ports.home : this.ports.assembly.cell(current);
    const feet = this.worldFeet();
    const inside = this.ports.assembly.at(feet.x, feet.z)?.instance === current;
    const local = this.ports.assembly.local(feet, cell);
    return gridRecovery(this.page.saves).save(this.ports.assembly, cell, this.recoveryRoad(), inside
      ? { kind: 'cell', ...local, yaw: this.page.traveller.yaw } : { kind: 'road' });
  }

  /** Last grounded road lane; before the first road visit use the admitted home's adjacent lane. */
  recoveryRoad(): RoadPoint {
    return this.road.lastRoad() ?? { x: this.ports.home.origin.x + this.ports.assembly.pitch / 2 + 3.6,
      z: this.ports.home.origin.z, yaw: this.page.traveller.yaw };
  }

  /** Recovery only, never called by crossings: failed persistence returns the graphics recovery to title. */
  prepareRecovery(reason: Exclude<GridRecoveryReason, 'new-game'>): boolean {
    if (this.ports.scope.disposed || !this.checkpoint()) return false;
    if (!gridRecovery(this.page.saves).write(this.ports.assembly, this.ports.home, this.recoveryRoad(), reason)) return false;
    // The intent names exactly this checkpoint; a later pagehide/timer must not replace its location or continuation.
    this.checkpointsSuppressed = true;
    this.homeSim?.suppressCheckpoint?.();
    return true;
  }

  /** Capture before reset; run only after success, without flushing old state into the reset save. */
  prepareNewGameRecovery(): () => void {
    if (!this.checkpoint()) throw new Error('New game requires a durable current checkpoint');
    const road = this.recoveryRoad();
    const current = this.live.current();
    const home = current === null ? this.ports.home : this.ports.assembly.cell(current);
    return () => {
      this.checkpointsSuppressed = true;
      this.homeSim?.suppressCheckpoint?.();
      const recovery = gridRecovery(this.page.saves);
      if (recovery.save(this.ports.assembly, home, road, { kind: 'road' })) recovery.write(this.ports.assembly, home, road, 'new-game');
    };
  }

  /** Ordinary admitted boot then a prepared highway transfer, with progress read from real instance saves. */
  async resumeRoad(road: RoadPoint): Promise<void> {
    if (!onRoad(this.ports.assembly, road.x, road.z) || ![road.x, road.z, road.yaw].every(Number.isFinite)) throw new Error('Invalid recovery road');
    if (this.page.ownedHome === true && this.live.current() === null) {
      this.page.traveller.position.set(road.x, 0.5, road.z);
      this.road.observe({ x: road.x, y: 0, z: road.z }, road.yaw, true);
      return;
    }
    if (this.live.current() !== this.ports.home.instance) throw new Error('Recovery requires the newly admitted home');
    this.loadout.stow();
    const prepared = await this.live.prepare(this.ports.home.instance, null);
    try {
      if (this.ports.scope.disposed) throw new Error('Recovery boot disposed');
      prepared.commit();
    } catch (error) { prepared.cancel(); throw error; }
    this.crossing.crossing.dispose(); this.crossing = this.installCrossing();
    this.page.traveller.position.set(road.x, 0.5, road.z);
    this.road.observe({ x: road.x, y: 0, z: road.z }, road.yaw, true);
  }

  /** Initial staging only: admit the owned home after the page play host exists and before its first fixed tick. */
  async enterInitialHome(): Promise<void> {
    if (this.page.ownedHome !== true || this.live.current() !== null) throw new Error('Owned home must start on the neutral road');
    const cell = this.ports.home, manifest = findShard(cell.slug);
    if (manifest === undefined) throw new Error('Initial owned home is absent from its catalogue');
    const spawn = manifest.spawn, feet = this.ports.assembly.world({ x: spawn.x, y: spawn.y ?? 0, z: spawn.z }, cell);
    if (this.ports.assembly.at(feet.x, feet.z)?.instance !== cell.instance) throw new Error('Initial spawn is outside its owned cell');
    const prepared = await this.prepareCrossing(null, cell.instance);
    try {
      if (this.ports.scope.disposed) throw new Error('Owned home boot disposed');
      this.page.traveller.position.set(feet.x, feet.y, feet.z);
      prepared.commit();
    } catch (error) { prepared.cancel(); throw error; }
    this.crossing.crossing.dispose(); this.crossing = this.installCrossing();
    this.startedRuntimes.add(cell.instance);
    gridCells.enter({ instance: cell.instance, slug: cell.slug });
    if (await this.activation !== true || !this.gameplayReady()) throw new Error('Initial owned home gameplay is not ready');
    const runtime = this.runtimeRegions.get(cell.instance);
    if (runtime === undefined) throw new Error('Initial owned runtime is missing');
    // Source spawn height may be terrain-derived; query only after its entered world services finish installing.
    this.page.traveller.position.y = spawn.y ?? runtime.queries.heightAt(spawn.x, spawn.z) + 0.5;
    runtime.loadout.interior();
  }

  /** Normal boot admits the saved instance and its continuation before applying its durable local pose. */
  async resumeRecovery(record: NonNullable<GridRecoveryRecord>): Promise<{ x: number; y: number; z: number; yaw: number; road: boolean }> {
    if (record.instance !== this.ports.home.instance || ![record.slug].includes(this.ports.home.slug)) throw new Error('Recovery instance was not admitted');
    const saved = record.saved;
    if (saved?.location.kind !== 'cell') {
      await this.resumeRoad(record.road);
      return { ...record.road, y: 0.5, road: true };
    }
    if (saved.instance !== record.instance || ![saved.slug].includes(record.slug) || this.live.current() !== record.instance) throw new Error('Recovery continuation does not match the active instance');
    const { x, y, z, yaw } = saved.location;
    const world = this.ports.assembly.world(saved.location, this.ports.home);
    if (this.ports.assembly.at(world.x, world.z)?.instance !== record.instance) throw new Error('Recovery pose is outside the admitted cell');
    this.page.traveller.position.set(x, y, z);
    if (this.page.ownedHome === true) this.runtimeRegions.get(record.instance)?.loadout.interior(); else this.loadout.interior();
    return { x, y, z, yaw, road: false };
  }

  /** The traveller's world feet (grid metres), whatever frame it is in. */
  worldFeet(): { x: number; y: number; z: number } { return this.live.worldFeet(); }
  /** Retry a refused source save without reloading the prepared destination; retreat also cancels the hold safely. */
  retrySave(): void { this.crossing.crossing.retrySave(); }
  /** Original latest admission failure for classified UI; retry clears it before another generation begins. */
  refusal(instance: string): unknown { return this.live.refusal(instance); }

  private bundle(cell: GridCell): ReadinessBundle {
    const manifest = findShard(cell.slug);
    if (manifest?.gridShardfile !== undefined && manifest.trustedRuntime !== undefined) return { criticalWireBytes: 2_000_000, hybridWireBytes: 2_000_000, decodeSeconds: 1, runtimeParseSeconds: 1 };
    return { criticalWireBytes: findShard(cell.slug)?.shardfile === undefined ? 0 : 2_000_000, hybridWireBytes: 0, decodeSeconds: 1, runtimeParseSeconds: 0 };
  }

  /** Shardfile cells admit a bodyless regional host with their strip duplicates; every other cell waits for M3. */
  private async admit(cell: GridCell): Promise<LiveGridAdmission> {
    const pending = gridShardfileProduct(cell.slug, { allocator: this.ports.allocator, scope: this.ports.scope });
    if (pending === null) throw new GridCellWaitingError(`${cell.slug} is not a shardfile shard (it stays a far proxy until M3)`);
    const retained = await pending, { source, assets } = retained.admitted;
    let releaseProduct = retained.release;
    try {
    if (source.runtime !== null) return await this.admitRuntime(cell, retained);
    let durability = this.durability.get(cell.instance);
    if (durability === undefined) {
      durability = new GridRegionDurability(this.page.saves, { id: cell.instance, shard: cell.slug }, source, this.page.catalogue);
      this.durability.set(cell.instance, durability);
    }
    const savedRegion = durability, quest = savedRegion.quest;
    releaseProduct = () => {
      if (this.durability.get(cell.instance) === savedRegion) this.durability.delete(cell.instance);
      retained.release();
    };
    const groundResolution = source.edge.north.heights.length === 256 ? 256 : 257;
    // G220 pass 2: a shared product's copy collides with its own landmarks (copyLayout.ts); every other cell gets its source unchanged
    const copySource = withCopyLayout(source, cell.identity);
    const generatedGroundBytes = source.terrain === null ? 2 * groundResolution ** 2 * Float32Array.BYTES_PER_ELEMENT : 0;
    const rapier = this.ports.physics.R, duplicates = this.ports.strips.flatMap((strip) => strip.duplicates.filter((row) => row.instance === cell.instance).map((row) => row.mesh));
    const notices = this.page.scriptNotices;
    const scriptPorts = notices === undefined ? {} : { scriptDisabled: scriptDisabledNotice(notices) };
    // Four native creature-only walls and their shape/query adapters belong to this regional claim.
    return { bytes: source.budgets.sim.resident + generatedGroundBytes + 4096 + TRANSFER_WALL_BYTES, reloadsCheckpoint: true, cancel: releaseProduct, create: (saved) => {
      let sim: ShardfileSimulation = createShardfileSim(copySource, assets, { rapier, playerBody: false, quest, groundResolution, ...scriptPorts });
      let releaseBasis: () => void = () => undefined;
      let transfer: TransferWalls;
      try {
        for (const mesh of duplicates) installStripCollider(sim.host.physics, mesh, sim.host.scope);
        // Admission proves real, clear, dry ground first. A 5mm backstop avoids coplanar ghost contacts. Include it
        // in the immutable basis; exact restore carries its tagged handles and must not install another four floors.
        installEntrySockets(sim.host.physics, sim.host.scope, [{ x: 0, z: 0 }], 'backstop');
        installGridBorders(sim.host.physics, sim.host.scope);
        transfer = regionTransferWalls(sim.host, this.page.traveller.motor.opts.radius);
        const basis = sim.host.physics.snapshot();
        const basisLease = this.ports.allocator.reserve({ id: `sim-basis:${cell.instance}`, category: 'sim', owner: cell.instance,
          bytes: basis.byteLength, distance: 0, needed: true });
        if (basisLease === null) throw new Error('Regional checkpoint basis exceeds residency budget');
        releaseBasis = () => { basisLease.release(); };
        savedRegion.setPhysicsBasis(basis);
        const prior = saved ?? savedRegion.read(true);
        if (prior !== undefined) {
          const authored = sim.host.level; sim.dispose();
          const host = restoreSimHost(authored, { rapier }, prior, (restored) => {
            sim = bindShardfileSim(restored, copySource, assets, { rapier, restoring: true, quest, ...scriptPorts }); savedRegion.bind(restored, sim.colliders);
            transfer = regionTransferWalls(restored, this.page.traveller.motor.opts.radius, true);
          });
          host.detachPlayerMotor(); // the restored world carries its strip duplicates already
        } else {
          savedRegion.bind(sim.host, sim.colliders);
          if (!savedRegion.restoreLogical(sim)) throw new Error('Regional logical migration was refused');
        }
        const region = sim, start = region.host.level.player, host = region.host, water = region.water;
        transfer.sync(); this.transferWalls.set(cell.instance, transfer);
        // Motors collide with BORDER; analytic/flying motion uses the same walls before sampling admitted terrain.
        // Restore already carries the four colliders in its native basis, so only these live readers reconnect.
        for (const actor of host.entities.values()) actor.motionConstraint = gridCreatureConstraint(() => host.physics, actor.dims.bodyRadius * actor.scale);
        // Reinstall on the final host after native restore. Repeated actor ids in another region confer no permission.
        installGridTravellerCombat(host.events, host.scope, this.page.health, cell.instance, () => {
          const feet = this.live.worldFeet();
          return this.ports.assembly.at(feet.x, feet.z)?.instance ?? null;
        }, new Map([...host.entities.values()].map(actor => [actor.combatActor(), actor.position])));
        this.regions.set(cell.instance, { spawn: { x: start.at.x, y: undefined, z: start.at.z, yaw: start.yaw },
          // the admitted terrain inside the cell (one source of truth); its strips are road level (the terrain tile ends at the cell edge)
          queries: { heightAt: (x, z) => (Math.max(Math.abs(x), Math.abs(z)) <= CHUNK_HALF ? host.groundHeightAt(x, z) : 0), waterSurfaceAt: (x, z) => water.restAt(x, z), platforms: [] }, simulation: region });
        this.respawnCells.set(cell.instance, { instance: cell.instance, origin: cell.origin, entryways: source.entryways });
        return Promise.resolve({ host: region.host, dispose: () => {
          this.regions.delete(cell.instance); this.transferWalls.delete(cell.instance); savedRegion.unbind();
          try { region.dispose(); } finally { try { releaseBasis(); } finally { releaseProduct(); } }
        } });
      } catch (error) {
        savedRegion.unbind();
        try { sim.dispose(); } finally { releaseBasis(); }
        throw error;
      }
    } };
    } catch (error) { releaseProduct(); throw error; }
  }

  private async admitRuntime(cell: GridCell, retained: Awaited<NonNullable<ReturnType<typeof gridShardfileProduct>>>): Promise<LiveGridAdmission> {
    const manifest = findShard(cell.slug), declaration = retained.admitted.source.runtime;
    if (manifest === undefined || declaration === null || manifest.trustedRuntime === undefined) throw new GridCellWaitingError('Missing declared trusted regional entry');
    const page = this.page.runtimePage?.();
    if (page === undefined || page === null) throw new GridCellWaitingError('Regional page services are not ready');
    const load = manifest.load;
    if (load === undefined) throw new GridCellWaitingError('Missing trusted first-party loader');
    const registered = manifest.trustedRuntime;
    const entry: TrustedRuntimeEntry = { ...registered, load: async () => {
      const loaded = await load(), resolve = loaded.resolveTrustedRuntime;
      if (resolve === undefined) throw new Error('Trusted plugin module does not resolve its declared entry');
      return { default: resolve(registered.entry) };
    } }, bytes = regionalRuntimeAccountedBytes(retained.admitted, manifest);
    await prepareTrustedRuntime(declaration, cell.slug, true, [entry]);
    const { slug: identity } = entry;
    if (!this.runtimeEntries.some(row => { const { slug: registeredIdentity } = row; return registeredIdentity === identity && row.entry === entry.entry; })) this.runtimeEntries.push(entry);
    const saved = new GridRegionDurability(this.page.saves, { id: cell.instance, shard: cell.slug }, retained.admitted.source, this.page.catalogue);
    this.durability.set(cell.instance, saved);
    let closed = false;
    const release = (): void => { if (closed) return; closed = true; this.durability.delete(cell.instance); retained.release(); };
    return { bytes, exclusiveRuntime: true, reloadsCheckpoint: true, cancel: release, prepareRuntime: async () => { await prepareTrustedRuntime(declaration, cell.slug, true, [entry]); }, create: async (_prior, claim) => {
      const factory = createRegionalRuntimeFactory({ home: this.ports.home.origin,
        continuation: regionalRuntimeCheckpoint(this.page.saves, { id: cell.instance, shard: cell.slug }, retained.admitted.source.identity.revision),
        prepareFoundation: createRegionalWorldFoundation({ rapier: this.ports.physics.R, navmesh: level => loadNavmesh(level.id), pause: () => yieldGridAdmission(this.runtimeScope),
          install: host => {
            for (const strip of this.ports.strips) for (const row of strip.duplicates) if (row.instance === cell.instance) installStripCollider(host.physics, row.mesh, host.scope);
            installEntrySockets(host.physics, host.scope, [{ x: 0, z: 0 }], 'backstop');
            installGridBorders(host.physics, host.scope);
            this.transferWalls.set(cell.instance, regionTransferWalls(host, this.page.traveller.motor.opts.radius));
            saved.bind(host);
          }, checkpoint: () => saved.flush(),
        }),
      });
      let prepared: PreparedRegionalRuntime;
      try { prepared = await factory({ cell, admitted: retained.admitted, manifest, page, allocator: this.ports.allocator, claim, scope: this.runtimeScope }); }
      catch (error) { this.transferWalls.delete(cell.instance); saved.unbind(); throw error; }
      this.runtimeRegions.set(cell.instance, prepared); this.runtimeResidents.set(cell.instance, prepared.resident);
      this.respawnCells.set(cell.instance, { instance: cell.instance, origin: cell.origin, entryways: retained.admitted.source.entryways });
      try { await this.hybrid.prepare(cell.instance); }
      catch (error) {
        this.runtimeRegions.delete(cell.instance); this.runtimeResidents.delete(cell.instance); this.transferWalls.delete(cell.instance);
        try { prepared.region.dispose(); } finally { saved.unbind(); }
        throw error;
      }
      let disposalFailure: Error | undefined;
      return { ...prepared.region, checkpoint: () => !this.startedRuntimes.has(cell.instance) ? saved.flush()
        : this.hybrid.state().instance === cell.instance && !this.hybrid.state().ready ? false : prepared.checkpoint(), dispose: () => {
        if (disposalFailure !== undefined) throw disposalFailure;
        try { prepared.region.dispose(); saved.unbind(); }
        catch (error) { disposalFailure = error instanceof Error ? error : new Error(String(error)); throw disposalFailure; }
        this.startedRuntimes.delete(cell.instance);
        this.runtimeRegions.delete(cell.instance); this.runtimeResidents.delete(cell.instance); this.transferWalls.delete(cell.instance);
        release();
      } };
    } };
  }

  /** Admission opens the strip first; hooks freeze gameplay only after the committed traveller reaches the interior. */
  gameplayReady(): boolean {
    const current = this.live.current();
    if (current === null || !this.runtimeRegions.has(current)) return true;
    const feet = this.live.worldFeet();
    if (this.ports.assembly.at(feet.x, feet.z)?.instance !== current) return true;
    const state = this.hybrid.state(); return state.instance === current && state.ready;
  }

  /** Actual regional aim bodies only after entered hooks complete; parked neighbours and the road supply none. */
  aimAnimals(): ReturnType<PreparedRegionalRuntime['aimAnimals']> {
    const state = this.hybrid.state();
    if (!state.ready || state.instance === null || this.live.current() !== state.instance) return [];
    const feet = this.live.worldFeet();
    if (this.ports.assembly.at(feet.x, feet.z)?.instance !== state.instance) return [];
    return this.runtimeRegions.get(state.instance)?.aimAnimals() ?? [];
  }

  /** The fixed-boundary rebind: the page's stepped world, the player's motor and the render origin. */
  private bind(frame: LiveGridFrame): void {
    this.framePhysics = frame.physics;
    const home = frame.instance === this.ports.home.instance && this.page.ownedHome !== true;
    const runtime = frame.instance === null ? undefined : this.runtimeRegions.get(frame.instance);
    const runtimeQueries = runtime === undefined ? undefined : { ...runtime.queries,
      heightAt: (x: number, z: number) => Math.max(Math.abs(x), Math.abs(z)) <= CHUNK_HALF ? runtime.queries.heightAt(x, z) : 0,
      waterSurfaceAt: (x: number, z: number) => Math.max(Math.abs(x), Math.abs(z)) <= CHUNK_HALF ? runtime.queries.waterSurfaceAt(x, z) : null };
    this.page.traveller.bindFrame(frame.physics, frame.motor, home ? null : frame.instance === null ? HIGHWAY_QUERIES : runtimeQueries ?? this.regions.get(frame.instance)?.queries ?? HIGHWAY_QUERIES);
    this.page.setPhysics(frame.physics);
    this.offset.set(frame.origin.x - this.ports.home.origin.x, 0, frame.origin.z - this.ports.home.origin.z);
    if (this.homeSim?.disposed() === true) this.homeSim = null;
    this.homeSim?.setActive(home);
  }

  /**
   * Where fall recovery and respawn put the traveller when it is not in the home frame (null: the home's own spawn): an
   * admitted region's authored start, or on the highway the deck under the feet (road level). A fall that began from the
   * road (G101: no ground inside a cell since) recovers on the road, in the active frame's coordinates, whatever the frame.
   */
  spawn(): LiveGridSpawn | null {
    const road = this.road.target();
    if (road !== null) {
      const x = this.ports.home.origin.x + this.offset.x, z = this.ports.home.origin.z + this.offset.z; // the active frame's origin
      return { x: road.x - x, y: 0.5, z: road.z - z, yaw: road.yaw };
    }
    const current = this.live.current();
    if (current === this.ports.home.instance && this.page.ownedHome !== true) return null;
    const p = this.page.traveller.position;
    if (current === null) return { x: p.x, y: 0.5, z: p.z, yaw: this.page.traveller.yaw };
    const runtime = this.runtimeRegions.get(current);
    if (runtime !== undefined) { const start = runtime.region.host.level.player; return { x: start.at.x, y: start.at.y, z: start.at.z, yaw: start.yaw }; }
    return this.regions.get(current)?.spawn ?? { x: 0, y: undefined, z: 0, yaw: 0 };
  }
  /** The geometric region's kill floor, independent of the 6/10 m motor-frame hysteresis. */
  fallFloor(): number {
    const feet = this.worldFeet(), cell = this.ports.assembly.at(feet.x, feet.z);
    if (cell === undefined) return -60;
    const declared = cell.instance === this.ports.home.instance ? this.page.homeFallFloor : findShard(cell.slug)?.bounds?.floor;
    return Math.max(-CHUNK_HALF, declared ?? -CHUNK_HALF);
  }

  /** Named home checkpoints apply only after its genuine entry, never while road recovery owns the fall. */
  ownsHomeRecovery(): boolean {
    const feet = this.worldFeet();
    return this.road.target() === null && this.live.current() === this.ports.home.instance
      && this.ports.assembly.at(feet.x, feet.z)?.instance === this.ports.home.instance;
  }

  /** The active frame's identity (the home instance, a region, or null for the highway). */
  frame(): string | null { return this.live.current(); }

  /** The admitted native simulation for a browser witness; the page exposes this only when harness pins exist. */
  simulation(instance: string): ShardfileSimulation | undefined { return this.regions.get(instance)?.simulation; }

  state(): LiveGridSessionState {
    const cap = this.page.traveller.hoverSpeedLimit?.();
    return { live: this.live.state(), crossing: this.crossing.crossing.state(), stowed: this.page.equipment.stowed, renderOrigin: { x: this.offset.x, z: this.offset.z }, runtimeTiming: this.hybrid.timings(),
      hoverCap: cap === undefined ? null : Math.round(cap * 100) / 100, homeActive: this.homeSim === null ? null : this.live.current() === this.ports.home.instance };
  }
}
