import type { HeadlessRuntimeInstallation, PrepareHeadlessRuntime } from '@wildshard/sdk/headlessRuntime';
import { SIM_API_VERSION, type SimHost, type SimLevel } from '@wildshard/engine/sim';
import { withOwner } from '@wildshard/engine/app/ownership';
import { tagCollider } from '@wildshard/engine/physics/surface';
import { parseNavmesh, type Navmesh } from '@wildshard/engine/physics/navmesh';
import { DRIFTWOOD_SEA, LOWERED_SEA } from '../world/sea';
import { waveHeight } from '@wildshard/engine/world/waves';
import { driftwoodBake, driftwoodSpecs, type DriftwoodBake } from './baked';
import { installIsland } from './keeper';
import { installCaptain } from './captain';
import { DriftwoodScriptFinale, prepareDriftwoodDirector } from './scriptFinale';
import { driftwoodSwordProfiles, installDriftwoodSwords } from './swords';
import { installDriftwoodKills } from './kills';
import { DRIFTWOOD_FEATS } from '../quest/rows';
import { DRIFTWOOD_INTERACT } from '../quest/interactables';
import { driftwoodSpots, installDriftwoodQuest } from './quest';
import { proveDriftwoodEntries } from './entries';
import navmeshBaked from './navmesh.baked.json' with { type: 'json' };
import { DayCycle } from '@wildshard/engine/world/dayCycle';
import { DRIFTWOOD_DAY, type Preset } from '../look/dayKeys';

/** The page's sky clock (look/backdrop.ts, Settings ▸ Time of day 'live', no `?tod`): it starts at 0.2 of the day phase
 *  (`0.2 * DAY`, DAY = 20 / 24) and runs a 48 min cycle (`CYCLE_S`); test/shards/driftwood-isle holds the two equal. */
export const DRIFTWOOD_DAY_START = 0.2 * (20 / 24), DRIFTWOOD_CYCLE_S = 48 * 60;
/** Driftwood's DayCycle exactly as its page sky builds it. */
export function driftwoodDayClock(): DayCycle<Preset> {
  const clock = new DayCycle({ ...DRIFTWOOD_DAY, start: DRIFTWOOD_DAY_START });
  clock.cycle = DRIFTWOOD_CYCLE_S;
  return clock;
}

/** The tick protocol's command allowance (sdk/tickProtocol.ts): a tick never carries more. */
const MAX_COMMANDS = 1024;

/** The browser's baked navmesh (public/assets/baked/driftwood-isle/navmesh.bin), from its exact-bytes copy
 *  (src/shards/driftwood-isle/generators/bake-driftwood-navmesh.mjs), parsed by the engine's renderer-free navmesh module. */
export function driftwoodNavmesh(): Navmesh {
  const bytes = Uint8Array.from(atob(navmeshBaked.bytes), c => c.codePointAt(0) ?? 0), nav = parseNavmesh(bytes.buffer);
  if (nav === null) throw new Error('Driftwood navmesh copy does not parse');
  // Baked points already include the island's world height; Node has no active page level.
  nav.datum = () => 0;
  return nav;
}

/** Install the browser-baked native world into the host's physics, owned by its scope: Rapier's own 256² heightfield (the
 *  sea cave's cut included) and the 2067 fixed WORLD colliders (cuboids, capsules and convex hulls) the page built. */
