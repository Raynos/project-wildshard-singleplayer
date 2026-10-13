import { Vector3 } from 'three';
import type { HeadlessRuntimeInstallation, HeadlessRuntimePlan, HeadlessRuntimePreparation, PrepareHeadlessRuntime } from '@wildshard/sdk/headlessRuntime';
import { createSimHost, type SimHost } from '@wildshard/engine/sim';
import type { AnimalSimSpec } from '@wildshard/engine/entities/AnimalSim';
import { bakedSpecs, speciesScales } from '@wildshard/game/plugin/brain';
import { floorBelow } from '@wildshard/engine/physics/query';
import { installEntrySockets } from '@wildshard/engine/physics/entrySockets';
import { installDeclaredPropColliders } from '@wildshard/engine/physics/declaredProps';
import { propColliderDescriptors } from '@wildshard/game/shardfile/props';
import { addBakedWorld, ledgerPorts, proveEntryways, pickCommands, trustedLevel, weaponRow } from '@wildshard/game/plugin/simulation';
import { DECK, SPAWN } from '../data/layout';
import { DRIFT_RAY_DATA, GALE_WISP_DATA, SKY_GOAT_DATA, STORM_ROC_DATA } from '../data/species';
import { installSkyFlock, SKY_ANALYTIC_FLOOR } from './flock';
import { installBossOwnerRow } from '@wildshard/game/shardfile/bossRow';
import { ROC_OWNER } from '../data/rocFight';
import { coneStrikeSpec } from './weapons/coneStrikes';
import { FAN_ID } from '../data/items';
import { FAN_ACT, FAN_ACTOR, FAN_AIM, installSkyFan, type FanCommand } from './fan';
import { installSkyQuest, skyWinchPermission } from './quest';
import { SKY_MOVER_BINDING } from '../data/moverBindings';
import { UpdraftDriver, installHeadlessMovers, verifiedMoverModules, type HeadlessMovers } from '@wildshard/game/plugin/mover';
import baked from './physics.baked.json' with { type: 'json' };

/** The baked native specs by kind (generators/bake-sky-physics.mjs); every body of a kind shares one recipe. */
export const skySpecs = (): ReadonlyMap<string, AnimalSimSpec> => bakedSpecs(baked.actors);
/** Each kind's variant scale range (the species rows' first variant): the manager's first draw. */
export const skyScaleRanges = (): ReadonlyMap<string, readonly [number, number]> => speciesScales([DRIFT_RAY_DATA, SKY_GOAT_DATA, GALE_WISP_DATA, STORM_ROC_DATA]);

/** The updraft's fixed-step id (its whole state is the player's board and impulse, so it carries no continuation). */
export const UPDRAFT_STEP = 'far.updraft';

/**
 * Sky Reach's renderer-free trusted runtime (SF72, `@wildshard/sdk/headlessRuntime`). A structures-only world: no terrain
 * collider (`ground: false`), the analytic placement floor at -1000 m, and every island, rope bridge, dock, lip and prop
 * the browser registers, from the Node-baked native colliders (the hover decks and the updraft ramp collide only on the
 * board, through the host's board mode; the fallen crown bridge stays out), with the host's layered WORLD floor queries
 * for flight and falls. Owns the 13 declared bodies and their shipping policies (runtime/flock.ts) and the Storm Roc's encounter (data/rocFight.ts: authored BossBrain owner, its
 * fact and purse) and the War Fan (runtime/fan.ts: the browser fan's own move recipe; a `player.attack` is its light
 * SWING, `far.fan` script commands its HEAVY and GUST at the `far.fan.aim` pitch; locked through the Roc's intro, stowed on the board), the
 * quest (runtime/quest.ts: its four steps, its fact and 10 coins once) and the movers (the admitted track/trigger/driver rows:
 * Rising Islets, their road gates and the winch bridge on their admitted modules, an exact continuation across a native
 * restore) and the updraft's lift on the board (the admitted modes row). `finish` proves all four Rising Islet entries by a
 * real capsule traversal on fresh hosts of this world.
 */
export const prepareHeadlessRuntime: PrepareHeadlessRuntime = async (input) => (await prepareSkyRuntime(input)).plan;

