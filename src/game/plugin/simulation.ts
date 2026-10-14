import { installQuestGraph, type QuestGraphPorts } from './quests';
import { parseQuestHost, type QuestHostRow } from '@wildshard/format/questHost';
import type { QuestData } from '@wildshard/format/quests';
import { compileDirectorWhen, evaluateDirectorWhen } from '@wildshard/format/directorWhen';
import { ContactFamily, type ContactFamilyPorts, type ContactScanTarget } from '@wildshard/engine/combat/contactWeapon';
import { parseItems, parseMeleeContacts, parseNativeMeleeBinding } from '@wildshard/format/items';
import { scriptItemHook } from '@wildshard/engine/combat/items';
import { Vector3 } from 'three';
import { createHeadlessPromptPicker } from '../quest/interactionRows';
import { GridAssembly } from '../grid/assembly';
import { GridSimulation } from '../grid/simulation';
import { ResidencyAllocator } from '../grid/allocator';
import { CONTENT_CAPS } from '@wildshard/engine/core/config';
import { restoreSimHost, snapshotSimHost, regionalContinuation, type SimSnapshot } from '@wildshard/engine/sim/snapshot';
import { SaveStore } from '@wildshard/engine/saves/store';
import { Ledger } from '../ledger';
import { CharacterMotor } from '@wildshard/engine/physics/CharacterMotor';
import { tagOf, type Material } from '@wildshard/engine/physics/surface';
import { parseSocketLift, type SocketLift } from '@wildshard/format/socketLift';
import { walkEdgeEntries } from '@wildshard/engine/physics/edgeEntries';
import { provePortalLinks } from '../shardfile/portalLinkProof';
import { DirectorStageLane, bindDirectorActions, type DirectorActionBinding } from './director';
import { directorDayRange, directorDataHostIssues } from '@wildshard/format/directorStages';
import { DEFAULT_NORMALIZED_DAY, normalizedDayClock, inNormalizedDayRange, type DayCycle } from '@wildshard/engine/world/dayCycle';
import { createSimHost, SIM_API_VERSION, type SimHost, type SimCommand, type SimHostPorts, type SimLevel, type SimStrike, type SimValue } from "@wildshard/engine/sim";
import { buildPlatformSpawns } from "@wildshard/engine/ai/platform";
import { addBakedTerrainCollider } from "@wildshard/engine/physics/terrainTiles";
import { decodeTerrainTile, terrainTileHeight } from "@wildshard/format/terrainTileBytes";
import { fnv1a32 } from "@wildshard/engine/core/rng";
import { installScriptLane, ScriptDriver, type ScriptLanePort } from "@wildshard/engine/script/lane";
import type { EffectRules, ScriptEntity } from "@wildshard/engine/script/effects";
import { declaredWaterBody } from "@wildshard/engine/world/water/declared";
import { WaterBodies } from "@wildshard/engine/world/water/body";
import type { PropColliderPort, PropColliderState } from "@wildshard/engine/physics/declaredProps";
import { floorBelow, canStandAt } from "@wildshard/engine/physics/query";
import { installShardfileColliders, shardfileColliderIds } from "../shardfile/collisionBindings";
import { validateMeshCollisionAssets } from "@wildshard/format/meshCollisionAssets";
import { validateMeshEntryways } from "@wildshard/format/meshEntryways";
import { clientGround } from "../shardfile/clientGround";
import { declaredItemScriptEntities, type DeclaredItemPorts } from "../shardfile/items";
import { syncTargetColliders } from "../shardfile/targets";
import { scriptPhysicsQueries } from "@wildshard/engine/script/queries";
import { createQuestScriptPorts, DeclaredQuests, type QuestDataPorts, type QuestScriptBindings } from "../quest/declared";
import { installDeclaredEncounters } from "../shard/declaredEncounters";
import type { Shardfile } from "@wildshard/format/shardSchema";
import { speciesResolver, simStrikes } from "./brain";
import { createShardfileScriptLane, prepareShardfileScriptOptions, verifiedScriptModules, type ScriptModuleAssets, type ShardScriptPorts } from "../shardfile/scripts";
import { installDeclaredBrains, type DeclaredBrainPorts } from "../shardfile/brainRuntime";
import { createShardfileComposedLane, type DeclaredScriptBrainPorts } from "../shardfile/scriptComposition";
import { dataCreaturePorts } from "../shardfile/dataCreaturePorts";
import { prepareDeclaredGroupBrains, type DeclaredGroupPorts, type DeclaredGroupPolicy } from "../shardfile/groupRuntime";
import { prepareDeclaredCrowds, type DeclaredCrowdPorts, type PreparedCrowds } from "../shardfile/crowdRuntime";
import { installLadders, type LadderClientPorts } from '../shardfile/ladder';
import type { LiftApproachSource } from '@wildshard/format/liftApproach';
import { MoverScriptDriver, type MoverRuntime } from "./mover";
import { socketLiftEntries, socketLiftRules, type SocketLiftEntry } from "@wildshard/format/socketLiftAssets";
import { portalLinkEntries, portalLinkRules } from "@wildshard/format/portalLinkAssets";
import { validatePortalFloors } from "@wildshard/format/portalFloor";
import { portalTransitioning } from "../shardfile/portalTraversal";
import { captureLiftRider, restoreLiftRider } from "../shardfile/liftRider";
import { LiftRiderSchema, type LiftRider } from "@wildshard/format/liftRider";
import * as v from "valibot";
import { installEntrySockets } from "@wildshard/engine/physics/entrySockets";
import { addPiece, type AddedPiece } from "@wildshard/engine/physics/pieces";

type Physics = SimHost['physics'];

/** The most collider pieces one node bake may register. */
const MAX_BAKED_PIECES = 1024;
const BAKED_SURFACES = ['wood', 'metal', 'flesh', 'felt', 'stone', 'rock', 'sand', 'grass'] as const satisfies readonly Material[];
const bakedNumber = v.pipe(v.number(), v.finite());
const bakedPlaced = { x: bakedNumber, y: bakedNumber, z: bakedNumber, yaw: v.exactOptional(bakedNumber),
  rot: v.exactOptional(v.strictObject({ x: bakedNumber, y: bakedNumber, z: bakedNumber, w: bakedNumber })), surface: v.exactOptional(v.picklist(BAKED_SURFACES)) };
const BakedPieces = v.pipe(v.array(v.object({ id: v.string(), name: v.string(), file: v.string(), active: v.boolean(),
  category: v.exactOptional(v.picklist(['buildings', 'nature', 'props', 'ground'])), mode: v.exactOptional(v.literal('board')),
  surface: v.picklist(BAKED_SURFACES), owner: v.exactOptional(v.string()), colliders: v.array(v.union([
    v.strictObject({ kind: v.literal('box'), ...bakedPlaced, hx: bakedNumber, hy: bakedNumber, hz: bakedNumber }),
    v.strictObject({ kind: v.literal('hull'), ...bakedPlaced, points: v.array(bakedNumber) })])) })), v.maxLength(MAX_BAKED_PIECES));

/**
 * Register a Node bake's collider pieces (a `physics.baked.json`'s `pieces`, strictly parsed) with a native host's physics
 * in their baked order: every active piece, and the board-only ones (`mode: 'board'`), whose colliders return for
 * `SimHost.boardColliders`. A piece's colliders belong to its `owner`, else to the piece.
 */
export function addBakedPieces(physics: Physics, pieces: unknown): AddedPiece['colliders'] {
  const rows = v.parse(BakedPieces, pieces), board: AddedPiece['colliders'] = [];
  for (let i = 0; i < MAX_BAKED_PIECES; i++) {
    const piece = rows[i]; if (piece === undefined) break;
    if (!piece.active && piece.mode !== 'board') continue;
    const added = addPiece(physics, { id: piece.id, name: piece.name, category: piece.category ?? 'props', file: piece.file, surface: piece.surface,
      colliderOwner: piece.owner ?? piece.id, colliders: piece.colliders.map(c => c.kind === 'box' ? c : { ...c, points: new Float32Array(c.points) }) });
    if (piece.mode === 'board') board.push(...added.colliders);
  }
  return board;
}

/** The host's player strike where declared items own every damaging contact: a zero-damage probe. */
export const HOST_PROBE: Readonly<SimStrike> = { id: 'host.probe', shape: { kind: 'point', radius: 1 }, windup: 0.1, active: 0.1, recover: 0.2, cooldown: 0.3, range: 1, damage: 0, tags: [] };
/**
 * A trusted runtime's native level (SF72): the shard's identity, the player at the runtime's own stand and speed (capped
 * by the shard's author speed), no declared entities or quests (the runtime installs its own owners), and `HOST_PROBE`.
 */
export function trustedLevel(shard: Pick<Shardfile, 'identity' | 'authorCaps'>, player: SimLevel['player'], ground: SimLevel['ground']): SimLevel {
  return { version: SIM_API_VERSION, id: shard.identity.slug, seed: shard.identity.seed, ground,
    player: { at: player.at, yaw: player.yaw, speed: Math.min(player.speed, shard.authorCaps.speed) }, entities: [], quests: [], weapon: HOST_PROBE };
}
/** The shard's admitted terrain collider and its height query; a shard that declares none, or whose bytes are absent, refuses. */
export function admittedTerrain(shard: Pick<Shardfile, 'terrain'>, assets: ReadonlyMap<string, Uint8Array>): { readonly bytes: Uint8Array; readonly heightAt: (x: number, z: number) => number } {
  const bytes = shard.terrain === null ? undefined : assets.get(shard.terrain.collider);
  if (bytes === undefined) throw new Error('Missing admitted terrain collider');
  const terrain = decodeTerrainTile(bytes);
  return { bytes, heightAt: (x, z) => terrainTileHeight(terrain, x, z) };
}
/**
 * Register a Node-baked world into a fresh trusted host (a restore brings it back with the physics): the admitted terrain
 * collider when given, then the baked pieces (`addBakedPieces`), whose board-only colliders join the host's board mode.
 */