export function addDriftwoodWorld(host: SimHost, bake: DriftwoodBake): void {
  const { R, world } = host.physics, g = bake.ground;
  withOwner(host.scope, () => {
    const ground = world.createCollider(R.ColliderDesc.heightfield(255, 255, g.heights, g.scale).setTranslation(g.at.x, g.at.y, g.at.z).setCollisionGroups(g.groups).setFriction(g.friction));
    tagCollider(ground, 'ground');
    bake.solids.forEach(solid => {
      const desc = solid.shape === 1 && solid.half !== undefined ? R.ColliderDesc.cuboid(solid.half[0], solid.half[1], solid.half[2])
        : solid.shape === 2 && solid.halfHeight !== undefined && solid.radius !== undefined ? R.ColliderDesc.capsule(solid.halfHeight, solid.radius)
          : solid.shape === 9 && solid.points !== undefined ? R.ColliderDesc.convexHull(solid.points) : null;
      if (desc === null) throw new Error(`Unbuildable baked Driftwood collider shape ${String(solid.shape)}`);
      world.createCollider(desc.setTranslation(solid.at[0], solid.at[1], solid.at[2]).setRotation({ x: solid.rot[0], y: solid.rot[1], z: solid.rot[2], w: solid.rot[3] })
        .setCollisionGroups(solid.groups).setFriction(solid.friction));
    });
  });
}

/**
 * Driftwood Isle's renderer-free trusted runtime (SF72, `@wildshard/sdk/headlessRuntime`). Owns: the browser-baked native
 * world (the island's heightfield as Rapier built it and every fixed WORLD collider; `ground: false`, the baked floor as
 * the height query) and the island's 34 load-time creatures with their stream, floors, herds, decisions (the fauna by the
 * browser's baked navmesh), the monkeys' coconuts, the practice crab's return, ecological night respawns and exact restore (runtime/keeper.ts), and the
 * Drowned Captain's finale (the altar's flag spawns and wakes him; his fight and encounter are the browser's own,
 * runtime/captain.ts), and the two swords on the swept melee family's own clock (light taps, held heavy, lunge/dodge;
 * runtime/swords.ts), and the kill hooks (`dead:sailor` and the kill feats' ledger facts, runtime/kills.ts), and
 * "The Sealed Ring" with the island's interactables at the page's baked points (`script` commands on `driftwood.interact`:
 * Wendell, the chest, the beacon, the hold key / pump / winch / strongbox, the shards, the plates and the sluice, the altar,
 * the reward beat, the iron sword's pickup; the flag feats' ledger facts, runtime/quest.ts).
 * the puzzle barrel the player pushes onto the second tide plate (the kit's body and never-jam rule), and the open sluice.
 * The entry proof (runtime/entries.ts): every lane of the four 8 m entries walks up its flared sea ramp onto the deck.
 */
/** The walk the tick's last `player` command asks for (m/s): the host's walk (SimHost.step: the stick clamped to 1, times
 * the level's speed), the velocity the page's Player asks for and the barrel's watch reads. */
function walkOf(list: ReturnType<HeadlessRuntimeInstallation['commands']>, speed: number): { x: number; z: number } {
  let x = 0, z = 0;
  for (let i = 0; i < MAX_COMMANDS; i++) { const command = list[i]; if (command === undefined) break; if (command.kind === 'player') { x = command.moveX; z = command.moveZ; } }
  const len = Math.hypot(x, z), k = len > 1 ? speed / len : speed;
  return { x: x * k, z: z * k };
}

