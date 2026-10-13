import { bindDirectorActions } from '@wildshard/game/plugin/director';
import signalStages from '../data/signalStages.json' with { type: 'json' };
import { FLAG } from '../data/flags';
import * as v from 'valibot';
import { addBakedWorld, admittedTerrain, ledgerPorts, pickCommands, trustedLevel, weaponRow } from '@wildshard/game/plugin/simulation';
import { bakedSpecs, installSpeciesHomes } from '@wildshard/game/plugin/brain';
import { installBossOwnerRow } from '@wildshard/game/shardfile/bossRow';
import { installLashHost, type LashCommand, type LashTargetRow, type LashHost } from './items/lashHost';
import { installQuestGraph, type QuestGraphPorts } from '@wildshard/game/plugin/quests';
import { proveTerrainEntries } from '@wildshard/game/plugin/mover';
import { speciesBrains } from '@wildshard/sdk/speciesBrains';
import { parsePromptRegistrations } from '@wildshard/sdk/runtime/prompts';
import type { PrepareHeadlessRuntime } from '@wildshard/sdk/headlessRuntime';
import { SIGNAL_MODULES, SIGNAL_SPECIES, SIGNAL_STRIKES } from '../data/brains';
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
const manifest = { ...SIGNAL_HEADLESS, baked, homes: { ...SIGNAL_HEADLESS.homes, species: SIGNAL_SPECIES, strikes: SIGNAL_STRIKES, modules: SIGNAL_MODULES } };

/** Compose Signal's existing native owners in-shard, preserving their install order and adding the shipping hold/release input. */
export const prepareSignalRuntime: PrepareHeadlessRuntime = ({ shard, assets }) => {
  const rows = v.parse(Baked, baked), specs = bakedSpecs([...rows.actors, ...rows.bosses]), spots = rows.spots;
  const { homes, boss, quest } = manifest, terrain = admittedTerrain(shard, assets), { heightAt } = terrain;
  const brains = speciesBrains(homes.species, homes.strikes, homes.modules), holds = homes.holds;
  const row = weaponRow(shard, manifest.lash.id);
  const cracks = quest.interactions.rows.flatMap((entry): LashTargetRow[] => {
    if (entry.crack === undefined) return [];
    const spot = spots.crack.find(s => `crack.${s.id}` === entry.at);
    if (spot === undefined) throw new Error(`Missing Signal crack ${entry.id}`);
    return [{ act: entry.act, at: spot, radius: spot.radius, crack: entry.crack }];
  });
  const at = { x: shard.spawn.x, y: heightAt(shard.spawn.x, shard.spawn.z) + SIGNAL_LEVEL.player.lift, z: shard.spawn.z };
  return { level: trustedLevel(shard, { at, yaw: shard.spawn.yaw, speed: SIGNAL_LEVEL.player.speed }, SIGNAL_LEVEL.ground), ports: { ground: false, heightAt },
    proveEntries: host => proveTerrainEntries(host.physics, shard.entryways, heightAt, manifest.entries), install: (host, context) => {
    if (!context.restoring) addBakedWorld(host, baked.pieces, terrain.bytes);
    const keeper = installSpeciesHomes(host, { step: homes.step, seed: homes.seed, homes: homes.rows, boss: boss.row, specs,
      species: homes.species, brains, attackers: homes.attackers, think: homes.think,
      custom: kind => { throw new Error(`No declared Signal policy for ${kind}`); },
      beforeStep: kept => {
        for (let i = 0; i < 1024; i++) {
          const hold = holds[i];
          if (hold === undefined) break;
          const actor = kept[hold.home]?.actor;
          if (actor) actor.mem[hold.field] = host.flags.has(hold.until) ? 0 : 1;
        }
      } }, context.snapshot);
    if (keeper.boss === null) throw new Error('Missing native Matriarch body');
    const ledger = ledgerPorts(context.emit);
    const encounter = installBossOwnerRow(host, SIGNAL_BOSS_OWNER, { body: { kind: 'spawned', keeper: keeper.boss }, ...ledger });
    const input = new SignalLashInput();
    let released = { released: false, target: null as string | null };
    host.onStep(SIGNAL_LASH_INPUT, dt => { released = input.sample(dt, context.commands(), !encounter.locked()); },
      { snapshot: () => input.snapshot(), restore: saved => { if (typeof saved !== 'string') throw new Error('Invalid Signal hold continuation'); input.restore(saved); } });
    const worldCommands = new Map(cracks.map(target => [target.act, { world: target.act, heavy: target.crack === 'heavy' }]));
    const heavy = { targetId: '', heavy: true }, held: LashCommand[] = [heavy], none: LashCommand[] = [];
    const swings = pickCommands(context.commands, (command): LashCommand | undefined => command.kind === 'player' && command.attack !== undefined
      ? { targetId: command.attack.targetId, heavy: false } : command.kind === 'script' && command.actorId === quest.graph.actor ? worldCommands.get(command.value) : undefined);
    const lash: LashHost = installLashHost(host, { step: manifest.lash.step, row, profile: manifest.lash.profile, eye: manifest.lash.eye, targets: cracks,
      commands: () => {
        if (encounter.locked()) return none;
        // LashWeapon.update resets cooldown on release and replaces any same-frame light swing with the heavy.
        if (!released.released || released.target === null) return swings();
        lash.lash.cooldown = 0;
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
