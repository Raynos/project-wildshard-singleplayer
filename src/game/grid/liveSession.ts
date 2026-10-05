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
import type { GeneratedStrip } from '@wildshard/engine/sim/strips';
import type { GridAssembly, GridCell } from './assembly';
import type { ResidencyAllocator } from './allocator';
import type { HomeResidencyClaim } from './pageResidency';
import { LiveGridHost, type LiveGridAdmission, type LiveGridFrame, type LiveGridState } from './live';
import { installGridCrossing, type GridCheckpointResult, type GridCrossingSession, type GridCrossingState } from './crossing';
import { stowGridMount, type GridLoadout } from './wallet';
import { GridRegionDurability } from './durability';
import type { LedgerCatalogueItem } from '../ledger';
import { installGridHoverSpeed, installGridTravellerCombat } from './rules';
import { gridHomeSim, type GridHomeSimulation } from './boot';
import { findShard } from '../shard/registry';
import { gridShardfileProduct } from './products';
import { RoadRecovery, type RoadRecoveryCell } from './roadRecovery';
import { GridCellWaitingError } from './refusal';
import { scriptDisabledNotice, type ScriptNoticePorts } from '../shardfile/scriptNotice';
import { bindShardfileSim, createShardfileSim, type ShardfileSimulation } from '../shardfile/simulation';

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
  readonly residency?: HomeResidencyClaim;
  readonly assembly: GridAssembly; readonly home: GridCell; readonly physics: Physics; readonly scope: Scope;
  readonly walls: ReadinessWalls; readonly strips: readonly GeneratedStrip[]; readonly allocator: ResidencyAllocator;
  readonly neighbourEdges: (cell: GridCell, origin: Readonly<{ x: number; z: number }>) => ReadinessEdge[];
  readonly rimEdges: (origin: Readonly<{ x: number; z: number }>) => ReadinessEdge[];
}
/** The readout: the live host's crossing telemetry, the crossing coordinator and the safe-zone state. */
export interface LiveGridSessionState {
  readonly live: LiveGridState; readonly crossing: GridCrossingState; readonly stowed: boolean; readonly renderOrigin: { x: number; z: number };
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
  /** each admitted region's authored spawn (its level's player start) and its ground / water queries, local */
  private readonly regions = new Map<string, { readonly spawn: LiveGridSpawn; readonly queries: PlayerFrameQueries; readonly simulation: ShardfileSimulation }>();
  private homeSim: GridHomeSimulation | null = null;
  /** G101: the last road point, where a fall that began from the road recovers */
  private readonly road: RoadRecovery;
  private readonly respawnCells = new Map<string, RoadRecoveryCell>();