export function addBakedWorld(host: SimHost, pieces: unknown, terrain?: Uint8Array): void {
  if (terrain !== undefined) addBakedTerrainCollider(host.physics, terrain, host.scope);
  const board = addBakedPieces(host.physics, pieces);
  if (board.length > 0) host.boardColliders(board);
}
/** A declared weapon row (`shard.items`) by id; an absent or non-weapon row refuses. */
export function weaponRow(shard: Pick<Shardfile, 'items'>, id: string): Extract<Shardfile['items']['rows'][number], { kind: 'weapon' }> {
  const row = shard.items.rows.find(item => item.id === id);
  if (row?.kind !== 'weapon') throw new Error(`Missing declared weapon ${id}`);
  return row;
}
/** The fact and coin ports every declared owner takes, emitted into a trusted runtime's tick effects. */
export function ledgerPorts(emit: (effect: { kind: 'fact'; name: string; actorId: string } | { kind: 'coins'; amount: number; actorId: string }) => void): {
  readonly fact: (name: string, actorId: string) => void; readonly coins: (amount: number, actorId: string) => void;
} {
  return { fact: (name, actorId) => { emit({ kind: 'fact', name, actorId }); }, coins: (amount, actorId) => { emit({ kind: 'coins', amount, actorId }); } };
}
/** The tick protocol's command allowance (sdk/tickProtocol.ts): one tick never carries more. */
const MAX_TICK_COMMANDS = 1024;
/**
 * One owner's view of a trusted runtime's tick commands: each lent command in tape order through `pick` (undefined skips
 * it) into one reused list, so a step allocates no list; a tick past the protocol's allowance refuses.
 */
export function pickCommands<C, T>(commands: () => readonly C[], pick: (command: C) => T | undefined): () => readonly T[] {
  const out: T[] = [], overflow = new RangeError('Tick commands exceed the protocol allowance');
  return () => {
    out.length = 0;
    const list = commands(); if (list.length > MAX_TICK_COMMANDS) throw overflow;
    for (let i = 0; i < MAX_TICK_COMMANDS; i++) {
      const command = list[i]; if (command === undefined) break;
      const picked = pick(command); if (picked !== undefined) out.push(picked);
    }
    return out;
  };
}

const dayClockContinuation = v.strictObject({
  value: v.number(), paused: v.boolean(), scale: v.number(), cycle: v.number(),
  held: v.nullable(v.strictObject({ value: v.number(), paused: v.boolean() })),
  last: v.picklist(['dawn', 'day', 'golden', 'dusk', 'night']),
});

