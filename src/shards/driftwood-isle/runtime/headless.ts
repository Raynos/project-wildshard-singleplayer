import { installNativeMelee, trustedLevel } from '@wildshard/game/plugin/simulation';
import { bindHeadlessCommands, installNativeCollision, type PrepareHeadlessRuntime } from '@wildshard/sdk/headlessRuntime';
import { readNavmesh } from '@wildshard/engine/physics/navmesh';
import { DRIFTWOOD_SEA, LOWERED_SEA } from '../world/sea';
import { waveHeight } from '@wildshard/engine/world/waves';
import { driftwoodBake, driftwoodSpecs } from './baked';
import { installIsland } from './keeper';
import { installCaptain } from './captain';
import { prepareDriftwoodDirector, createDriftwoodFinale } from './director';
import NATIVE_SWORDS from '../data/nativeSwords.json' with { type: 'json' };
import { installDriftwoodKills } from './kills';
import { DRIFTWOOD_FEATS } from '../data/questInventory';
import { DRIFTWOOD_INTERACT } from '../data/interactables';
import { driftwoodSpots, installDriftwoodQuest } from './quest';
import { proveTerrainEntries } from '@wildshard/game/plugin/mover';
import { ENTRY_WALK } from '../data/entryWalk';
import { DayCycle } from '@wildshard/engine/world/dayCycle';
import { DRIFTWOOD_DAY, type Preset } from '../look/dayKeys';

/** The page's sky clock (look/backdrop.ts, Settings ▸ Time of day 'live', no `?tod`): it starts at 0.2 of the day phase
 *  (`0.2 * DAY`, DAY = 20 / 24) and runs a 48 min cycle (`CYCLE_S`); test/shards/driftwood-isle holds the two equal. */
export const DRIFTWOOD_DAY_START = 0.2 * (20 / 24), DRIFTWOOD_CYCLE_S = 48 * 60;
/**
 * Driftwood Isle's renderer-free trusted runtime (SF72, `@wildshard/sdk/headlessRuntime`). Owns: the Node-canonical native
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
 * The declared entry walk: every lane of the four 8 m entries walks up its flared sea ramp onto the deck.
 */
export const prepareHeadlessRuntime: PrepareHeadlessRuntime = async ({ shard, assets }) => {
  const navigation = shard.navigation === null ? undefined : assets.get(shard.navigation.file);
  if (navigation === undefined) throw new Error('Driftwood requires its admitted navigation asset');
  const createDirector = await prepareDriftwoodDirector();
  const bake = driftwoodBake(), specs = driftwoodSpecs(bake), heightAt = bake.floorAt, nav = readNavmesh(navigation, 'Driftwood declared navigation does not parse', () => 0), spots = driftwoodSpots();
  const level = trustedLevel(shard, { at: { x: shard.spawn.x, y: Math.max(shard.spawn.y, heightAt(shard.spawn.x, shard.spawn.z) + 0.1), z: shard.spawn.z },
    yaw: shard.spawn.yaw, speed: 5 }, { size: 500, height: 0 });
  return { level, ports: { ground: false, heightAt }, proveEntries: host => proveTerrainEntries(host.physics, shard.entryways, heightAt, ENTRY_WALK), install: (host, context) => {
    // the page's own day clock, stepped by the host before every tick's steps (a restoring install builds it again)
    const clock = new DayCycle<Preset>({ ...DRIFTWOOD_DAY, start: DRIFTWOOD_DAY_START });
    clock.cycle = DRIFTWOOD_CYCLE_S;
    host.useDayClock(clock);
    // The registered sea's dry entry sockets and rest height, with the page's Gerstner swell on this host's own clock.
    // Install before restore too: a saved swim cannot attach to a dry host. Never borrow the renderer's global wave clock.
    host.useWater({ surfaceAt: DRIFTWOOD_SEA.restAt, bob: (x, z) => waveHeight(x, z, host.clock.now) });
    if (!context.restoring) installNativeCollision(host, bake, { resolution: 256 });
    const island = installIsland(host, { bake, specs, seed: shard.identity.seed, waterLevel: LOWERED_SEA, spawnY: shard.spawn.y, nav }, context.snapshot);
    const captain = installCaptain(host, bake, island);
    const reward = { started: false, completed: false };
    const finale = createDriftwoodFinale(host.scope, createDirector(), { flags: host.flags, player: host.player.position, rewardAt: spots.reward, reward,
      captain: new Map([['captain.restore', () => { captain.publish('captain.restore'); }], ['captain.wake', () => { captain.publish('captain.wake'); }],
        ['captain.dead', () => { /* The native encounter already owns death. */ }]]) }, context.restoring);
    // the swords after the keeper: a swing's wake decides in the frame the keeper already stepped (a zero step)
    const input = bindHeadlessCommands(context), { fact, coins } = input.ledger;
    const held = installNativeMelee(host, shard.items.rows, NATIVE_SWORDS, { alarm: () => island.alarm(), staggered: (actor, strength, running) => island.staggered(actor, strength, running), input: input.melee });
    // the kill hooks: the sailor's flag and the kill feats' ledger facts
    installDriftwoodKills(host, DRIFTWOOD_FEATS, island.bodies, fact);
    // the quest and its interactables at the page's points: `script` commands on `driftwood.interact` (runtime/quest.ts)
    const zipline = shard.modes?.traverse.find(row => row.id === 'driftwood.zipline');
    if (zipline?.kind !== 'zipline') throw new Error('Driftwood requires its admitted zipline row');
    installDriftwoodQuest(host, { zipline, source: shard, table: DRIFTWOOD_INTERACT, spots, feats: DRIFTWOOD_FEATS, fact, coins, bodies: island.bodies,
      commands: input.scripts(),
      floorAt: (x, z) => Math.max(heightAt(x, z), bake.holdFloorAt(x, z) ?? Number.NEGATIVE_INFINITY), ironTaken: () => { held.equip(1); },
      finale, reward, waterLevel: LOWERED_SEA, restoring: context.restoring, walk: () => input.walk(level.player.speed) });
    // the bodies spawned in play (a new practice crab, the captain) reinstall after every install-time step
    island.settle();
    host.onStep('driftwood.poses', island.publishPoses, undefined, 'afterBodies');
  } };
};
