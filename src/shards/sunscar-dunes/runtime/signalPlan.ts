import { readRuntimeWorldMetadata, prepareRuntimeWorld, installDeclaredQuestHost, ledgerPorts, pickCommands, weaponRow, installNativeMelee } from '@wildshard/game/plugin/simulation';
import { prepareNativePopulation } from '@wildshard/game/shardfile/bossRow';
import type { QuestGraphPorts } from '@wildshard/game/plugin/quests';
import { proveTerrainEntries } from '@wildshard/game/plugin/mover';
import { parsePromptRegistrations } from '@wildshard/sdk/runtime/prompts';
import type { PrepareHeadlessRuntime } from '@wildshard/sdk/headlessRuntime';
import { SIGNAL_NATIVE_POPULATION } from '../data/population';
import { SIGNAL_HEADLESS, SIGNAL_BOSS_OWNER } from '../data/headlessOwners';
import { SIGNAL_NATIVE_WORLD } from '../data/nativeWorld';
import baked from '../data/physics.generated.json' with { type: 'json' };

/** The baked prompt spots and crack targets (the built world's order), strictly. */
export function bakedSpots(input: unknown): QuestGraphPorts['spots'] { return readRuntimeWorldMetadata(input, true).spots; }

const manifest = { ...SIGNAL_HEADLESS, baked };

/** Compose Signal's existing native owners in-shard, preserving their install order and adding the shipping hold/release input. */
export const prepareSignalRuntime: PrepareHeadlessRuntime = async ({ shard, assets }) => {
  const rows = readRuntimeWorldMetadata(baked, true), spots = rows.spots;
  const quest = shard.questHost, world = await prepareRuntimeWorld(shard, assets, baked.pieces, SIGNAL_NATIVE_WORLD), { heightAt } = world.ports;
  if (quest === null || quest === undefined) throw new Error('Missing admitted Signal quest host');
  const population = prepareNativePopulation(SIGNAL_NATIVE_POPULATION, [...rows.actors, ...rows.bosses], SIGNAL_BOSS_OWNER);
  const row = weaponRow(shard, manifest.lash.id);
  return { level: world.level, ports: world.ports,
    proveEntries: host => proveTerrainEntries(host.physics, shard.entryways, heightAt, manifest.entries), install: (host, context) => {
    world.install(host, context.restoring);
    const ledger = ledgerPorts(context.emit);
    const { keeper, encounter } = population.install(host, ledger, context.snapshot);
    const lash = installNativeMelee(host, row, row.native, {questWorld:{row:quest,spots},inputCommands:context.commands,enabled:()=>!encounter.locked()});
    installDeclaredQuestHost(host, shard, { spots, crack: { reach: { light: row.light.range, heavy: row.heavy.range }, cracked: lash.cracked },
      promptRegistrations: parsePromptRegistrations(rows.promptRegistrations),
      commands: pickCommands(context.commands, command => command.kind === 'script' ? command : undefined), ...ledger,
      observations: new Map(), actions: new Map(),
      directorActions: new Map([['sunscar.signal-fire', [{ action: { spawn: 'sunscar.matriarch' }, run: encounter.summon }]]]) });
    keeper.settle();
  } };
};