/** Positive stable actor handle; reordering spawns changes nothing. Hash collisions are refused during composition. */
export function numericScriptEntityId(id: string): number { return (fnv1a32(id) & 0x7fffffff) || 1; }
/** The existing client can lend its physics/player/fixed-step driver; Node owns them by default. */
export interface ShardfileSimPorts extends SimHostPorts {
  weapon?: SimStrike; quest?: QuestDataPorts; hooks?: QuestScriptBindings; scriptRules?: EffectRules;
  encounters?: Parameters<typeof installDeclaredEncounters>[2]; hud?: Parameters<typeof installDeclaredEncounters>[3];
  water?: WaterBodies; colliders?: ReadonlyMap<string, PropColliderPort>;
  /** Trusted native actor recipes; a declaration without its required family port refuses boot. */
  brains?: DeclaredBrainPorts;
  /** Embedded data hosts lend their real player impulse owner; Node uses its owned serialized impulse. */
  creatureImpulse?: (velocity: Vector3) => void;
  /** Trusted perception, prey/taming and body recipes for one controller per ordered pack/herd group. */
  groups?: DeclaredGroupPorts;
  /** Trusted terrain, observation and presentation recipes; every crowd is preflighted before setup. */
  crowds?: (host: SimHost) => DeclaredCrowdPorts;
  /** Trusted custom-policy observations and strike execution; aliases and actors belong to this factory. */
  scriptBrains?: (host: SimHost) => Pick<DeclaredScriptBrainPorts, 'ports'> & Partial<Pick<DeclaredScriptBrainPorts, 'query'>>;
  scriptEntities?: { entities: readonly ScriptEntity[]; actors: ReadonlyMap<number, string> };
  /** Tick-admitted numeric command values; the existing authoritative lane samples them once per fixed step. */
  commands?: () => ReadonlyMap<string, number>;
  query?: Parameters<typeof createShardfileScriptLane>[2]['query']; navigation?: Parameters<typeof scriptPhysicsQueries>[0]['navigation'];
  /** Borrowed client controls and mode registry; owned Node hosts consume admitted movement commands instead. */
  ladders?: LadderClientPorts;
  restoring?: boolean;
  /** The normal client or regional registry already owns its four platform sockets. */
  entrySocketsProvided?: boolean;
  /** Embedded pages lend their actual rendered look clock; the page alone advances it. */
  lookClock?: () => Pick<DayCycle, 'hour' | 'snapshot' | 'restore'>;
  /** G168: a declared module crossed its failure limit and stays off (the client tells the player; Node ignores it). */
  scriptDisabled?: ShardScriptPorts['onDisabled'];
}
/** Authoritative handles for UI, quests and the existing client fixed-step driver. */
export interface ShardfileSimulation {
  /** Actual page-order prompt selected from native eye position, distance and world LOS. */
  selectedInteraction: () => string | null;
  /** Queue the selected authored scene only; absent, farther and occluded prompts refuse. */
  interact: (id: string) => boolean;
  host: SimHost; lane: ScriptLanePort | undefined; actors: ReadonlyMap<string, number>; quest: DeclaredQuests;
  encounters: ReturnType<typeof installDeclaredEncounters>; water: WaterBodies; colliders: ReadonlyMap<string, PropColliderPort>; dispose: () => void;
  groups: ReadonlyMap<string, DeclaredGroupPolicy>;
  crowds: PreparedCrowds['policies'];
  movers: MoverRuntime | undefined;
}
/** One declared simulation core, used by the normal browser loader and the headless author validator. */
export function createShardfileSim(shard: Shardfile, assets: ReadonlyMap<string, Uint8Array>, ports: ShardfileSimPorts): ShardfileSimulation {
  if (shard.nativeGround !== null) throw new Error('Native ground retains its trusted runtime simulation; a flat declared proxy is forbidden');
  const portals = portalLinkEntries(shard.entryways), portalErrors = portalLinkRules(portals, shard);
  if (portalErrors.length > 0) throw new Error(portalErrors.join('; '));
  validatePortalFloors(portals, shard, assets);
  validateMeshCollisionAssets(shard, assets);
  validateMeshEntryways(shard, assets);
  const bytes = shard.terrain === null ? undefined : assets.get(shard.terrain.collider);
  if (shard.terrain !== null && bytes === undefined) throw new Error('Missing admitted terrain collider');
  const terrain = bytes === undefined ? undefined : decodeTerrainTile(bytes);
  const heightAt = shard.meshCollision === null ? terrain === undefined ? () => 0 : (x: number, z: number) => terrainTileHeight(terrain, x, z)
    : clientGround(shard, assets).heightAt;
  const weapon = ports.weapon ?? HOST_PROBE;
  const host = createSimHost({ version: SIM_API_VERSION, id: shard.identity.slug, seed: shard.identity.seed,
    ground: { size: 500, height: 0 }, player: { at: { x: shard.spawn.x, y: shard.spawn.y, z: shard.spawn.z }, yaw: shard.spawn.yaw, speed: Math.min(5, shard.authorCaps.speed) },
    entities: buildPlatformSpawns(shard.creatures.spawns, speciesResolver(shard.rows), simStrikes(shard.rows)), weapon, quests: [],
  }, { ...ports, ground: ports.ground !== false && terrain === undefined && shard.meshCollision === null && shard.entryways.some(entry => (entry.kind ?? 'ground') === 'ground'), heightAt });
  return bindShardfileSim(host, shard, assets, ports);
}
/** Reinstall matching adapters into a fresh standalone restore host; restoring skips collider allocation and stepping. */
export function bindShardfileSim(host: SimHost, shard: Shardfile, assets: ReadonlyMap<string, Uint8Array>, ports: ShardfileSimPorts): ShardfileSimulation {
  if (shard.nativeGround !== null) throw new Error('Native ground retains its trusted runtime simulation; a flat declared proxy is forbidden');
  const levelId = shard.identity.slug;
  if (host.level.id !== levelId || host.level.seed !== shard.identity.seed || host.entities.size !== shard.creatures.spawns.length || shard.creatures.spawns.some((row) => !host.entities.has(row.id))) throw new Error('Shardfile simulation host mismatch');
  try {
    installLadders(host, shard.modes?.traverse.filter(row => row.kind === 'ladder') ?? [], ports.ladders);
    const portals = portalLinkEntries(shard.entryways), portalErrors = portalLinkRules(portals, shard);
    if (portalErrors.length > 0) throw new Error(portalErrors.join('; '));
    validatePortalFloors(portals, shard, assets);
    validateMeshCollisionAssets(shard, assets);
    validateMeshEntryways(shard, assets);
    const bytes = shard.terrain === null ? undefined : assets.get(shard.terrain.collider);
    if (shard.terrain !== null && bytes === undefined) throw new Error('Missing admitted terrain collider');
    const terrain = bytes === undefined ? undefined : decodeTerrainTile(bytes);
    if (terrain !== undefined) host.setHeightQuery((x, z) => terrainTileHeight(terrain, x, z));
    if (!ports.restoring && bytes !== undefined) addBakedTerrainCollider(host.physics, bytes, host.scope);
    const liftEntries = socketLiftEntries(shard.entryways), resetMovers = new Set(liftEntries.flatMap(entry => [entry.lift.mover, entry.lift.gate]));
    if (liftEntries.length > 0 && !host.embedded && !ports.restoring && !ports.entrySocketsProvided) installEntrySockets(host.physics, host.scope, [{ x: 0, z: 0 }]);
    const water = ports.water ?? new WaterBodies();
    if (ports.water === undefined) for (const row of [...shard.water].sort((a, b) => Number(a.kind === 'sea') - Number(b.kind === 'sea'))) water.add(declaredWaterBody(row), host.scope);
    const ids = shardfileColliderIds(shard);
    if (portals.length > 0) {
      const safe = () => { if (portalTransitioning(host.physics)) throw new Error('Cannot step or snapshot during a portal transfer'); };
      host.onStep('portal.declared', safe, { snapshot: () => { safe(); return null; }, restore: value => {
        if (value !== null) throw new Error('Portal continuation cannot contain a mid-transfer state');
      } });
    }
    const colliders = ports.colliders ?? installShardfileColliders(shard, assets, () => host.physics, host.scope, ports.restoring);
    if (ids.length !== colliders.size || ids.some(id => !colliders.has(id))) throw new Error('Declared collider port mismatch');
    if (shard.meshCollision !== null) {
      // Layered native floors follow each creature's own height, never the top of an overhang above its head.
      host.setHeightQuery(clientGround(shard, assets).heightAt);
      host.setFloorQuery((x, z, fromY, maxDrop) => floorBelow(host.physics, x, z, fromY, maxDrop));
      for (const actor of host.entities.values()) actor.groundHeight = (x, z, fromY) => floorBelow(host.physics, x, z, fromY, 500) ?? -250;
    }
    let pendingColliders: ReadonlyMap<string, PropColliderState> | undefined;
    if (ids.length > 0) host.onStep('props.declared', () => undefined, {
      snapshot: () => Object.fromEntries([...colliders].map(([id, port]) => [id, { handles: port.snapshot().handles }])),
      restore: (value: SimValue) => {
        if (value === null || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== colliders.size) throw new Error('Invalid declared collider continuation');
        const states = new Map<string, PropColliderState>();
        for (const [id] of colliders) {
          const state = value[id];
          if (state === null || typeof state !== 'object' || Array.isArray(state) || !Array.isArray(state['handles']) || Object.keys(state).length !== 1) throw new Error('Invalid declared collider handles');
          const handles: number[] = [];
          for (const handle of state['handles']) {
            if (typeof handle !== 'number' || !Number.isFinite(handle) || handle < 0) throw new Error('Invalid declared collider handle');
            handles.push(handle);
          }
          states.set(id, { handles });
        }
        // The native snapshot replaces the constructor world after adapter.restore. Validate mesh geometry
        // and reconnect only after that replacement, against the actual saved world rather than its placeholder.
        if (ports.restoring && shard.meshCollision !== null) pendingColliders = states;
        else for (const [id, state] of states) colliders.get(id)?.restore(state);
      },
      ...(ports.restoring && shard.meshCollision !== null ? { physicsRestored: () => {
        if (pendingColliders === undefined) throw new Error('Missing declared mesh continuation');
        for (const [id, state] of pendingColliders) colliders.get(id)?.restore(state);
        pendingColliders = undefined;
      } } : {}),
    });
    const hooks = ports.hooks ?? shard.hooks;
    const actors = new Map<string, number>(), reverse = new Map<number, string>();
    for (const id of [host.player.id, ...host.entities.keys()]) {
      const handle = numericScriptEntityId(id); if (reverse.has(handle)) throw new Error('Script actor handle collision');
      actors.set(id, handle); reverse.set(handle, id);
    }
    const custom = new Map(shard.creatures.brains.filter((brain) => brain.kind === 'script').map((brain) => [brain.id, brain]));
    const brainBindings = shard.creatures.spawns.flatMap((spawn) => {
      const brain = spawn.brain === null ? undefined : custom.get(spawn.brain);
      return brain === undefined ? [] : [{ actorId: spawn.id, entity: numericScriptEntityId(`brain:${spawn.id}`), brain }];
    });
    if (brainBindings.length > 0 && ports.scriptBrains === undefined) throw new Error('Missing custom brain port');
    const dataPorts = shard.runtime === null ? dataCreaturePorts(host, shard.rows, shard.creatures.spawns, ports.creatureImpulse) : undefined;
    const groupIds = new Set(shard.creatures.groups.map((group) => group.id));
    const preparedGroups = prepareDeclaredGroupBrains(host, shard.creatures.groups, shard.creatures.spawns, ports.groups ?? dataPorts?.groups ?? {},
      shard.creatures.brains.map((brain) => brain.id), shard.encounters.map((row) => row.entity));
    if (shard.crowds.length > 0 && ports.crowds === undefined) throw new Error('Missing declared crowd ports');
    const preparedCrowds = prepareDeclaredCrowds(shard.crowds, ports.crowds?.(host) ?? { flock: () => { throw new Error('Missing declared crowd recipe'); } });
    let lane: ScriptLanePort | undefined;
    let movers: MoverRuntime | undefined;
    if (shard.sim.scripts.length > 0) {
      const entities = new Map<number, ScriptEntity>();
      for (const [id, handle] of actors) {
        const position = id === host.player.id ? host.player.position : host.entities.get(id)?.position;
        if (position === undefined) throw new Error('Missing host actor');
        entities.set(handle, { id: handle, name: id, position: [position.x, position.y, position.z], fields: {}, frozen: false, interactive: true });
      }
      const trusted = ports.scriptEntities ?? declaredItemScriptEntities(shard.items, host.player.id);
      for (const entity of trusted.entities) {
        if (entities.has(entity.id)) throw new Error('Duplicate trusted script entity'); entities.set(entity.id, entity);
      }
      for (const [handle, actor] of trusted.actors) {
        if (reverse.has(handle) || !entities.has(handle) || !actors.has(actor)) throw new Error('Invalid trusted owned-entity actor'); reverse.set(handle, actor);
      }
      for (const binding of shard.sim.bindings) {
        if (binding.actorId !== null) {
          if (reverse.get(binding.entity) !== binding.actorId) throw new Error('Script actor binding does not match host identity');
        } else if (!entities.has(binding.entity)) entities.set(binding.entity, { id: binding.entity, name: `director:${binding.entity}`, position: [0, 0, 0], fields: {}, frozen: false, interactive: true });
        else if (reverse.has(binding.entity)) throw new Error('Actor-free script cannot reuse an actor handle');
      }
      const aliases = new Set<number>();
      for (const binding of brainBindings) {
        if (entities.has(binding.entity) || aliases.has(binding.entity)) throw new Error('Custom brain alias collision');
        aliases.add(binding.entity);
      }
      for (const mover of shard.movers) {
        if (entities.has(mover.entity) || aliases.has(mover.entity)) throw new Error('Mover script alias collision');
        aliases.add(mover.entity);
      }
      if (entities.size + aliases.size > shard.serverBudget.entities) throw new Error('Aggregate script entity allowance');
      const options: ShardScriptPorts = {
        rules: ports.scriptRules ?? { fields: {}, archetypes: [], events: [...new Set([...hooks.scenes.map((scene) => scene.type), ...shard.items.rows.flatMap((row) => row.hook === null ? [] : [row.hook.event])])], maxEntities: shard.serverBudget.entities },
        entities: [...entities.values()], actors: reverse,
        ...(ports.scriptDisabled === undefined ? {} : { onDisabled: ports.scriptDisabled }),
        query: ports.query ?? ((kind, input, entity) => scriptPhysicsQueries({ physics: host.physics, navigation: ports.navigation ?? { closestWalkable: () => null, findPath: () => null }, handle: (owner) => typeof owner === 'string' ? actors.get(owner) : undefined })(kind, input, entity)),
      };
      const moverDriver = shard.movers.length === 0 ? undefined : new MoverScriptDriver(shard.movers, options.query, [...resetMovers]);
      if (brainBindings.length > 0) {
        if (ports.scriptBrains === undefined) throw new Error('Missing custom brain port');
        const trustedBrains = ports.scriptBrains(host);
        if (typeof trustedBrains.ports.observe !== 'function' || typeof trustedBrains.ports.mayAttack !== 'function' || typeof trustedBrains.ports.strike !== 'function') throw new Error('Missing custom brain observation or strike recipe');
        const brainPorts = { ...trustedBrains, query: trustedBrains.query ?? options.query, actors: host.entities, bindings: brainBindings };
        lane = moverDriver === undefined ? createShardfileComposedLane(shard, assets, options, brainPorts) : moverDriver.compose(shard, assets, options, brainPorts);
      } else lane = moverDriver === undefined ? createShardfileScriptLane(shard, assets, options) : moverDriver.compose(shard, assets, options);
      if (moverDriver !== undefined) {
        const stateWorld = lane.world;
        const runtime = moverDriver.install(host, lane, { id: 'movers.declared',
          activation: { ground: () => host.hasPlayerMotor ? host.player.motor.result : undefined, shared: id => {
            const field = shard.state.shared.find(row => row.id === id);
            const value = field === undefined ? undefined : stateWorld.view(host.player.id).shared[field.name];
            return typeof value === 'number' || typeof value === 'boolean' ? value : undefined;
          } }, ...(ports.restoring === undefined ? {} : { restoring: ports.restoring }) });
        movers = runtime;
      }
      installScriptLane(host, 'script.declared', lane, ports.commands);
    }
    if (shard.targets.panels.length > 0) {
      const targetLane = lane; if (targetLane === undefined) throw new Error('Target fields require an installed script lane');
      const sync = () => syncTargetColliders(shard.targets, colliders, (scope, id) => {
        const field = shard.state[scope].find((row) => row.id === id);
        if (field === undefined) throw new Error('Missing target state field');
        const value = targetLane.world.view(host.player.id)[scope][field.name];
        if (value === undefined) throw new Error('Unavailable target state field');
        return value;
      });
      host.onStep('targets.declared', sync); if (!ports.restoring) sync();
    }
    if (liftEntries.length > 0) {
      let rider: LiftRider = null;
      host.onStep('lift.rider', () => undefined, { snapshot: () => captureLiftRider(shard, { host, movers }),
        restore: value => { rider = v.parse(LiftRiderSchema, value); },
        physicsRestored: () => { restoreLiftRider(shard, { host, movers, water }, rider); },
      });
    }
    const quest = new DeclaredQuests(host, shard.quests, { ...ports.quest,
      ...(lane === undefined ? {} : { script: createQuestScriptPorts(lane, hooks, actors) }),
    });
    const needsDay = (shard.directors ?? []).some(data => Object.values(data.inputs).some(binding => directorDayRange(binding) !== null));
    let day: (() => number) | undefined;
    if (needsDay) {
      if (host.embedded) {
        const clock = ports.lookClock;
        if (clock === undefined) throw new Error('Day director requires the page-owned look clock');
        day = () => clock().hour;
        host.onStep('director.day', () => undefined, { snapshot: () => JSON.stringify(clock().snapshot()), restore: value => {
          if (typeof value !== 'string') throw new Error('Invalid director day continuation');
          clock().restore(v.parse(dayClockContinuation, JSON.parse(value)));
        } });
      } else {
        const clock = host.useDayClock(normalizedDayClock(shard.look.day ?? DEFAULT_NORMALIZED_DAY, shard.look.dayOverride));
        day = () => clock.hour;
      }
    }
    for (const data of shard.directors ?? []) {
      const bindingIssues = directorDataHostIssues(data);
      if (bindingIssues.length > 0) throw new Error(`Director rows require native bindings for their observations and actions: ${bindingIssues.join('; ')}`);
      if (Object.values(data.inputs).some(binding => binding.startsWith('flag:') && !shard.quests.flags.includes(binding.slice(5)))
        || data.stages.some(stage => stage.do.some(action => 'flag' in action && !shard.quests.flags.includes(action.flag.key)))) throw new Error('Director flag has no declared native owner');
      const director = new DirectorStageLane(data);
      host.onStep(`director.${data.id}`, (_dt, native) => {
        const observation = Object.fromEntries(Object.entries(data.inputs).map(([name, binding]) => {
          const range = directorDayRange(binding);
          if (range === null) return [name, native.flags.has(binding.slice(5))];
          if (day === undefined) throw new Error('Missing director day clock');
          return [name, inNormalizedDayRange(day(), range[0], range[1])];
        }));
        for (const action of director.step(native.state.tick, observation)) {
          if (!('flag' in action)) throw new Error('Director action has no native owner');
          native.flags.set(action.flag.key, action.flag.value);
        }
      }, { snapshot: () => director.snapshot(), restore: state => {
        if (typeof state !== 'string') throw new Error('Invalid director row continuation'); director.restore(state);
      } });
    }
    installDeclaredBrains(host, shard.creatures.spawns.filter((spawn) => spawn.brain === null || (!custom.has(spawn.brain) && !groupIds.has(spawn.brain))), shard.creatures.brains.filter((brain) => brain.kind !== 'script'), ports.brains ?? dataPorts?.brains);
    dataPorts?.install();
    const encounters = installDeclaredEncounters(host, shard.encounters, ports.encounters ?? (() => ({ saved: { defeated: false, rewardTaken: false, kills: 0 }, persist: () => undefined, reward: () => undefined })), ports.hud);
    // All individual/custom aliases and encounter recipes have admitted successfully before setup draws or group work.
    const groups = preparedGroups.install(ports.restoring ?? false);
    if (!host.embedded && !ports.restoring) host.physics.step();
    // Crowd setup is last: all scripts, actor/group controllers, quests, encounters and physics have admitted.
    const crowds = preparedCrowds.install(host, ports.restoring ?? false);
    const picker = createHeadlessPromptPicker(host);
    const prompts = shard.targets.interactions.map((row, act) => ({ act, id: row.id, position: { x: row.at[0], y: row.at[1], z: row.at[2] }, radius: row.radius }));
    const selectedInteraction = (): string | null => picker.pick(prompts)?.id ?? null;
    const interact = (id: string): boolean => {
      const row = shard.targets.interactions.find(target => target.id === id);
      if (row === undefined) throw new Error('Unknown authored interaction');
      if (selectedInteraction() !== id) return false;
      if (lane === undefined) throw new Error('Interaction requires an admitted scene lane');
      createQuestScriptPorts(lane, hooks, actors).scene(row.scene, host.player.id); return true;
    };
    return { selectedInteraction, interact, host, lane, actors, quest, encounters, water, colliders, groups, crowds, movers, dispose: () => { host.dispose(); } };
  } catch (error) { host.dispose(); throw error; }
}

