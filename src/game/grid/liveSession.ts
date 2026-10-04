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
 *   its weapon; a template cell's weapon is its empty equipment (hands). Off the active home frame the page's combat
 *   pipeline admits no damage to or from the traveller (no enemies on the deck, the strips or a frame the home's
 *   creatures can't see).
 * - **which cells are enterable**: shardfile shards (the template copies), each admitted as `createShardfileSim` in its
 *   own bodyless regional host with its strip duplicates; the rest refuse admission and stay far proxies behind closed
 *   walls until M3.
 */
import { Vector3, type PerspectiveCamera } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import type { Events } from '@wildshard/engine/events/events';
import type { Physics } from '@wildshard/engine/physics/Physics';
import type { CharacterMotor } from '@wildshard/engine/physics/CharacterMotor';
import type { PlayerHealth } from '@wildshard/engine/combat/health';
import type { EquipmentService } from '@wildshard/engine/combat/EquipmentService';
import { createSimHost, SIM_API_VERSION, type SimLevel } from '@wildshard/engine/sim';
import { restoreSimHost, type SimSnapshot } from '@wildshard/engine/sim/snapshot';
import { installStripCollider } from '@wildshard/engine/physics/stripColliders';
import { ReadinessWalls, type ReadinessEdge } from '@wildshard/engine/physics/readinessWalls';
import type { ReadinessBundle, ReadinessLink } from '@wildshard/engine/sim/readiness';
import type { GeneratedStrip } from '@wildshard/engine/sim/strips';
import type { GridAssembly, GridCell } from './assembly';
import type { ResidencyAllocator } from './allocator';
import { LiveGridHost, type LiveGridAdmission, type LiveGridFrame, type LiveGridState } from './live';
import { installGridCrossing, type GridCrossingSession, type GridCrossingState } from './crossing';
import type { GridLoadout } from './wallet';
import { findShard } from '../shard/registry';
import { admitProduct, boundedResponse, type AdmittedProduct } from '../shardfile/product';
import { browserShardfileOptions } from '../shardfile/loader';
import { bindShardfileSim, createShardfileSim, type ShardfileSimulation } from '../shardfile/simulation';

/** The page traveller the live host rebinds (the existing Player; never a second capsule). */
export interface LiveTraveller {
  readonly position: Vector3; readonly yaw: number; readonly motor: CharacterMotor; readonly camera: PerspectiveCamera;
  bindFrame: (physics: Physics, motor: CharacterMotor) => void;
}
/** What the live wiring reads from the page once the player's health and equipment exist. */
export interface LiveGridPage {
  readonly traveller: LiveTraveller;
  readonly health: PlayerHealth;
  readonly equipment: EquipmentService;
  readonly events: Events;
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
  readonly assembly: GridAssembly; readonly home: GridCell; readonly physics: Physics; readonly scope: Scope;
  readonly walls: ReadinessWalls; readonly strips: readonly GeneratedStrip[]; readonly allocator: ResidencyAllocator;
  readonly neighbourEdges: (cell: GridCell, origin: Readonly<{ x: number; z: number }>) => ReadinessEdge[];
  readonly rimEdges: (origin: Readonly<{ x: number; z: number }>) => ReadinessEdge[];
}
/** The readout: the live host's crossing telemetry, the crossing coordinator and the safe-zone state. */
export interface LiveGridSessionState { readonly live: LiveGridState; readonly crossing: GridCrossingState; readonly stowed: boolean; readonly renderOrigin: { x: number; z: number } }

/** The platform travel envelope at the deck's 30 m/s; a shardfile's critical bundle is its declared compressed sim. */
const LINK: ReadinessLink = { speed: 30, linkBitsPerSecond: 5_000_000, requestLatencySeconds: 0.25, maxStallSeconds: 10 };
const PLATFORM_LEVEL: SimLevel = { version: SIM_API_VERSION, id: 'platform.highway', seed: 1, ground: { size: 2000, height: 0 }, player: { at: { x: 0, y: 0, z: 0 }, yaw: 0, speed: 30 }, entities: [], quests: [],
  weapon: { id: 'platform.hands', shape: { kind: 'point', radius: 0 }, windup: 0, active: 0, recover: 0, cooldown: 0, range: 0, damage: 0, tags: [] } };

/** One admitted first-party shardfile product per slug (the six template copies share their immutable bytes). */
const products = new Map<string, Promise<AdmittedProduct>>();
function shardfileProduct(slug: string): Promise<AdmittedProduct> | null {
  const descriptor = findShard(slug)?.shardfile;
  if (descriptor === undefined) return null;
  let product = products.get(slug);
  if (product === undefined) {
    const url = new URL(descriptor, location.href);
    product = (async () => {
      const input: unknown = JSON.parse(new TextDecoder().decode(await boundedResponse(await fetch(url.href), 4_000_000)));
      return admitProduct(input, browserShardfileOptions(new URL('.', url).href, true));
    })();
    product.catch(() => { products.delete(slug); });
    products.set(slug, product);
  }
  return product;
}

/** The home cell's G68 loadout: stow silently to hands at the border, restore the shard's weapon on re-entry. */
function homeLoadout(equipment: EquipmentService, scope: Scope): GridLoadout {
  let before: { stowed: boolean; tools: readonly { tool: EquipmentService['tools'][number]; enabled: boolean }[] } | undefined;
  return {
    checkpoint: () => true, // the borrowed home keeps its own save owner
    stow: () => {
      if (scope.disposed || before !== undefined) return;
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
/** A template cell's loadout is its empty equipment: the traveller stays on bare hands inside it. */
const HANDS: GridLoadout = { checkpoint: () => true, stow: () => undefined, interior: () => undefined };

/** The live crossing for one grid page; disposed with the level scope. */
export class LiveGridSession {
  readonly live: LiveGridHost;
  private readonly crossing: GridCrossingSession;
  private readonly ports: LiveGridSessionPorts;
  private readonly page: LiveGridPage;
  private readonly snapshots = new Map<string, SimSnapshot>();
  private readonly offset = new Vector3();
  private readonly applied = new Vector3();
  private readonly loadout: GridLoadout;

  constructor(ports: LiveGridSessionPorts, page: LiveGridPage) {
    this.ports = ports; this.page = page;
    const { assembly, home, scope } = ports, rapier = ports.physics.R;
    const traveller = page.traveller;
    const player = { get position() { return traveller.position; }, get yaw() { return traveller.yaw; }, health: page.health, owner: traveller, motor: traveller.motor };
    const highwayBytes = ports.strips.reduce((sum, strip) => sum + strip.mesh.positions.byteLength + strip.mesh.indices.byteLength, 0);
    this.live = new LiveGridHost(assembly, {
      home: { instance: home.instance, physics: ports.physics, bytes: 1, checkpoint: () => true, walls: ports.walls }, // the home world is the page's engine base (§3.2)
      player, allocator: ports.allocator,
      highway: { bytes: highwayBytes, create: () => {
        const host = createSimHost(PLATFORM_LEVEL, { rapier, playerBody: false, ground: false });
        for (const strip of ports.strips) installStripCollider(host.physics, strip.mesh, host.scope);
        const origin = { x: 0, z: 0 };
        const walls = new ReadinessWalls(host.physics, [...assembly.cells.flatMap((cell) => ports.neighbourEdges(cell, origin)), ...ports.rimEdges(origin)], host.scope);
        return { host, walls, dispose: () => { host.dispose(); } };
      } },
      admit: (cell) => this.admit(cell),
      save: (instance, snapshot) => { this.snapshots.set(instance, snapshot); return true; },
      read: (instance) => this.snapshots.get(instance),
      bindFrame: (frame) => { this.bind(frame); },
      gameplayReady: () => true, // a template copy has no entered hooks; Driftwood's hybrid stays default-off (its fence is SF46's)
      readiness: { link: LINK, bundle: (cell) => this.bundle(cell) },
    });
    scope.onDispose(() => { this.live.dispose(); });
    this.loadout = homeLoadout(page.equipment, scope);
    this.crossing = installGridCrossing({
      current: () => this.live.current(), prepare: (from, to) => this.live.prepare(from, to), ready: (instance) => this.live.ready(instance),
      checkpoint: (instance) => this.live.checkpoint(instance), target: (feet) => this.live.target(feet),
    }, assembly, (instance) => (instance === home.instance ? this.loadout : HANDS), scope);
    // G68: off the home frame (the deck, the strips, another cell) the page pipeline admits no damage to or from the traveller
    page.events.answer('damage.admit', (request) => {
      if (request === null || this.live.current() === home.instance) return request;
      return request.target === page.health || request.source === page.health ? null : request;
    }, scope);
    page.onFixedPre(() => { if (scope.disposed) return; this.live.beforeFixed(); this.crossing.step(this.live.worldFeet()); });
    page.onFixedPost(() => { if (!scope.disposed) this.live.afterPlayerStep(); });
    page.onInput(() => { traveller.camera.position.sub(this.applied); this.applied.set(0, 0, 0); });
    page.onUpdate(() => { if (this.offset.lengthSq() === 0) return; traveller.camera.position.add(this.offset); this.applied.copy(this.offset); });
    scope.onDispose(() => { traveller.camera.position.sub(this.applied); this.applied.set(0, 0, 0); });
  }

  /** The traveller's world feet (grid metres), whatever frame it is in. */
  worldFeet(): { x: number; y: number; z: number } { return this.live.worldFeet(); }

  private bundle(cell: GridCell): ReadinessBundle {
    return { criticalWireBytes: findShard(cell.slug)?.shardfile === undefined ? 0 : 2_000_000, hybridWireBytes: 0, decodeSeconds: 1, runtimeParseSeconds: 0 };
  }

  /** Shardfile cells admit a bodyless regional host with their strip duplicates; every other cell waits for M3. */
  private async admit(cell: GridCell): Promise<LiveGridAdmission> {
    const pending = shardfileProduct(cell.slug);
    if (pending === null) throw new Error(`${cell.slug} is not a shardfile shard (it stays a far proxy until M3)`);
    const { source, assets } = await pending;
    if (source.runtime !== null) throw new Error(`${cell.slug} declares a hybrid runtime (M3)`);
    const rapier = this.ports.physics.R, duplicates = this.ports.strips.flatMap((strip) => strip.duplicates.filter((row) => row.instance === cell.instance).map((row) => row.mesh));
    return { bytes: source.budgets.sim.resident, create: (saved) => {
      let sim: ShardfileSimulation = createShardfileSim(source, assets, { rapier, playerBody: false });
      if (saved !== undefined) {
        const authored = sim.host.level; sim.dispose();
        const host = restoreSimHost(authored, { rapier }, saved, (restored) => { sim = bindShardfileSim(restored, source, assets, { rapier, restoring: true }); });
        host.detachPlayerMotor(); // the restored world carries its strip duplicates already
      } else for (const mesh of duplicates) installStripCollider(sim.host.physics, mesh, sim.host.scope);
      const region = sim;
      return Promise.resolve({ host: region.host, dispose: () => { region.dispose(); } });
    } };
  }

  /** The fixed-boundary rebind: the page's stepped world, the player's motor and the render origin. */
  private bind(frame: LiveGridFrame): void {
    this.page.traveller.bindFrame(frame.physics, frame.motor);
    this.page.setPhysics(frame.physics);
    this.offset.set(frame.origin.x - this.ports.home.origin.x, 0, frame.origin.z - this.ports.home.origin.z);
  }

  state(): LiveGridSessionState {
    return { live: this.live.state(), crossing: this.crossing.crossing.state(), stowed: this.page.equipment.stowed, renderOrigin: { x: this.offset.x, z: this.offset.z } };
  }
}
