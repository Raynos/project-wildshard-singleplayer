import { Vector3 } from 'three';
import type { HeadlessRuntimeInstallation, PrepareHeadlessRuntime } from '@wildshard/sdk/headlessRuntime';
import type { SimHost } from '@wildshard/engine/sim';
import { floorBelow } from '@wildshard/engine/physics/query';
import { addBakedWorld, installDeclaredQuestHost, ledgerPorts, pickCommands, trustedLevel, weaponRow, createMeleeScriptDriver, MeleeScriptDriver, installNativeMelee, type NativeMeleeCommand } from '@wildshard/game/plugin/simulation';
import { DECK, SPAWN, VANES } from '../data/layout';
import { SKY_ANALYTIC_FLOOR } from '../data/spawns';
import { SKY_NATIVE_POPULATION } from '../data/population';
import { prepareNativePopulation } from '@wildshard/game/shardfile/bossRow';
import { ROC_OWNER } from '../data/rocFight';
import { FAN_ID } from '../data/items';
import { FAN_ACT, FAN_ACTOR, FAN_AIM } from '../data/nativeMelee';
import { turnVanes, VANE_HUB } from '../quest/vanes';
import { skyWinchPermission } from './quest';
import { SKY_SPOTS } from '../data/questPrompts';
import { SKY_MOVER_BINDING } from '../data/moverBindings';
import { UpdraftDriver, MoverScriptDriver, verifiedMoverModules } from '@wildshard/game/plugin/mover';
import baked from '../data/physics.generated.json' with { type: 'json' };

/** The updraft's fixed-step id (its whole state is the player's board and impulse, so it carries no continuation). */
export const UPDRAFT_STEP = 'far.updraft';

/** The shipping native world, bodies, quest and movers in a renderer-free host. */
export const prepareHeadlessRuntime: PrepareHeadlessRuntime = async ({ shard, assets }) => {
  const fanRow = weaponRow(shard, FAN_ID);
  // Prepare detached, verified module bytes; every actual host binds its own player and role below.
  const itemModules = (await createMeleeScriptDriver(shard.items, 'actor.player', assets, shard.identity.seed)).modules;
  const updraft = shard.modes?.traverse.find(row => row.id === 'far.updraft');
  if (updraft?.kind !== 'updraft') throw new Error('Sky Reach requires its admitted updraft row');
  if (shard.terrain !== null) throw new Error('Sky Reach is a structures-only world');
  // the islet and bridge modules, admitted in shard.config.ts `files`, hash-checked once here (install is synchronous)
  const moverRows = shard.movers.filter(row => !row.id.startsWith(SKY_MOVER_BINDING.staticPrefix));
  const modules = await verifiedMoverModules(assets, moverRows);
  const installMovers = (host: SimHost, restoring: boolean, permissions: () => ReadonlyMap<string, number>) => {
    const driver = new MoverScriptDriver(moverRows, host);
    const items = new MeleeScriptDriver(shard.items, host.player.id, itemModules, shard.identity.seed);
    const composedModules = new Map([...modules, ...items.modules]);
    const content = { identity: shard.identity, sim: { scripts: [...composedModules.keys()], bindings: [], scriptTickDivisor: 1 }, state: { shared: [], player: [] } };
    const lane = driver.compose(content, composedModules, { rules: { fields: {}, archetypes: [], events: [], maxEntities: 32 }, entities: [], actors: new Map(), query: () => [] }, undefined, permissions, { roles: [items.role()] });
    const runtime = driver.install(host, lane, { id: SKY_MOVER_BINDING.systemId, restoring, drive: true,
      activation: { ground: () => host.hasPlayerMotor ? host.player.motor.result : undefined } });
    return { runtime, failures: () => lane.host.failureCount, hook: items.hooks(lane.host).get(FAN_ID) ?? null, hookTick: () => lane.host.currentTick };
  };
  const population = prepareNativePopulation({ ...SKY_NATIVE_POPULATION, seed: shard.identity.seed }, baked.actors, ROC_OWNER);
  // the shipping spawn (manifest `spawn`, layout SPAWN) standing on Sunrest's deck, not the shardfile's grid datum; the
  // host's player strike is the zero-damage probe, never the War Fan (a declared item, data/items.ts)
  const level = trustedLevel(shard, { at: { x: SPAWN.x, y: DECK, z: SPAWN.z }, yaw: SPAWN.yaw, speed: 5 }, { size: 500, height: SKY_ANALYTIC_FLOOR });
  const ports = { ground: false, heightAt: () => SKY_ANALYTIC_FLOOR } as const;
  const install = (host: SimHost, context: HeadlessRuntimeInstallation): void => {
    // every piece the browser collides with on foot, plus the board-only ones (the hover decks and the updraft ramp, baked
    // `mode: 'board'`) in the host's board mode; a restore brings them back with the physics (SimSnapshot.boardColliders)
    if (!context.restoring) addBakedWorld(host, baked.pieces);
    host.setFloorQuery((x, z, fromY, maxDrop) => floorBelow(host.physics, x, z, fromY, maxDrop));
    const movers = installMovers(host, context.restoring, () => new Map([[SKY_MOVER_BINDING.winch, skyWinchPermission(host.flags)]]));
    const ledger = ledgerPorts(context.emit);
    const { keeper, encounter } = population.install(host, ledger, context.snapshot);
    const fan = pickCommands(context.commands, (command): NativeMeleeCommand | undefined => {
      if (command.kind === 'player') return command.attack === undefined ? undefined : { kind: 'move', action: 0, targetId: command.attack.targetId };
      if (command.kind === 'script' && command.actorId === FAN_AIM) return { kind: 'aim', pitch: command.value };
      if (command.kind !== 'script' || command.actorId !== FAN_ACTOR) return undefined;
      return command.value === FAN_ACT.heavy ? { kind: 'move', action: 1 } : command.value === FAN_ACT.gust ? { kind: 'move', action: 2 } : undefined;
    }), none: NativeMeleeCommand[] = [];
    // the browser disables the player's weapons through the Roc's intro (BossPorts.lockInput) and stows the fan on the board
    const vanes = VANES.map(vane => ({ id: vane.id, at: new Vector3(vane.x, vane.y + VANE_HUB, vane.z) }));
    installNativeMelee(host, fanRow, fanRow.native, { commands: () => encounter.locked() || host.playerBoard.on ? none : fan(),
      hook: movers.hook, hookTick: movers.hookTick, landed: (action, from, dir) => { if (action === 2) turnVanes(host.flags, vanes, from, dir); } });
    installDeclaredQuestHost(host, shard, { ...ledger, commands: pickCommands(context.commands, command => command.kind === 'script' ? command : undefined),
      spots: { interact: SKY_SPOTS, crack: [] }, observations: new Map([['winch-up', () => movers.runtime.pose(SKY_MOVER_BINDING.winch).enabled]]),
      actions: new Map([['winch', () => { movers.runtime.command(SKY_MOVER_BINDING.winch, 1); }]]), directorActions: new Map() });
    // the updraft (G24): riding the board inside its column, a steady upward push through the host impulse, as the
    // browser's `far.updraft` fixed.pre system; read after this tick's move, it feeds the next one, as the browser's does
    const force = new UpdraftDriver(updraft), lift = new Vector3();
    host.onStep(UPDRAFT_STEP, dt => {
      force.step(dt, host.player.position, host.playerBoard.on, lift.set(0, 0, 0));
      if (lift.y !== 0) host.impulsePlayer(lift);
    });
    keeper.settle();
  };
  return { level, ports, install };
};