/** Trusted admission world: advance the existing one host/runtime/world fixed step before moving the real capsule. */
export interface SocketLiftProofPorts {
  physics: Physics; runtime: MoverRuntime; fixedStep: () => void;
  waterAt?: (x: number, z: number) => number | null;
  approachSource?: LiftApproachSource;
}
/** Counts come from actual fixed steps and motor moves, including both stop calls and the automatic idle return. */
export interface SocketLiftProof { steps: number; rides: number; calls: number; maximumDeckStep: number }
/** One world an entry ride walks: its collision, its admitted movers (a lift's deck and road gate), fixed step and water. */
export interface EntryProofWorld {
  physics: Physics; movers?: MoverRuntime | undefined; fixedStep: () => void;
  waterAt?: (x: number, z: number) => number | null; dispose: () => void;
}
/** Real lanes and steps of every declared entryway, plus the lift rides and calls and the portal transfers it proved. */
export interface EntryProof { lanes: number; steps: number; liftRides?: number; liftCalls?: number; portalTransfers?: number }
/**
 * Every declared entryway, proven by its kind: ordinary entries by the caller's `edges` walk (refused when it has none),
 * each socket lift by its complete ride and 23 road-gate lanes on its own `world()`, and all portal links on one more.
 * The untrusted shardfile host and the trusted runtimes share this one law; each brings only how its world is built.
 */
export function proveEntryways(source: Shardfile, assets: ReadonlyMap<string, Uint8Array>, ports: {
  edges?: (sides: readonly Shardfile['entryways'][number]['edge'][]) => { lanes: number; steps: number };
  world: () => EntryProofWorld;
}): EntryProof {
  const lifts = socketLiftEntries(source.entryways), portals = portalLinkEntries(source.entryways);
  const sides = source.entryways.filter(entry => entry.kind !== 'socketLift' && entry.kind !== 'portalLink').map(entry => entry.edge);
  if (ports.edges === undefined && sides.length > 0) throw new Error('Edge entries require an edge walk');
  const result = ports.edges?.(sides) ?? { lanes: 0, steps: 0 };
  const within = (prove: (world: EntryProofWorld) => void): void => { const world = ports.world(); try { prove(world); } finally { world.dispose(); } };
  let liftRides = 0, liftCalls = 0, portalTransfers = 0;
  // Every ride starts at a freshly admitted road stop, independently of validation ticks or other lifts.
  for (const entry of lifts) within(({ physics, movers, fixedStep, waterAt }) => {
    if (movers === undefined) throw new Error('Socket lift requires admitted mover runtime');
    const proof = proveSocketLift(entry, { physics, runtime: movers, fixedStep, ...(waterAt === undefined ? {} : { waterAt }), approachSource: source });
    result.lanes += 23; result.steps += proof.steps; liftRides += proof.rides; liftCalls += proof.calls;
  });
  if (portals.length > 0) within(({ physics, waterAt }) => {
    const proof = provePortalLinks(portals, source, assets, { physics, ...(waterAt === undefined ? {} : { waterAt }) });
    result.lanes += proof.lanes; result.steps += proof.steps; portalTransfers = proof.transfers;
  });
  return { ...result, ...(lifts.length > 0 ? { liftRides, liftCalls } : {}), ...(portals.length > 0 ? { portalTransfers } : {}) };
}
/** The untrusted shardfile host: ordinary entries walk the live sim; each ride proof gets a freshly admitted one. */
export function proveShardfileEntries(source: Shardfile, sim: ShardfileSimulation, assets: ReadonlyMap<string, Uint8Array>, ports: ShardfileSimPorts): EntryProof {
  return proveEntryways(source, assets, { edges: sides => walkEdgeEntries(sim.host.physics, (x, z) => sim.water.restAt(x, z), sides), world: () => {
    const fresh = createShardfileSim(source, assets, { ...ports, ground: false });
    return { physics: fresh.host.physics, movers: fresh.movers, waterAt: (x, z) => fresh.water.restAt(x, z), dispose: () => { fresh.dispose(); },
      fixedStep: () => { fresh.host.step(); if ((fresh.lane?.host.failureCount ?? 0) !== 0) throw new Error('Socket lift script call failed'); } };
  } });
}
const distance = (a: { x: number; y: number; z: number }, b: readonly [number, number, number]) => Math.hypot(a.x - b[0], a.y - b[1], a.z - b[2]);
const options = { radius: 0.35, height: 1.8, step: 0.3, maxClimbDeg: 45, snap: 0.2, group: 'PLAYER', blockedBy: ['WORLD'] } as const;