/** Sky's prepared runtime: the SDK plan, and its install returning the movers it built (the witness rides and calls them). */
export interface SkyRuntime {
  readonly plan: HeadlessRuntimePlan;
  readonly installSky: (host: SimHost, context: HeadlessRuntimeInstallation) => HeadlessMovers;
}
export async function prepareSkyRuntime({ shard, assets, rapier }: HeadlessRuntimePreparation): Promise<SkyRuntime> {
  const fanRow = weaponRow(shard, FAN_ID), fanSpec = coneStrikeSpec(fanRow, fanRow.profile);
  const updraft = shard.modes?.traverse.find(row => row.id === 'far.updraft');
  if (updraft?.kind !== 'updraft') throw new Error('Sky Reach requires its admitted updraft row');
  if (shard.terrain !== null) throw new Error('Sky Reach is a structures-only world');
  // the islet and bridge modules, admitted in shard.config.ts `files`, hash-checked once here (install is synchronous)
  const moverRows = shard.movers.filter(row => !row.id.startsWith(SKY_MOVER_BINDING.staticPrefix));
  const modules = await verifiedMoverModules(assets, moverRows);
  const specs = skySpecs(), ranges = skyScaleRanges();
  // the shipping spawn (manifest `spawn`, layout SPAWN) standing on Sunrest's deck, not the shardfile's grid datum; the
  // host's player strike is the zero-damage probe, never the War Fan (a declared item, data/items.ts)
  const level = trustedLevel(shard, { at: { x: SPAWN.x, y: DECK, z: SPAWN.z }, yaw: SPAWN.yaw, speed: 5 }, { size: 500, height: SKY_ANALYTIC_FLOOR });
  const ports = { ground: false, heightAt: () => SKY_ANALYTIC_FLOOR } as const;
  const installSky = (host: SimHost, context: HeadlessRuntimeInstallation): HeadlessMovers => {
    // every piece the browser collides with on foot, plus the board-only ones (the hover decks and the updraft ramp, baked
    // `mode: 'board'`) in the host's board mode; a restore brings them back with the physics (SimSnapshot.boardColliders)
    if (!context.restoring) addBakedWorld(host, baked.pieces);
    host.setFloorQuery((x, z, fromY, maxDrop) => floorBelow(host.physics, x, z, fromY, maxDrop));
    const movers = installHeadlessMovers(host, moverRows, modules, {
      systemId: SKY_MOVER_BINDING.systemId, restoring: context.restoring,
      initialPermissions: new Map([[SKY_MOVER_BINDING.winch, 0]]),
      permissions: () => new Map([[SKY_MOVER_BINDING.winch, skyWinchPermission(host.flags)]]),
    });
    const flock = installSkyFlock(host, { specs, ranges, seed: shard.identity.seed }, context.snapshot);
    const ledger = ledgerPorts(context.emit);
    const encounter = installBossOwnerRow(host, ROC_OWNER, { body: { kind: 'held', actor: flock.roc.actor, brain: flock.roc.body }, ...ledger });
    const fan = pickCommands(context.commands, (command): FanCommand | undefined => {
      if (command.kind === 'player') return command.attack === undefined ? undefined : { kind: 'swing', targetId: command.attack.targetId };
      if (command.kind === 'script' && command.actorId === FAN_AIM) return { kind: 'aim', pitch: command.value };
      if (command.kind !== 'script' || command.actorId !== FAN_ACTOR) return undefined;
      return command.value === FAN_ACT.heavy ? { kind: 'heavy' } : command.value === FAN_ACT.gust ? { kind: 'gust' } : undefined;
    }), none: FanCommand[] = [];
    // the browser disables the player's weapons through the Roc's intro (BossPorts.lockInput) and stows the fan on the board
    installSkyFan(host, () => encounter.locked() || host.playerBoard.on ? none : fan(), fanSpec);
    installSkyQuest(host, { quests: shard.quests, ...ledger, commands: pickCommands(context.commands, command => command.kind === 'script' ? command : undefined),
      winch: { command: () => { movers.runtime.command(SKY_MOVER_BINDING.winch, 1); }, raised: () => movers.runtime.pose(SKY_MOVER_BINDING.winch).enabled } });
    // the updraft (G24): riding the board inside its column, a steady upward push through the host impulse, as the
    // browser's `far.updraft` fixed.pre system; read after this tick's move, it feeds the next one, as the browser's does
    const force = new UpdraftDriver(updraft), lift = new Vector3();
    host.onStep(UPDRAFT_STEP, dt => {
      force.step(dt, host.player.position, host.playerBoard.on, lift.set(0, 0, 0));
      if (lift.y !== 0) host.impulsePlayer(lift);
    });
    flock.land();
    return movers;
  };
  const plan: HeadlessRuntimePlan = { level, ports, install: (host, context) => { installSky(host, context); }, proveEntries: () => proveEntryways(shard, assets, { world: () => {
    // Every Rising Islet entry on a fresh host of this same world (the baked colliders, the movers), plus what the grid
    // adds around a cell: the road's entry socket decks and the shardfile's declared landing / gate-isle colliders. The
    // platform's socket-lift proof walks a real capsule in from the road, boards, rides, walks the onward route, calls both
    // stops and probes the closed road gate across all 23 lanes, on actual fixed steps of the host.
    const fresh = createSimHost(level, { ...ports, rapier });
    try {
      addBakedWorld(fresh, baked.pieces);
      installEntrySockets(fresh.physics, fresh.scope, [{ x: 0, z: 0 }]);
      installDeclaredPropColliders(shard.props === null ? [] : propColliderDescriptors(shard.props), () => fresh.physics, fresh.scope);
      const movers = installHeadlessMovers(fresh, moverRows, modules, {
        systemId: SKY_MOVER_BINDING.systemId, restoring: false,
        initialPermissions: new Map([[SKY_MOVER_BINDING.winch, 0]]),
        permissions: () => new Map([[SKY_MOVER_BINDING.winch, 0]]),
      });
      return { physics: fresh.physics, movers: movers.runtime, dispose: () => { fresh.dispose(); },
        fixedStep: () => { fresh.step(); if (movers.failures() !== 0) throw new Error('Sky Reach mover script call failed'); } };
    } catch (error) { fresh.dispose(); throw error; }
  } }) };
  return { plan, installSky };
}