export const prepareHeadlessRuntime: PrepareHeadlessRuntime = async ({ shard }) => {
  const createDirector = await prepareDriftwoodDirector();
  const bake = driftwoodBake(), specs = driftwoodSpecs(bake), heightAt = bake.floorAt, nav = driftwoodNavmesh(), swords = driftwoodSwordProfiles(shard.items.rows), spots = driftwoodSpots();
  const level: SimLevel = { version: SIM_API_VERSION, id: shard.identity.slug, seed: shard.identity.seed, ground: { size: 500, height: 0 },
    player: { at: { x: shard.spawn.x, y: Math.max(shard.spawn.y, heightAt(shard.spawn.x, shard.spawn.z) + 0.1), z: shard.spawn.z }, yaw: shard.spawn.yaw, speed: Math.min(5, shard.authorCaps.speed) },
    // the host's player strike is a zero-damage probe, never a sword: the swords are declared items (runtime/swords.ts)
    entities: [], quests: [], weapon: { id: 'host.probe', shape: { kind: 'point', radius: 1 }, windup: 0.1, active: 0.1, recover: 0.2, cooldown: 0.3, range: 1, damage: 0, tags: [] } };
  return { level, ports: { ground: false, heightAt }, proveEntries: host => proveDriftwoodEntries(host.physics, shard.entryways), install: (host, context) => {
    // the page's own day clock, stepped by the host before every tick's steps (a restoring install builds it again)
    host.useDayClock(driftwoodDayClock());
    // The registered sea's dry entry sockets and rest height, with the page's Gerstner swell on this host's own clock.
    // Install before restore too: a saved swim cannot attach to a dry host. Never borrow the renderer's global wave clock.
    host.useWater({ surfaceAt: DRIFTWOOD_SEA.restAt, bob: (x, z) => waveHeight(x, z, host.clock.now) });
    if (!context.restoring) addDriftwoodWorld(host, bake);
    const island = installIsland(host, { bake, specs, seed: shard.identity.seed, waterLevel: LOWERED_SEA, spawnY: shard.spawn.y, nav }, context.snapshot);
    const captain = installCaptain(host, bake, island);
    const observation = { altar: 0, dead: 0, seen: 0, 'player-x': 0, 'player-z': 0, 'reward-x': spots.reward.x, 'reward-z': spots.reward.z };
    const finale = new DriftwoodScriptFinale(createDirector(), { observe: () => {
      observation.altar = Number(host.flags.has('used:altar')); observation.dead = Number(host.flags.has('dead:captain'));
      observation.seen = Number(host.flags.has('seen:reward')); observation['player-x'] = host.player.position.x; observation['player-z'] = host.player.position.z;
      return observation;
    }, publish: event => {
      if (event === 'captain.restore' || event === 'captain.wake') captain.publish(event);
      else if (event === 'reward.finish') host.flags.set('seen:reward');
      // The native encounter owns death; the renderer owns reward caption/camera presentation.
    } }, context.restoring);
    const offFinale = host.flags.onChange((flag, on) => { if (on && (flag === 'used:altar' || flag === 'dead:captain')) finale.changed(); });
    host.scope.onDispose(offFinale);
    // the swords after the keeper: a swing's wake decides in the frame the keeper already stepped (a zero step)
    const input = { attack: null as string | null, heavy: false, heavyTarget: null as string | null };
    const held = installDriftwoodSwords(host, swords, island, () => {
      input.attack = null; input.heavy = false; input.heavyTarget = null;
      const list = context.commands();
      for (let i = 0; i < MAX_COMMANDS; i++) {
        const command = list[i]; if (command === undefined) break;
        if (command.kind === 'player') { input.attack = command.attack?.targetId ?? null; input.heavy = command.heavy !== undefined; input.heavyTarget = command.heavy?.targetId ?? null; }
      }
      return input;
    });
    const fact = (name: string, actorId: string): void => { context.emit({ kind: 'fact', name, actorId }); };
    const coins = (amount: number, actorId: string): void => { context.emit({ kind: 'coins', amount, actorId }); };
    // the kill hooks: the sailor's flag and the kill feats' ledger facts
    installDriftwoodKills(host, DRIFTWOOD_FEATS, island.bodies, fact);
    // the quest and its interactables at the page's points: `script` commands on `driftwood.interact` (runtime/quest.ts)
    installDriftwoodQuest(host, { quests: shard.quests, table: DRIFTWOOD_INTERACT, spots, feats: DRIFTWOOD_FEATS, fact, coins, bodies: island.bodies,
      commands: () => context.commands().flatMap(command => command.kind === 'script' ? [command] : []),
      floorAt: (x, z) => Math.max(heightAt(x, z), bake.holdFloorAt(x, z) ?? Number.NEGATIVE_INFINITY), ironTaken: () => { held.equip(1); },
      finale, waterLevel: LOWERED_SEA, restoring: context.restoring, walk: () => walkOf(context.commands(), level.player.speed) });
    // the bodies spawned in play (a new practice crab, the captain) reinstall after every install-time step
    island.settle();
    host.onStep('driftwood.poses', island.publishPoses, undefined, 'afterBodies');
  } };
};