/** Walk, command, ride and return through actual collision. Feet are initialized once; every later move comes from the motor. */
export function proveSocketLift(entry: SocketLiftEntry, ports: SocketLiftProofPorts): SocketLiftProof {
  const errors = socketLiftRules([entry], ports.runtime.data, ports.approachSource); if (errors.length > 0) throw new Error(errors.join('; '));
  const lift = parseSocketLift(entry.lift), motor = new CharacterMotor(ports.physics, options);
  const inward = entry.edge === 'north' ? [0, -1] : entry.edge === 'south' ? [0, 1] : entry.edge === 'east' ? [-1, 0] : [1, 0];
  const ix = inward[0] ?? 0, iz = inward[1] ?? 0;
  const start = { x: entry.edge === 'east' ? 237 : entry.edge === 'west' ? -237 : 0, y: 0.05,
    z: entry.edge === 'north' ? 237 : entry.edge === 'south' ? -237 : 0 };
  const feet = { ...start };
  let steps = 0, probeSteps = 0, grounded = false, maximumDeckStep = 0, previous = ports.runtime.pose(lift.mover).position;
  const gateRest = ports.runtime.pose(lift.gate), approachOwners = new Set(lift.approach?.colliders), boardingOwners = new Set([...approachOwners, lift.mover]);
  const owner = (): string | undefined => { const value = tagOf(motor.result.groundCollider ?? motor.collider)?.owner; return typeof value === 'string' ? value : undefined; };
  const requireOwner = (allowed: ReadonlySet<string>): void => {
    const ground = owner();
    if (ground !== undefined && allowed.has(ground)) return;
    // At touching floors Rapier may pick the socket. Query the real named floor and capsule clearance at its admitted y=0, without moving feet.
    if ([...allowed].some(id => canStandAt(ports.physics, { x: feet.x, y: 0, z: feet.z }, options, id, motor.collider))) return;
    if (allowed.has(lift.mover) && lift.approach !== undefined) {
      const last = lift.approach.route[lift.approach.route.length - 1];
      if (last !== undefined) {
        const dx = last[0] - lift.roadStop[0], dz = last[2] - lift.roadStop[2], length = Math.hypot(dx, dz);
        // The admitted seam may leave the centre ray over <=5cm of void. Probe its two named lips; the real motor remains grounded and never moves by this query.
        if (length > 0 && [-1, 1].some(sign => [...allowed].some(id => canStandAt(ports.physics,
          { x: feet.x + sign * dx / length * 0.05, y: 0, z: feet.z + sign * dz / length * 0.05 }, options, id, motor.collider)))) return;
      }
    }
    throw new Error('Socket lift approach is not supported by its declared colliders');
  };
  const checkStop = (stop: readonly [number, number, number]): boolean => distance(ports.runtime.pose(lift.mover).position, stop) <= 0.001;
  const step = (dx = 0, dz = 0): void => {
    if (++steps > 50_000) throw new Error('Socket lift admission step allowance');
    ports.fixedStep();
    if (lift.approach !== undefined) {
      const gate = ports.runtime.pose(lift.gate);
      if (Math.hypot(gate.position.x - gateRest.position.x, gate.position.y - gateRest.position.y, gate.position.z - gateRest.position.z) > 1e-8
        || Math.hypot(gate.euler.x - gateRest.euler.x, gate.euler.y - gateRest.euler.y, gate.euler.z - gateRest.euler.z) > 1e-8) throw new Error('Socket lift road gate moved away from its stationary pose');
    }
    const pose = ports.runtime.pose(lift.mover);
    if (lift.approach !== undefined && distance(pose.position, lift.roadStop) > 0.001 && !ports.runtime.pose(lift.gate).enabled) throw new Error('Socket lift road gate opened while its deck was away');
    const delta = Math.hypot(pose.position.x - previous.x, pose.position.y - previous.y, pose.position.z - previous.z);
    maximumDeckStep = Math.max(maximumDeckStep, delta); previous = pose.position;
    if (!pose.enabled || delta > 15 / 60 + 1e-6) throw new Error('Socket lift disabled or teleported instead of riding');
    const carried = grounded && motor.carry(feet);
    const result = motor.move(feet, { x: dx, y: carried ? 0 : -9.81 / 3600, z: dz }); grounded = result.grounded;
    const water = ports.waterAt?.(feet.x, feet.z);
    if (water !== undefined && water !== null && water > feet.y + 0.15) throw new Error('Submerged socket lift route');
    if (!grounded && steps > 15) throw new Error('Socket lift rider lost the walk surface');
  };
  const walk = (point: readonly [number, number, number], allowed?: ReadonlySet<string>): void => {
    let stalled = 0;
    for (let tick = 0; Math.hypot(feet.x - point[0], feet.z - point[2]) > 0.06; tick++) {
      if (tick > 6000) throw new Error('Socket lift onward route too long or blocked');
      const dx = point[0] - feet.x, dz = point[2] - feet.z, d = Math.hypot(dx, dz), before = d;
      step(dx / d * Math.min(d, 5 / 60), dz / d * Math.min(d, 5 / 60));
      if (allowed !== undefined) requireOwner(allowed);
      stalled = Math.hypot(feet.x - point[0], feet.z - point[2]) >= before - 0.02 ? stalled + 1 : 0;
      if (stalled >= 5) throw new Error('Blocked socket lift route');
    }
    if (Math.abs(feet.y - point[1]) > 0.1) throw new Error('Socket lift route does not reach its declared walk height');
  };
  const wait = (stop: readonly [number, number, number], bound: number): void => {
    for (let tick = 0; !checkStop(stop); tick++) {
      if (tick >= bound) throw new Error('Socket lift did not reach its stop within the declared ride');
      step();
    }
  };
  const command = (action: 1 | 2 | 3): void => {
    const at = ports.runtime.pose(lift.mover).position; commandSocketLift(ports.runtime, lift, action);
    for (let tick = 0; tick < 6; tick++) step();
    if (distance(ports.runtime.pose(lift.mover).position, [at.x, at.y, at.z]) < 0.001) throw new Error('Socket lift did not answer the normal interaction');
  };
  try {
    if (!checkStop(lift.roadStop)) throw new Error('Socket lift must load at the road stop');
    // Loaded and idle means actually resting, including after a fresh unload/reload; no saved travel pose is accepted.
    for (let tick = 0; tick < 30; tick++) { step(); if (!checkStop(lift.roadStop)) throw new Error('Socket lift must remain at its idle road stop'); }
    if (lift.approach !== undefined) {
      const mouth = lift.approach.route[0]; if (mouth === undefined) throw new Error('Missing static approach mouth');
      walk(mouth);
      for (const point of lift.approach.route.slice(1)) walk(point, approachOwners);
    }
    walk(lift.roadStop, lift.approach === undefined ? undefined : boardingOwners);
    if (tagOf(motor.result.groundCollider ?? motor.collider)?.owner !== lift.mover) throw new Error('Socket lift rider never boarded the declared deck');
    command(1);
    if (!ports.runtime.pose(lift.gate).enabled) throw new Error('Missing active platform gate while the lift is away');
    // Overlapping independent road probes witness collision across the full opening, not a presentation boolean.
    for (let lane = 0; lane <= 22; lane++) {
      const guard = new CharacterMotor(ports.physics, options), offset = -3.65 + lane * 7.3 / 22;
      const guardFeet = { x: start.x + (iz === 0 ? 0 : offset), y: start.y, z: start.z + (ix === 0 ? 0 : offset) };
      try {
        for (let tick = 0; tick < 40; tick++) { guard.move(guardFeet, { x: ix / 10, y: -9.81 / 3600, z: iz / 10 }); probeSteps++; }
        if ((guardFeet.x - start.x) * ix + (guardFeet.z - start.z) * iz > 2.2) throw new Error('Socket lift road gate did not block the real capsule');
      } finally { guard.dispose(); }
    }
    wait(lift.topStop, lift.rideTicks - 6);
    if (distance(feet, lift.topStop) > 0.15 || tagOf(motor.result.groundCollider ?? motor.collider)?.owner !== lift.mover) throw new Error(`Socket lift rider did not reach the top on its deck (${feet.x},${feet.y},${feet.z}; owner ${String(tagOf(motor.result.groundCollider ?? motor.collider)?.owner)})`);
    for (const point of lift.route) walk(point);
    if (tagOf(motor.result.groundCollider ?? motor.collider)?.owner === lift.mover) throw new Error('Socket lift onward route never reaches playable ground');
    // Walk back to the first off-deck route point, then wait on real static ground for the automatic idle return.
    for (const point of lift.route.slice(1).reverse()) walk(point);
    wait(lift.roadStop, lift.rideTicks * 2);
    command(3); wait(lift.topStop, lift.rideTicks - 6); // call up from the top landing
    walk(lift.topStop); command(1); wait(lift.roadStop, lift.rideTicks - 6);
    if (distance(feet, lift.roadStop) > 0.15) throw new Error('Socket lift rider did not return on its deck');
    if (lift.approach !== undefined) {
      const back = [...lift.approach.route].reverse(), landing = back[0];
      if (landing === undefined) throw new Error('Missing static approach landing');
      walk(landing, boardingOwners); requireOwner(approachOwners);
      for (const point of back.slice(1)) walk(point, approachOwners);
    }
    walk([start.x, 0, start.z]);
    command(3); wait(lift.topStop, lift.rideTicks - 6); // empty up, then the road-side call down
    command(2); wait(lift.roadStop, lift.rideTicks - 6);
    if (ports.runtime.pose(lift.gate).enabled) throw new Error('Socket lift road gate did not reopen');
    return { steps: steps + probeSteps, rides: 2, calls: 2, maximumDeckStep };
  } finally { motor.dispose(); }
}

/** The normal interaction queues these commands on both the deck and its road gate. No author callback is invoked. */
export function commandSocketLift(runtime: MoverRuntime, lift: SocketLift, action: 1 | 2 | 3): void {
  runtime.command(lift.mover, action); runtime.command(lift.gate, action);
}

/** Native host evidence for the author-only grid and ledger workflow. */
export interface AuthoredGridProof {
  version: 1; ticks: number; checkpointTick: number;
  grid: { reserveBeforePhysics: true; runtimeFence: true; refusedSave: true; restored: true; frozenTicks: 5; loads: 2; leasesAfterDispose: 0 };
  ledger: { facts: { name: string; actorId: string; tick: number }[]; granted: number; durableReload: true; duplicateStable: true };
}
/** Fixed native author workflow: real grid residency, checkpoint refusal/restore and quest-owned Ledger filing.
 * The SDK supplies admitted commands, never facts, owner identities, reward catalogue entries or host modules.
 * Profile storage is a serialized SaveStore test port; this proves the atomic contract, not browser quota availability.
 */
