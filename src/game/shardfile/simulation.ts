import { createSimHost, SIM_API_VERSION, type SimHost, type SimHostPorts, type SimStrike, type SimValue } from '@wildshard/engine/sim';
import { buildPlatformSpawns } from '@wildshard/engine/ai/platform';
import { addBakedTerrainCollider } from '@wildshard/engine/physics/terrainTiles';
import { decodeTerrainTile, terrainTileHeight } from '@wildshard/engine/world/terrainTileData';
import { fnv1a32 } from '@wildshard/engine/core/rng';
import { installScriptLane, type ScriptLanePort } from '@wildshard/engine/script/lane';
import type { EffectRules, ScriptEntity } from '@wildshard/engine/script/effects';
import { declaredWaterBody } from '@wildshard/engine/world/water/declared';
import { WaterBodies } from '@wildshard/engine/world/water/body';
import type { PropColliderPort, PropColliderState } from '@wildshard/engine/physics/declaredProps';
import { floorBelow } from '@wildshard/engine/physics/query';
import { installShardfileColliders, shardfileColliderIds } from './collisionBindings';
import { validateMeshCollisionAssets } from './meshCollision';
import { validateMeshEntryways } from './meshEntryways';
import { clientGround } from './clientGround';
import { declaredItemScriptEntities } from './items';
import { syncTargetColliders } from './targets';
import { scriptPhysicsQueries } from '@wildshard/engine/script/queries';
import { createQuestScriptPorts, DeclaredQuests, type QuestDataPorts, type QuestScriptBindings } from '../quest/declared';
import { installDeclaredEncounters } from '../shard/declaredEncounters';
import type { Shardfile } from './schema';
import { speciesResolver, simStrikes } from './rows';
import { createShardfileScriptLane, type ShardScriptPorts } from './scripts';
import { installDeclaredBrains, type DeclaredBrainPorts } from './brainRuntime';
import { createShardfileComposedLane, type DeclaredScriptBrainPorts } from './scriptComposition';
import { prepareDeclaredGroupBrains, type DeclaredGroupPorts, type DeclaredGroupPolicy } from './groupRuntime';
import { prepareDeclaredCrowds, type DeclaredCrowdPorts, type PreparedCrowds } from './crowdRuntime';
import { MoverScriptDriver } from './moverDriver';
import { MoverRuntime } from './moverRuntime';
import { socketLiftEntries } from './socketLift';
import { portalLinkEntries, portalLinkRules } from './portalLink';
import { validatePortalFloors } from './portalFloor';
import { portalTransitioning } from './portalTraversal';
import { LiftRiderSchema, captureLiftRider, restoreLiftRider, type LiftRider } from './liftRider';
import * as v from 'valibot';
import { installEntrySockets } from '@wildshard/engine/physics/entrySockets';

/** Positive stable actor handle; reordering spawns changes nothing. Hash collisions are refused during composition. */
export function numericScriptEntityId(id: string): number { return (fnv1a32(id) & 0x7fffffff) || 1; }
/** The existing client can lend its physics/player/fixed-step driver; Node owns them by default. */
export interface ShardfileSimPorts extends SimHostPorts {
  weapon?: SimStrike; quest?: QuestDataPorts; hooks?: QuestScriptBindings; scriptRules?: EffectRules;
  encounters?: Parameters<typeof installDeclaredEncounters>[2]; hud?: Parameters<typeof installDeclaredEncounters>[3];
  water?: WaterBodies; colliders?: ReadonlyMap<string, PropColliderPort>;
  /** Trusted native actor recipes; a declaration without its required family port refuses boot. */
  brains?: DeclaredBrainPorts;
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
  restoring?: boolean;
  /** The normal client or regional registry already owns its four platform sockets. */
  entrySocketsProvided?: boolean;
  /** G168: a declared module crossed its failure limit and stays off (the client tells the player; Node ignores it). */
  scriptDisabled?: ShardScriptPorts['onDisabled'];
}
/** Authoritative handles for UI, quests and the existing client fixed-step driver. */
export interface ShardfileSimulation {
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
  const weapon = ports.weapon ?? { id: 'host.probe', shape: { kind: 'point', radius: 1 }, windup: 0.1, active: 0.1, recover: 0.2, cooldown: 0.3, range: 1, damage: 0, tags: [] };
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
    const groupIds = new Set(shard.creatures.groups.map((group) => group.id));
    const preparedGroups = prepareDeclaredGroupBrains(host, shard.creatures.groups, shard.creatures.spawns, ports.groups ?? {},
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
      const installedMover: { current?: MoverRuntime } = {};
      const moverDriver = shard.movers.length === 0 ? undefined : new MoverScriptDriver(shard.movers, options.query, [...resetMovers]);
      const extra = moverDriver === undefined ? undefined : { roles: [moverDriver.role()], transientModules: moverDriver.transientModules,
        schedules: [moverDriver.schedule(() => { const current = installedMover.current; if (current === undefined) throw new Error('Missing mover runtime'); return current; })] };
      if (brainBindings.length > 0) {
        if (ports.scriptBrains === undefined) throw new Error('Missing custom brain port');
        const trustedBrains = ports.scriptBrains(host);
        if (typeof trustedBrains.ports.observe !== 'function' || typeof trustedBrains.ports.mayAttack !== 'function' || typeof trustedBrains.ports.strike !== 'function') throw new Error('Missing custom brain observation or strike recipe');
        lane = createShardfileComposedLane(shard, assets, options, { ...trustedBrains, query: trustedBrains.query ?? options.query, actors: host.entities, bindings: brainBindings }, extra);
      } else lane = extra === undefined ? createShardfileScriptLane(shard, assets, options) : createShardfileComposedLane(shard, assets, options, undefined, extra);
      if (moverDriver !== undefined) {
        const runtime = new MoverRuntime(shard.movers, { host: lane.host, physics: () => host.physics, scope: host.scope, ...(ports.restoring === undefined ? {} : { restoring: ports.restoring }) });
        movers = runtime; installedMover.current = runtime;
        host.onStep('movers.declared', () => { runtime.capture(); }, { snapshot: () => runtime.snapshotState(resetMovers), restore: value => {
          if (typeof value !== 'string') throw new Error('Invalid mover continuation'); runtime.restoreState(value);
        }, physicsRestored: () => { runtime.reconnect(resetMovers); } });
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
    installDeclaredBrains(host, shard.creatures.spawns.filter((spawn) => spawn.brain === null || (!custom.has(spawn.brain) && !groupIds.has(spawn.brain))), shard.creatures.brains.filter((brain) => brain.kind !== 'script'), ports.brains);
    const encounters = installDeclaredEncounters(host, shard.encounters, ports.encounters ?? (() => ({ saved: { defeated: false, rewardTaken: false, kills: 0 }, persist: () => undefined, reward: () => undefined })), ports.hud);
    // All individual/custom aliases and encounter recipes have admitted successfully before setup draws or group work.
    const groups = preparedGroups.install(ports.restoring ?? false);
    if (!host.embedded && !ports.restoring) host.physics.step();
    // Crowd setup is last: all scripts, actor/group controllers, quests, encounters and physics have admitted.
    const crowds = preparedCrowds.install(host, ports.restoring ?? false);
    return { host, lane, actors, quest, encounters, water, colliders, groups, crowds, movers, dispose: () => { host.dispose(); } };
  } catch (error) { host.dispose(); throw error; }
}