  constructor(ports: LiveGridSessionPorts, page: LiveGridPage) {
    this.ports = ports; this.page = page;
    this.framePhysics = ports.physics;
    const { assembly, home, scope } = ports, rapier = ports.physics.R;
    const traveller = page.traveller;
    const transferScope = scope.child('grid.transfer.home');
    const transferLease = ports.allocator.reserve({ id: `sim-transfer:${home.instance}`, category: 'sim', owner: home.instance,
      bytes: TRANSFER_WALL_BYTES, distance: 0, needed: true });
    if (transferLease === null) { transferScope.dispose(); throw new Error('Home transfer fence exceeds residency budget'); }
    transferScope.onDispose(() => { transferLease.release(); });
    try { this.transferWalls.set(home.instance, new TransferWalls(() => ports.physics, [{ x: 0, z: 0 }], traveller.motor.opts.radius, 'exit', transferScope)); }
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
      + assembly.cells.length * TRANSFER_WALL_BYTES;
    try { this.live = new LiveGridHost(assembly, {
      continuations: 'durable', // Every owned production region below reconstructs its basis and reloads its durable save.
      home: { instance: home.instance, physics: ports.physics, bytes: ports.residency?.bytes ?? 1, ...(ports.residency === undefined ? {} : { residency: ports.residency }), checkpoint: () => this.checkpointHome(), walls: ports.walls },
      player, allocator: ports.allocator,
      highway: { bytes: highwayBytes, create: () => {
        const host = createSimHost(PLATFORM_LEVEL, { rapier, playerBody: false, ground: false });
        try {
          for (const strip of ports.strips) installStripCollider(host.physics, strip.mesh, host.scope);
          const origin = { x: 0, z: 0 };
          const walls = new ReadinessWalls(host.physics, [...assembly.cells.flatMap((cell) => ports.neighbourEdges(cell, origin)), ...ports.rimEdges(origin)], host.scope);
          this.transferWalls.set(null, new TransferWalls(() => host.physics, assembly.cells.map(cell => cell.origin), traveller.motor.opts.radius, 'entry', host.scope));
          return { host, walls, dispose: () => { host.dispose(); } };
        } catch (error) { host.dispose(); throw error; }
      } },
      admit: (cell) => this.admit(cell),
      save: (instance, snapshot) => this.regionSave(instance).checkpoint(snapshot),
      bindFrame: (frame) => { this.bind(frame); },
      gameplayReady: () => true, // a template copy has no entered hooks; Driftwood's hybrid stays default-off (its fence is SF46's)
      readiness: { link: LINK, bundle: (cell) => this.bundle(cell) },
    }); } catch (error) { transferScope.dispose(); throw error; }
    scope.onDispose(() => { this.live.dispose(); });
    this.loadout = homeLoadout(page.equipment, scope, page.checkpoint, () => { stowGridMount(traveller); });
    this.crossing = this.installCrossing();
    installGridTravellerCombat(page.events, scope, page.health, home.instance, () => {
      const feet = this.live.worldFeet();
      return assembly.at(feet.x, feet.z)?.instance ?? null;
    });
    // SF20d: 30 m/s on the deck, easing to the shard's 14 over the strip (the cell nearest the feet; the outer ring is deck too)
    installGridHoverSpeed(traveller, scope, () => {
      const feet = this.live.worldFeet(), p = assembly.pitch;
      const local = { x: feet.x - Math.round(feet.x / p) * p, y: feet.y, z: feet.z - Math.round(feet.z / p) * p };
      return { local, shardCap: 14, onHighwayDeck: feet.y < 4 };
    });
    // the freeze fence: the home client's existing driver runs only while the traveller is in the home frame (sp-x5's handoff)
    scope.onDispose(gridHomeSim.take((sim) => {
      if (ports.residency !== undefined && sim.residency !== ports.residency) throw new Error('Home simulation handoff must retain its admitted page claim');
      this.homeSim = sim; sim.setActive(this.live.current() === home.instance);
    }));
    scope.onDispose(() => { this.homeSim?.setActive(true); this.homeSim = null; });
    page.onFixedPre(() => {
      if (scope.disposed) return;
      this.live.beforeFixed(); this.crossing.step(this.live.worldFeet());
      const walls = this.transferWalls.get(this.live.current());
      if (walls === undefined) throw new Error('Active transfer fence is missing');
      walls.sync();
    });
    let saveTicks = 0;
    page.onFixedPost(() => {
      if (scope.disposed) return;
      this.live.afterPlayerStep();
      const feet = this.live.worldFeet();
      const cell = assembly.at(feet.x, feet.z);
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
    return installGridCrossing({ current: () => this.live.current(), prepare: (from, to) => this.live.prepare(from, to),
      ready: (instance) => this.live.ready(instance), checkpoint: (instance) => {
        const readiness = this.page.crossingSaveReady?.(instance) ?? true;
        return readiness === true ? this.live.checkpoint(instance) : readiness;
      }, target: (feet) => this.live.target(feet) },
    this.ports.assembly, (instance) => instance === this.ports.home.instance ? this.loadout : {
      checkpoint: () => this.regionSave(instance).flush(), stow: () => { stowGridMount(this.page.traveller); }, interior: () => undefined,
    }, this.ports.scope);
  }

  private checkpointHome(): boolean {
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
    const current = this.live.current();
    return current === null ? this.checkpointHome() : this.live.checkpoint(current);
  }

  /** The traveller's world feet (grid metres), whatever frame it is in. */
  worldFeet(): { x: number; y: number; z: number } { return this.live.worldFeet(); }
  /** Retry a refused source save without reloading the prepared destination; retreat also cancels the hold safely. */
  retrySave(): void { this.crossing.crossing.retrySave(); }
  /** Original latest admission failure for classified UI; retry clears it before another generation begins. */
  refusal(instance: string): unknown { return this.live.refusal(instance); }

  private bundle(cell: GridCell): ReadinessBundle {
    return { criticalWireBytes: findShard(cell.slug)?.shardfile === undefined ? 0 : 2_000_000, hybridWireBytes: 0, decodeSeconds: 1, runtimeParseSeconds: 0 };
  }

  /** Shardfile cells admit a bodyless regional host with their strip duplicates; every other cell waits for M3. */
  private async admit(cell: GridCell): Promise<LiveGridAdmission> {
    const pending = gridShardfileProduct(cell.slug, { allocator: this.ports.allocator, scope: this.ports.scope });
    if (pending === null) throw new GridCellWaitingError(`${cell.slug} is not a shardfile shard (it stays a far proxy until M3)`);
    const retained = await pending, { source, assets } = retained.admitted;
    let releaseProduct = retained.release;
    try {
    if (source.runtime !== null) throw new GridCellWaitingError(`${cell.slug} declares a hybrid runtime (M3)`);
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
    const generatedGroundBytes = source.terrain === null ? 2 * groundResolution ** 2 * Float32Array.BYTES_PER_ELEMENT : 0;
    const rapier = this.ports.physics.R, duplicates = this.ports.strips.flatMap((strip) => strip.duplicates.filter((row) => row.instance === cell.instance).map((row) => row.mesh));
    const notices = this.page.scriptNotices;
    const scriptPorts = notices === undefined ? {} : { scriptDisabled: scriptDisabledNotice(notices) };
    // Four native creature-only walls and their shape/query adapters belong to this regional claim.
    return { bytes: source.budgets.sim.resident + generatedGroundBytes + 4096 + TRANSFER_WALL_BYTES, reloadsCheckpoint: true, cancel: releaseProduct, create: (saved) => {
      let sim: ShardfileSimulation = createShardfileSim(source, assets, { rapier, playerBody: false, quest, groundResolution, ...scriptPorts });
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
            sim = bindShardfileSim(restored, source, assets, { rapier, restoring: true, quest, ...scriptPorts }); savedRegion.bind(restored, sim.colliders);
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

  /** The fixed-boundary rebind: the page's stepped world, the player's motor and the render origin. */
  private bind(frame: LiveGridFrame): void {
    this.framePhysics = frame.physics;
    const home = frame.instance === this.ports.home.instance;
    this.page.traveller.bindFrame(frame.physics, frame.motor, home ? null : frame.instance === null ? HIGHWAY_QUERIES : this.regions.get(frame.instance)?.queries ?? HIGHWAY_QUERIES);
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
    if (current === this.ports.home.instance) return null;
    const p = this.page.traveller.position;
    if (current === null) return { x: p.x, y: 0.5, z: p.z, yaw: this.page.traveller.yaw };
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
    return { live: this.live.state(), crossing: this.crossing.crossing.state(), stowed: this.page.equipment.stowed, renderOrigin: { x: this.offset.x, z: this.offset.z },
      hoverCap: cap === undefined ? null : Math.round(cap * 100) / 100, homeActive: this.homeSim === null ? null : this.live.current() === this.ports.home.instance };
  }
}