export async function proveAuthoredGrid(source: Shardfile, assets: ReadonlyMap<string, Uint8Array>, ports: ShardfileSimPorts,
  plan: { ticks: number; checkpointTick: number; requiredFacts: readonly string[] },
  inputAt: (tick: number, sim: ShardfileSimulation) => SimCommand | undefined): Promise<AuthoredGridProof> {
  if (source.runtime !== null || !Number.isInteger(plan.ticks) || plan.ticks < 1 || plan.ticks > 4096
    || !Number.isInteger(plan.checkpointTick) || plan.checkpointTick < 1 || plan.checkpointTick > plan.ticks) throw new Error('Invalid author proof');
  const insist = (ok: boolean, message: string): void => { if (!ok) throw new Error(`Author proof: ${message}`); };
  const instance = 'author-4', allocator = new ResidencyAllocator();
  const assembly = new GridAssembly({ developer: false, devserver: false }, {
    version: 0, pitch: CONTENT_CAPS.pitch, cells: Array.from({ length: 9 }, (_, index) => ({ instance: `author-${index}`, slug: source.identity.slug, cell: [index % 3 - 1, Math.floor(index / 3) - 1] })),
    plots: [], developer: [], devserver: [], emptyNeighbour: { kind: 'sea', level: 0, edgeColour: [0.5, 0.5, 0.5], fog: { colour: [0.5, 0.5, 0.5], near: 10, far: 1000 } },
  });
  interface Fact { name: string; actorId: string; tick: number }
  const facts: Fact[] = [], baselineFacts: Fact[] = [];
  const make = (record: Fact[], saved?: SimSnapshot): ShardfileSimulation => {
    let current: ShardfileSimulation | undefined;
    const native = { ...ports, quest: { fact: (name: string, actorId: string) => {
      if (current === undefined) throw new Error('Fact emitted outside an installed native tick');
      record.push({ name, actorId, tick: current.host.state.tick });
    }, coins: () => undefined } };
    current = createShardfileSim(source, assets, native);
    if (saved !== undefined) {
      const level = current.host.level; current.dispose(); current = undefined;
      const installed: { value?: ShardfileSimulation } = {};
      const host = restoreSimHost(level, { rapier: ports.rapier }, saved, fresh => { installed.value = bindShardfileSim(fresh, source, assets, { ...native, restoring: true }); });
      current = installed.value;
      if (current === undefined) { host.dispose(); throw new Error('Missing restored author owner'); }
    }
    return current;
  };
  const highway = make([]), baseline = make(baselineFacts);
  let resident: ShardfileSimulation | undefined, admitted = false, durable = false, loads = 0;
  const saved = new Map<string, SimSnapshot>();
  const grid = new GridSimulation(assembly, { highway, allocator, residentBytes: () => source.budgets.sim.resident,
    admitted: () => admitted, read: id => saved.get(id), save: (id, value) => { if (!durable) return false; saved.set(id, structuredClone(value)); return true; },
    load: (_cell, snapshot) => { insist(allocator.has(`sim:${instance}`), 'physics allocated before reservation'); loads++; resident = make(facts, snapshot); return Promise.resolve(resident); },
  });
  try {
    insist(!grid.ready(instance), 'unloaded cell is ready'); await grid.prefetch([instance]);
    insist(!grid.ready(instance), 'physics bypassed runtime admission'); admitted = true;
    insist(grid.ready(instance), 'admitted cell is unavailable'); (await grid.prepare(null, instance)).commit();
    if (resident === undefined) throw new Error('Missing author residency');
    const healthy = (value: ShardfileSimulation): void => {
      insist(!value.lane?.host.checkpoint().modules.some(module => module.failures > 0 || module.disabled), 'script failed');
      insist([value.host.player.position, ...[...value.host.entities.values()].map(entity => entity.position)].every(point => [point.x, point.y, point.z].every(Number.isFinite)), 'nonfinite native pose');
    };
    for (let tick = 0; tick < plan.checkpointTick; tick++) { grid.step(inputAt(tick, resident)); healthy(resident); }
    insist(!grid.checkpoint(instance), 'failed durable save admitted'); durable = true;
    insist(grid.checkpoint(instance), 'durable checkpoint refused');
    insist(loads === 1, 'first residency loaded more than once');
    const continuation = regionalContinuation(resident.host), player = snapshotSimHost(resident.host).player;
    const tick = resident.host.state.tick;
    (await grid.prepare(instance, null)).commit(); for (let i = 0; i < 5; i++) grid.step();
    insist(resident.host.state.tick === tick, 'inactive region advanced');
    insist(grid.unload(instance) && !allocator.has(`sim:${instance}`), 'unload retained physics lease');
    (await grid.prepare(null, instance)).commit();
    insist(regionalContinuation(resident.host) === continuation, 'regional continuation changed on restore');
    insist(loads === 2, 'restore did not create a fresh residency');
    const restoredPlayer = snapshotSimHost(resident.host).player;
    insist(JSON.stringify(restoredPlayer.position) === JSON.stringify(player.position) && restoredPlayer.yaw === player.yaw, 'traveler pose changed on restore');
    for (let next = plan.checkpointTick; next < plan.ticks; next++) { grid.step(inputAt(next, resident)); healthy(resident); }
    for (let next = 0; next < plan.ticks; next++) { baseline.host.step(inputAt(next, baseline)); healthy(baseline); }
    insist(regionalContinuation(resident.host) === regionalContinuation(baseline.host), 'restored regional suffix diverged');
    insist(JSON.stringify(facts) === JSON.stringify(baselineFacts), 'restored facts diverged or repeated');
    const values = new Map<string, string>();
    const storage = { get length() { return values.size; }, key: (index: number) => [...values.keys()][index] ?? null,
      getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
    const ledger = () => new Ledger(new SaveStore({ local: storage, session: null }), [{ id: instance, shard: source.identity.slug }],
      [{ shard: source.identity.slug, revision: source.identity.revision, rules: source.ledger }], []);
    const owner = ledger(); let granted = 0;
    const filed = facts.map((fact, ordinal) => {
      const quest = source.quests.quests.find(row => row.id === fact.actorId && row.onComplete?.fact === fact.name);
      if (quest === undefined) throw new Error('Missing native quest fact provenance');
      return { instance, shard: source.identity.slug, revision: source.identity.revision, entity: fact.actorId, tick: fact.tick, ordinal,
        name: fact.name, origin: { kind: 'engine' as const, source: `quest:${quest.id}` } };
    });
    for (const fact of filed) { const receipt = owner.record(fact); insist(receipt.status !== 'pending', 'ledger write pending'); if (receipt.status === 'granted') granted++; }
    for (const name of plan.requiredFacts) insist(filed.some(fact => fact.name === name), `native fact missing: ${name}`);
    const state = JSON.stringify(owner.state()), reloaded = ledger();
    insist(JSON.stringify(reloaded.state()) === state, 'serialized profile reload diverged');
    for (const fact of filed) insist(reloaded.record(fact).status === 'duplicate', 'ledger replay duplicated reward');
    insist(JSON.stringify(reloaded.state()) === state, 'duplicate filing changed profile');
    return { version: 1 as const, ticks: plan.ticks, checkpointTick: plan.checkpointTick,
      grid: { reserveBeforePhysics: true as const, runtimeFence: true as const, refusedSave: true as const, restored: true as const, frozenTicks: 5 as const, loads: 2 as const, leasesAfterDispose: 0 as const },
      ledger: { facts, granted, durableReload: true as const, duplicateStable: true as const } };
  } finally {
    baseline.dispose(); grid.dispose();
    insist(allocator.entries().length === 0, 'residency leak after disposal');
  }
}

/** Native/page owners inject their existing actor and contact ports; binding never advances a clock or aim. */
export interface MeleeContactPorts<T extends ContactScanTarget> extends ContactFamilyPorts<T> { readonly owner: Parameters<ContactFamilyPorts<T>['hit']>[0]['source'] }
/** Admit ordered numeric contacts and bind one existing shared controller, preserving source and event ownership. */
export function bindMeleeContacts<T extends ContactScanTarget>(weaponId: string, rows: unknown, ports: MeleeContactPorts<T>): ContactFamily<T> {
  if (!/^weapon\.[a-z][a-zA-Z0-9.-]*$/u.test(weaponId) || weaponId.length > 128) throw new Error('Bound melee weapon identity required');
  const admitted = parseMeleeContacts(rows);
  return new ContactFamily(admitted.map(row => ({ lane: row.lane, heavy: row.heavy, cooldown: row.cooldown,
    shape: row.shape, reach: row.reach, size: row.size, height: row.height, allowance: row.allowance,
    lands: row.lands, show: row.show, reports: row.reports, hits: row.hits.map(hit => ({
    tags: hit.tags, weaponId, source: hit.source === 'owner' ? ports.owner : 'env',
    damage: hit.damage, moveId: hit.moveId, copyVectors: hit.copyVectors, copyTags: hit.copyTags, reactions: hit.reactions,
  })) })), ports);
}


/** One admitted secondary action selects its declared move; script memory belongs to the existing item ScriptHost. */
export interface MeleeSecondaryInput { readonly tick: number; readonly dt: number; readonly action: 3 | 4; readonly move: number }
/** Start a row only after its actor-bound AS item hook accepts it. Contacts remain in the owner's original phase. */
export function startMeleeSecondary<T extends ContactScanTarget>(family: ContactFamily<T>, hook: ReturnType<DeclaredItemPorts['runtime']>['hook'], input: MeleeSecondaryInput): number | null {
  const row = family.moves[input.move];
  if (hook === null || family.secondaryCooldown > 0 || row?.lane !== 'secondary'
    || !Number.isSafeInteger(input.tick) || input.tick < 0 || !Number.isFinite(input.dt) || input.dt < 0 || input.dt > 1
    || ![3, 4].includes(input.action) || !Number.isInteger(input.move) || input.move < 0 || input.move > 15) return null;
  if (hook({ tick: input.tick, dt: input.dt, action: input.action, fuel: 0, cooldown: family.secondaryCooldown }) !== input.action) return null;
  return (row.lands.length === 0 ? family.claim(input.move) : family.swing(input.move)) ? input.move : null;
}

/** Actor-bound item aliases and verified modules join the existing composition; this driver creates no ScriptHost. */
export class MeleeScriptDriver {
  readonly modules: ReadonlyMap<string, Uint8Array>;
  readonly seed: number;
  private readonly items: ReturnType<typeof parseItems>;
  private readonly owner: string;
  private readonly driver: ScriptDriver;
  constructor(input: unknown, actorId: string, modules: ReadonlyMap<string, Uint8Array>, seed: number) {
    if (!Number.isSafeInteger(seed) || seed < 0) throw new Error('Item script seed must be a nonnegative safe integer');
    this.items = parseItems(input); this.owner = actorId; this.seed = seed; this.modules = modules;
    const aliases = declaredItemScriptEntities(this.items, actorId);
    const names = [...new Set(this.items.rows.flatMap(row => row.hook === null ? [] : [row.hook.module]))];
    const itemRoleOptions = prepareShardfileScriptOptions({ identity: { seed }, sim: { scripts: names, bindings: [], scriptTickDivisor: 1 },
      state: { shared: [], player: [] } }, modules, { rules: { fields: {}, archetypes: [],
        events: [...new Set(this.items.rows.flatMap(row => row.hook === null ? [] : [row.hook.event]))], maxEntities: Math.max(1, aliases.entities.length) },
      ...aliases, query: () => { throw new Error('Item action hooks have no query grants'); } });
    this.driver = new ScriptDriver(itemRoleOptions);
  }
  /** Action responses are consumed by their requesting weapon and never accumulate as undelivered input. */
  role(id = 'items'): ReturnType<ScriptDriver['role']> { return { ...this.driver.role(id), events: 'consume' }; }
  /** Bind only after the role joins the shared host; another role or actor cannot lend these handles. */
  hooks(host: Parameters<typeof scriptItemHook>[0]): ReadonlyMap<string, ReturnType<typeof scriptItemHook>> {
    const hooks = new Map<string, ReturnType<typeof scriptItemHook>>();
    for (const row of this.items.rows) if (row.hook !== null)
      hooks.set(row.id, scriptItemHook(host, row.hook.module, row.hook.entity, row.hook.event, this.owner));
    return hooks;
  }
}
/** Detach and hash-verify every declared item module before building its role; normal ABI/memory/fuel admission stays fatal. */
export async function createMeleeScriptDriver(input: unknown, actorId: string, assets: ScriptModuleAssets, seed: number): Promise<MeleeScriptDriver> {
  const items = parseItems(input), refs = items.rows.flatMap(row => row.hook === null ? [] : [row.hook.module]);
  const modules = await verifiedScriptModules(assets, refs);
  return new MeleeScriptDriver(items, actorId, modules, seed);
}


type NativeMeleeTarget = ReturnType<SimHost['combat']['targetPort']>;
type NativeMeleeHook = NonNullable<ReturnType<DeclaredItemPorts['runtime']>['hook']>;
type NativeMeleeContact = ReturnType<typeof parseMeleeContacts>[number];

/** One native move or the tick's aim input; commands remain in the owner's authoritative order. */
export type NativeMeleeCommand = { readonly kind: 'aim'; readonly pitch: number }
  | { readonly kind: 'move'; readonly action: number; readonly targetId?: string; readonly world?: number };
/** A world contact's admitted outcome: a light crack answers its first contact, a heavy crack its second. */
export interface NativeMeleeWorld { readonly act: number; readonly at: Readonly<{ x: number; y: number; z: number }>;
  readonly radius: number; readonly crack: 'light' | 'heavy' }
/** Original posed head ball and body capsule in world metres. */
export interface NativeMeleeVolumes { readonly head: Vector3; readonly headRadius: number;
  readonly a: Vector3; readonly b: Vector3; readonly bodyRadius: number }
const nativeMeleeOc = new Vector3(), nativeMeleeBa = new Vector3(), nativeMeleeOa = new Vector3(), nativeMeleeClosest = new Vector3();

function nativeMeleeBall(from: Vector3, dir: Vector3, centre: Vector3, radius: number): number | null {
  const oc = nativeMeleeOc.subVectors(from, centre), b = oc.dot(dir), c = oc.lengthSq() - radius * radius, h = b * b - c;
  if (h < 0) return null;
  const t = -b - Math.sqrt(h); return t >= 0 ? t : null;
}
/** Exact posed-volume ray query, including an immediate solid hit when the origin lies inside a volume. */
export function nativeMeleeVolumeHit(from: Vector3, dir: Vector3, reach: number, body: NativeMeleeVolumes): number | null {
  const ba = nativeMeleeBa.subVectors(body.b, body.a), oa = nativeMeleeOa.subVectors(from, body.a);
  const baba = ba.lengthSq(), along = baba > 1e-12 ? Math.min(1, Math.max(0, oa.dot(ba) / baba)) : 0;
  const closest = nativeMeleeClosest.copy(body.a).addScaledVector(ba, along);
  if (from.distanceToSquared(closest) <= body.bodyRadius ** 2 || from.distanceToSquared(body.head) <= body.headRadius ** 2) return 0;
  let best = Infinity;
  const bard = ba.dot(dir), baoa = ba.dot(oa), rdoa = dir.dot(oa), a = baba - bard * bard;
  if (a > 1e-12) {
    const b = baba * rdoa - baoa * bard, c = baba * oa.lengthSq() - baoa * baoa - body.bodyRadius ** 2 * baba, h = b * b - a * c;
    if (h >= 0) { const t = (-b - Math.sqrt(h)) / a, y = baoa + t * bard; if (t >= 0 && y > 0 && y < baba) best = t; }
  }
  for (const t of [nativeMeleeBall(from, dir, body.a, body.bodyRadius), nativeMeleeBall(from, dir, body.b, body.bodyRadius), nativeMeleeBall(from, dir, body.head, body.headRadius)]) if (t !== null && t < best) best = t;
  return best <= reach ? best : null;
}
/** Runtime authority and command ports are injected; no imported module installs a host. */
export interface NativeMeleePorts {
  readonly commands: () => readonly NativeMeleeCommand[];
  readonly world?: readonly NativeMeleeWorld[];
  readonly hook?: NativeMeleeHook | null;
  /** The existing composed ScriptHost's current tick; never starts a second script clock. */
  readonly hookTick?: () => number;
  readonly landed?: (action: number, from: Vector3, dir: Vector3) => void;
}
/** The shared controller and the current tick's world outcome. */
export interface NativeMeleeOwner { readonly family: ContactFamily<NativeMeleeTarget>; readonly cracked: () => number | null }
/** Install immediate and delayed item contacts on one renderer-free owner, retaining ordered commands and wire bindings. */
export function installNativeMelee(host: SimHost, weapon: { readonly id: string; readonly contacts?: readonly NativeMeleeContact[] },
  input: unknown, ports: NativeMeleePorts): NativeMeleeOwner {
  const { native: row, contacts } = parseNativeMeleeBinding(input, weapon.contacts);
  const aimed = { target: null as string | null, world: null as number | null, dir: new Vector3(0, 0, -1) };
  const from = new Vector3(), direction = new Vector3(), targets = ports.world ?? [];
  const volumes = { head: new Vector3(), headRadius: 0, a: new Vector3(), b: new Vector3(), bodyRadius: 0 };
  let cracked: number | null = null, pitch = 0;
  const port = (id: string): NativeMeleeTarget | null => {
    const actor = host.entities.get(id); return actor === undefined ? null : host.combat.targetPort(actor.combatActor(), actor, velocity => { actor.impulse(velocity); });
  };
  const eye = (out: Vector3): Vector3 => { out.copy(host.player.position); out.y += row.eye; return out; };
  const selected = (out: Vector3, dir: Vector3): boolean => {
    eye(out);
    const actor = aimed.target === null ? undefined : host.entities.get(aimed.target), spot = aimed.world === null ? undefined : targets.find(target => target.act === aimed.world);
    if (actor !== undefined) dir.copy(actor.position).setY(actor.position.y + actor.dims.bodyY * actor.scale).sub(out);
    else if (spot !== undefined) dir.set(spot.at.x, spot.at.y, spot.at.z).sub(out);
    else dir.copy(aimed.dir);
    if (dir.lengthSq() < 1e-9) { if (row.zeroAim === 'refuse') return false; dir.copy(aimed.dir); }
    dir.normalize(); aimed.dir.copy(dir); return true;
  };
  const world = targets.map(target => ({ at: new Vector3(target.at.x, target.at.y, target.at.z), radius: target.radius,
    crack: (heavy: boolean, second: boolean): boolean => {
      if (target.crack === 'light') { if (second) return false; cracked = target.act; return true; }
      if (heavy && second) cracked = target.act;
      return true;
    } }));
  const family = bindMeleeContacts<NativeMeleeTarget>(weapon.id, contacts, { owner: host.player.health, hit: request => host.combat.hit(request),
    world: () => world, aim: selected,
    targets: () => [...host.entities.keys()].flatMap(id => { const target = port(id); return target === null || row.liveTargetsOnly && !target.hittable ? [] : [target]; }),
    react: target => ({ actor: target.actor, ...(target.impulse === undefined ? {} : { impulse: target.impulse }), stagger: (dir, strength) => { target.target.stagger?.(dir, strength); } }),
    ...(row.body === 'none' ? {} : { body: (origin: Vector3, dir: Vector3, reach: number) => {
      let best: { port: NativeMeleeTarget; point: Vector3 } | null = null, bestT = Infinity;
      if (host.entities.size > 1024) throw new RangeError('Native melee actor roster exceeds its bounded contact scan');
      const actors = host.entities.entries();
      for (let i = 0; i < Math.min(1024, host.entities.size); i++) {
        const next = actors.next(); if (next.done) break;
        const [id, actor] = next.value, target = port(id); if (target === null || !target.hittable) continue;
        actor.headWorld(volumes.head); actor.bodyCapsule(volumes.a, volumes.b);
        volumes.headRadius = actor.dims.headRadius * actor.scale; volumes.bodyRadius = actor.dims.bodyRadius * actor.scale;
        const t = nativeMeleeVolumeHit(origin, dir, reach, volumes);
        if (t !== null && t < bestT) { best = { port: target, point: origin.clone().addScaledVector(dir, t) }; bestT = t; }
      }
      return best;
    } }),
  });
  const snapshot = (): SimValue => {
    const state: Record<string, SimValue> = {};
    for (const field of row.continuation.fields) {
      switch (field.source) {
        case 'constant': state[field.key] = field.constant ?? 0; break;
        case 'primary': state[field.key] = family.cooldown; break;
        case 'secondary': state[field.key] = family.secondaryCooldown; break;
        case 'time': state[field.key] = family.t; break;
        case 'heavy': state[field.key] = family.row(family.move).heavy; break;
        case 'landed': state[field.key] = family.landed; break;
        case 'target': state[field.key] = aimed.target; break;
        case 'world': state[field.key] = aimed.world; break;
        case 'direction': state[field.key] = aimed.dir.toArray(); break;
        default: throw new Error('Unknown native melee snapshot binding');
      }
    }
    return row.continuation.encoding === 'json' ? JSON.stringify(state) : state;
  };
  const restore = (inputState: unknown): void => {
    if (row.continuation.encoding === 'json' && typeof inputState !== 'string') throw new Error('Invalid native melee JSON continuation');
    const saved = v.parse(v.record(v.string(), v.unknown()), typeof inputState === 'string' && row.continuation.encoding === 'json' ? JSON.parse(inputState) : inputState);
    if (Object.keys(saved).length !== row.continuation.fields.length) throw new Error('Unexpected native melee continuation field');
    const values = { primary: 0, secondary: 0, time: -1, heavy: false, landed: 0, target: null as string | null, world: null as number | null, direction: [0, 0, -1] };
    for (const field of row.continuation.fields) {
      const value = saved[field.key];
      switch (field.source) {
        case 'constant': if (value !== field.constant) throw new Error('Invalid native melee continuation version'); break;
        case 'heavy': values.heavy = v.parse(v.boolean(), value); break;
        case 'target': values.target = v.parse(v.nullable(v.string()), value); break;
        case 'world': values.world = v.parse(v.nullable(v.pipe(v.number(), v.finite())), value); break;
        case 'direction': values.direction = v.parse(v.tuple([v.pipe(v.number(), v.finite()), v.pipe(v.number(), v.finite()), v.pipe(v.number(), v.finite())]), value); break;
        case 'primary': case 'secondary': case 'time': case 'landed': {
          const number = v.parse(v.pipe(v.number(), v.finite()), value);
          if (field.source === 'landed' && !Number.isInteger(number) || field.min !== undefined && number < field.min || field.max !== undefined && number > field.max) throw new Error('Native melee continuation outside its admitted bounds');
          values[field.source] = number; break;
        }
        default: throw new Error('Unknown native melee restore binding');
      }
    }
    const move = row.mode === 'timed' ? family.moves.findIndex(candidate => candidate.heavy === values.heavy) : family.move;
    if (move < 0) throw new Error('Missing native melee continuation move');
    family.cooldown = values.primary; family.secondaryCooldown = values.secondary; family.t = values.time; family.move = move; family.landed = values.landed;
    aimed.target = values.target; aimed.world = values.world; aimed.dir.fromArray(values.direction);
  };
  host.onStep(row.step, dt => {
    if (row.commandsAfterCool) family.cool(dt);
    const commands = ports.commands(); // The policy retains the owner's held-release/cooldown ordering.
    if (commands.length > MAX_TICK_COMMANDS) throw new RangeError('Native melee commands exceed the protocol allowance');
    cracked = null; if (!row.commandsAfterCool) family.cool(dt); pitch = 0;
    if (row.pitchLimit !== null) for (const command of commands) if (command.kind === 'aim') pitch = Math.max(-row.pitchLimit, Math.min(row.pitchLimit, command.pitch));
    for (const command of commands) {
      if (command.kind === 'aim') continue;
      const action = row.actions.find(candidate => candidate.action === command.action); if (action === undefined) continue;
      if (action.aim === 'selected' && command.world === undefined && (command.targetId === undefined || !host.entities.has(command.targetId))) continue;
      if (row.mode === 'immediate' && action.aim === 'selected') { aimed.target = command.targetId ?? null; aimed.world = command.world ?? null; if (!selected(from, direction)) continue; }
      const claimed = action.hook === null ? row.mode === 'timed' ? family.swing(action.move) : family.claim(action.move)
        : startMeleeSecondary(family, ports.hook ?? null, { tick: ports.hookTick?.() ?? host.state.tick, dt, action: action.hook, move: action.move }) !== null;
      if (!claimed) continue;
      if (row.mode === 'timed') { aimed.target = command.targetId ?? null; aimed.world = command.world ?? null; }
      else {
        if (action.aim === 'facing') { eye(from); const cos = Math.cos(pitch); direction.set(-Math.sin(host.player.yaw) * cos, Math.sin(pitch), -Math.cos(host.player.yaw) * cos); }
        family.land(action.move, 0, from, direction); ports.landed?.(command.action, from, direction);
      }
    }
    if (row.mode === 'timed') family.advance(dt);
  }, { snapshot, restore });
  return { family, cracked: () => cracked };
}

/** Actual native owners borrowed by an admitted quest host; no body, mover or encounter is constructed here. */
export interface QuestHostPorts extends Omit<QuestGraphPorts, 'drive' | 'summon'> {
  /** Boolean observations such as a mover's enabled pose, keyed by the authored owner id. */
  readonly observations: ReadonlyMap<string, () => boolean>;
  /** Accepted external commands delivered to their original native owner. */
  readonly actions: ReadonlyMap<string, () => void>;
  /** Stage actions retain their native effect owner, keyed by director id. Flag actions are bound automatically. */
  readonly directorActions: ReadonlyMap<string, readonly DirectorActionBinding[]>;
}

/** Compose an admitted quest graph, bounded command routes and ordered director stages on their original fixed steps.
 * Required owners refuse before installation. Quiet seeds and individual continuation strings preserve existing saves;
 * a transient flag stage introduces no saved cursor. The caller still owns all body, mover and encounter lifetimes. */
export function installQuestHost(host: SimHost, quests: QuestData, input: QuestHostRow, ports: QuestHostPorts): ReturnType<typeof installQuestGraph> {
  const row = parseQuestHost(input);
  if (row.actors.ids.some(id => host.entities.get(id) === undefined)) throw new Error(row.actors.error);
  const observations = new Map<string, () => boolean>();
  const actions = new Map<string, () => void>();
  for (const observation of row.observations) {
    if (observation.kind === 'all-dead') {
      observations.set(observation.binding, () => observation.actors.every(id => host.entities.get(id)?.alive === false));
    } else {
      const owner = ports.observations.get(observation.owner);
      if (owner === undefined) throw new Error(`Unbound quest observation ${observation.owner}`);
      observations.set(observation.binding, owner);
    }
  }
  for (const route of row.commands.routes) {
    if (![...row.npcs.map(npc => npc.spot), ...ports.spots.interact.map(spot => spot.id), ...ports.spots.crack.map(spot => `crack.${spot.id}`)].includes(route.spot)) throw new Error(`Undeclared quest spot ${route.spot}`);
    if (route.action.kind === 'owner') {
      const owner = ports.actions.get(route.action.id);
      if (owner === undefined) throw new Error(`Unbound quest command ${route.action.id}`);
      actions.set(route.action.id, owner);
    }
  }
  const observe = (binding: string): boolean => {
    const owner = observations.get(binding);
    if (owner === undefined) throw new Error(`Unbound quest observation ${binding}`);
    return owner();
  };
  const stages = row.stages.map(stage => ({ row: stage, lane: bindDirectorActions(stage.row, {
    flags: host.flags, observe, bindings: ports.directorActions.get(stage.row.id) ?? [],
    initial: stage.seed !== undefined && host.flags.has(stage.seed.flag) ? stage.seed.initial : stage.initial,
  }) }));
  const requests = new Map(row.summons.map(request => {
    const stage = stages.find(candidate => candidate.row.row.id === request.director);
    if (stage === undefined) throw new Error(`Undeclared quest director ${request.director}`);
    return [request.target, stage.lane] as const;
  }));
  const routes = row.commands.routes.map(route => ({ ...route, condition: compileDirectorWhen(route.when, Object.keys(row.commands.inputs)) }));
  // Continuations are registered in authored order, before the interaction graph as on the shipping native hosts.
  for (const { row: stage, lane } of stages) {
    const saved = stage.continuation;
    if (saved !== undefined) host.onStep(saved.step, () => undefined, {
      snapshot: () => lane.snapshot(), restore: value => { if (typeof value !== 'string') throw new Error(saved.error); lane.restore(value); },
    });
  }
  const graph = installQuestGraph(host, { quests, graph: row.graph, interactions: row.interactions, npcs: row.npcs }, {
    ...ports, drive: row.drive, summon: target => { requests.get(target)?.advance(); },
  });
  if (row.commands.step !== null) host.onStep(row.commands.step, () => {
    const commands = ports.commands();
    for (let index = 0; index < 1024; index++) {
      const command = commands[index];
      if (command === undefined) break;
      if (command.actorId !== row.graph.actor) continue;
      const route = routes.find(candidate => candidate.value === command.value);
      if (route === undefined || !graph.near(route.spot)) continue;
      const values = Object.fromEntries(Object.entries(row.commands.inputs).map(([key, binding]) => [key, binding.startsWith('flag:') ? host.flags.has(binding.slice(5)) : observe(binding)]));
      if (!evaluateDirectorWhen(route.condition, values)) continue;
      if (route.action.kind === 'row') graph.run(route.action.id);
      else actions.get(route.action.id)?.();
    }
    for (const stage of stages) if (stage.row.tick) stage.lane.advance();
  });
  return graph;
}

/** Select only the admitted root composition; missing or unbound rows refuse before any borrowed owner is read. */
export function installDeclaredQuestHost(host: SimHost, source: Shardfile, ports: QuestHostPorts): ReturnType<typeof installQuestGraph> {
  if (source.questHost === undefined || source.questHost === null || source.runtime?.binds?.includes('quests') !== true) throw new Error('Missing admitted native quest host');
  return installQuestHost(host, source.quests, source.questHost, ports);
}



const nativeActorMetadata = v.object({ kind: v.string(), spec: v.unknown() });
const nativeWorldMetadata = v.object({ actors: v.array(nativeActorMetadata) });
const nativeQuestSpot = v.strictObject({ id: v.string(), x: bakedNumber, y: bakedNumber, z: bakedNumber, radius: v.pipe(bakedNumber, v.minValue(0)) });
const nativeQuestMetadata = v.object({ actors: v.array(nativeActorMetadata), bosses: v.array(nativeActorMetadata),
  spots: v.strictObject({ interact: v.array(nativeQuestSpot), crack: v.array(nativeQuestSpot) }), promptRegistrations: v.optional(v.unknown()) });
/** Read native actor metadata, requiring complete quest spots and boss rows when requested. Collision rows remain addBakedWorld's responsibility. */
export function readRuntimeWorldMetadata(input: unknown, quests: true): v.InferOutput<typeof nativeQuestMetadata>;
export function readRuntimeWorldMetadata(input: unknown): v.InferOutput<typeof nativeWorldMetadata>;
export function readRuntimeWorldMetadata(input: unknown, quests = false): v.InferOutput<typeof nativeWorldMetadata> | v.InferOutput<typeof nativeQuestMetadata> {
  return quests ? v.parse(nativeQuestMetadata, input) : v.parse(nativeWorldMetadata, input);
}
