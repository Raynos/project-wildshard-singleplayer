import { bindDirectorActions } from '@wildshard/game/plugin/director';
import signalStages from '../data/signalStages.json' with { type: 'json' };
import { FLAG } from '../data/flags';
import * as v from 'valibot';
import { addBakedWorld, admittedTerrain, ledgerPorts, pickCommands, trustedLevel, weaponRow, installNativeMelee, type NativeMeleeCommand, type NativeMeleeWorld, type NativeMeleeOwner } from '@wildshard/game/plugin/simulation';
import { prepareNativePopulation } from '@wildshard/game/shardfile/bossRow';
import { installQuestGraph, type QuestGraphPorts } from '@wildshard/game/plugin/quests';
import { proveTerrainEntries } from '@wildshard/game/plugin/mover';
import { parsePromptRegistrations } from '@wildshard/sdk/runtime/prompts';
import type { PrepareHeadlessRuntime } from '@wildshard/sdk/headlessRuntime';
import { SIGNAL_NATIVE_POPULATION } from '../data/population';
import { SIGNAL_HEADLESS, SIGNAL_BOSS_OWNER } from '../data/headlessOwners';
import { SIGNAL_LEVEL } from '../data/headlessLevel';
import baked from '../data/physics.generated.json' with { type: 'json' };
import { SignalLashInput } from './lashInput';

const finite = v.pipe(v.number(), v.finite());
const Spot = v.strictObject({ id: v.string(), x: finite, y: finite, z: finite, radius: v.pipe(finite, v.minValue(0)) });
/** The bake's native metadata (generators/physics.ts, authored rows only); its pieces are admitted strictly by `addBakedWorld`. */
const Baked = v.object({ actors: v.array(v.object({ kind: v.string(), spec: v.unknown() })), bosses: v.array(v.object({ kind: v.string(), spec: v.unknown() })),
  spots: v.strictObject({ interact: v.array(Spot), crack: v.array(Spot) }), promptRegistrations: v.optional(v.unknown()) });
/** The baked prompt spots and crack targets (the built world's order), strictly. */
export function bakedSpots(input: unknown): QuestGraphPorts['spots'] { return v.parse(Baked, input).spots; }

/** The held whip input's quiet continuation; the existing lash adapter owns unroll, cooldown and both contacts. */
export const SIGNAL_LASH_INPUT = 'sunscar.whip-input';
const manifest = { ...SIGNAL_HEADLESS, baked };

/** Compose Signal's existing native owners in-shard, preserving their install order and adding the shipping hold/release input. */
export const prepareSignalRuntime: PrepareHeadlessRuntime = ({ shard, assets }) => {
  const rows = v.parse(Baked, baked), spots = rows.spots;
  const { boss, quest } = manifest, terrain = admittedTerrain(shard, assets), { heightAt } = terrain;
  const population = prepareNativePopulation(SIGNAL_NATIVE_POPULATION, [...rows.actors, ...rows.bosses], SIGNAL_BOSS_OWNER);
  const row = weaponRow(shard, manifest.lash.id);
  const cracks = quest.interactions.rows.flatMap((entry): NativeMeleeWorld[] => {
    if (entry.crack === undefined) return [];
    const spot = spots.crack.find(s => `crack.${s.id}` === entry.at);
    if (spot === undefined) throw new Error(`Missing Signal crack ${entry.id}`);
    return [{ act: entry.act, at: spot, radius: spot.radius, crack: entry.crack }];
  });
  const at = { x: shard.spawn.x, y: heightAt(shard.spawn.x, shard.spawn.z) + SIGNAL_LEVEL.player.lift, z: shard.spawn.z };
  return { level: trustedLevel(shard, { at, yaw: shard.spawn.yaw, speed: SIGNAL_LEVEL.player.speed }, SIGNAL_LEVEL.ground), ports: { ground: false, heightAt },
    proveEntries: host => proveTerrainEntries(host.physics, shard.entryways, heightAt, manifest.entries), install: (host, context) => {
    if (!context.restoring) addBakedWorld(host, baked.pieces, terrain.bytes);
    const ledger = ledgerPorts(context.emit);
    const { keeper, encounter } = population.install(host, ledger, context.snapshot);
    const input = new SignalLashInput();
    let released = { released: false, target: null as string | null };
    host.onStep(SIGNAL_LASH_INPUT, dt => { released = input.sample(dt, context.commands(), !encounter.locked()); },
      { snapshot: () => input.snapshot(), restore: saved => { if (typeof saved !== 'string') throw new Error('Invalid Signal hold continuation'); input.restore(saved); } });
    const worldCommands = new Map(cracks.map(target => [target.act, { kind: 'move' as const, world: target.act, action: target.crack === 'heavy' ? 1 : 0 }]));
    const heavy = { kind: 'move' as const, targetId: '', action: 1 }, held: NativeMeleeCommand[] = [heavy], none: NativeMeleeCommand[] = [];
    const swings = pickCommands(context.commands, (command): NativeMeleeCommand | undefined => command.kind === 'player' && command.attack !== undefined
      ? { kind: 'move', action: 0, targetId: command.attack.targetId } : command.kind === 'script' && command.actorId === quest.graph.actor ? worldCommands.get(command.value) : undefined);
    const lash: NativeMeleeOwner = installNativeMelee(host, row, row.native, { world: cracks,
      commands: () => {
        if (encounter.locked()) return none;
        // LashWeapon.update resets cooldown on release and replaces any same-frame light swing with the heavy.
        if (!released.released || released.target === null) return swings();
        lash.family.cooldown = 0;
        heavy.targetId = released.target;
        return held;
      } });
    const signal = bindDirectorActions(signalStages, { flags: host.flags,
      bindings: [{ action: { spawn: 'sunscar.matriarch' }, run: encounter.summon }],
      initial: host.flags.has(FLAG.lit) ? [{ lit: false }, { lit: true }] : [{ lit: false }] });
    host.onStep('sunscar.signal-fire', () => undefined, {
      snapshot: () => signal.snapshot(),
      restore: saved => { if (typeof saved !== 'string') throw new Error('Invalid Signal fire continuation'); signal.restore(saved); },
    });
    installQuestGraph(host, { quests: shard.quests, ...quest }, { spots, crack: { reach: { light: row.light.range, heavy: row.heavy.range }, cracked: lash.cracked },
      promptRegistrations: parsePromptRegistrations(rows.promptRegistrations),
      commands: pickCommands(context.commands, command => command.kind === 'script' ? command : undefined), ...ledger, summon: id => { if (id === boss.row.id) signal.advance(); } });
    keeper.settle();
  } };
};
