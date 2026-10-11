import { SignalDirector } from './signalDirector';
import { FLAG } from '../data/flags';
import * as v from 'valibot';
import { addBakedTerrainCollider } from '@wildshard/engine/physics/terrainTiles';
import { addPiece } from '@wildshard/engine/physics/pieces';
import { installSpeciesHomes } from '@wildshard/game/plugin/brain';
import { installMarkedBossRow } from './shardfile/markedBossRow';
import { installLashHost, type LashCommand, type LashTargetRow, type LashHost } from './items/lashHost';
import { installQuestGraph } from '@wildshard/game/plugin/quests';
import { speciesBrains } from '@wildshard/sdk/speciesBrains';
import { prepareRowLevel, bakedSpecs, bakedSpots } from './rowsHeadless';
import { parsePromptRegistrations } from '@wildshard/sdk/runtime/prompts';
import type { HeadlessRuntimeInstallation, PrepareHeadlessRuntime } from '@wildshard/sdk/headlessRuntime';
import { SIGNAL_MODULES, SIGNAL_SPECIES, SIGNAL_STRIKES } from '../data/brains';
import { SIGNAL_HEADLESS } from '../data/headlessOwners';
import baked from './physics.baked.json' with { type: 'json' };
import { SignalLashInput } from './lashInput';

const finite = v.pipe(v.number(), v.finite());
const surface = v.picklist(['wood', 'metal', 'flesh', 'felt', 'stone', 'rock', 'sand']);
const Pieces = v.pipe(v.array(v.object({ id: v.string(), name: v.string(), file: v.string(), active: v.boolean(), surface,
  owner: v.optional(v.string()), colliders: v.array(v.strictObject({ kind: v.literal('box'), x: finite, y: finite, z: finite,
    hx: finite, hy: finite, hz: finite, yaw: v.exactOptional(finite), surface: v.exactOptional(surface) })) })), v.maxLength(1024));
/** The held whip input's quiet continuation; the existing lash adapter owns unroll, cooldown and both contacts. */
export const SIGNAL_LASH_INPUT = 'sunscar.whip-input';
const manifest = { ...SIGNAL_HEADLESS, baked, homes: { ...SIGNAL_HEADLESS.homes, species: SIGNAL_SPECIES, strikes: SIGNAL_STRIKES, modules: SIGNAL_MODULES } };

/** Compose Signal's existing native owners in-shard, preserving their install order and adding the shipping hold/release input. */
export const prepareSignalRuntime: PrepareHeadlessRuntime = args => {
  const prepared = prepareRowLevel(manifest, args), specs = bakedSpecs(baked), spots = bakedSpots(baked), pieces = v.parse(Pieces, baked.pieces);
  const { homes, boss, quest } = manifest;
  const brains = speciesBrains(homes.species, homes.strikes, homes.modules), holds = homes.holds;
  const terrain = args.shard.terrain === null ? undefined : args.assets.get(args.shard.terrain.collider);
  if (terrain === undefined) throw new Error('Missing Signal native terrain');
  const row = args.shard.items.rows.find(item => item.id === manifest.lash.id);
  if (row?.kind !== 'weapon') throw new Error('Missing Signal whip row');
  const cracks = quest.interactions.rows.flatMap((entry): LashTargetRow[] => {
    if (entry.crack === undefined) return [];
    const spot = spots.crack.find(s => `crack.${s.id}` === entry.at);
    if (spot === undefined) throw new Error(`Missing Signal crack ${entry.id}`);
    return [{ act: entry.act, at: spot, radius: spot.radius, crack: entry.crack }];
  });
  return { ...prepared, install: (host, context) => {
    if (!context.restoring) {
      addBakedTerrainCollider(host.physics, terrain, host.scope);
      for (let i = 0; i < 1024; i++) {
        const piece = pieces[i];
        if (piece === undefined) break;
        if (!piece.active) continue;
        addPiece(host.physics, { id: piece.id, name: piece.name, file: piece.file, surface: piece.surface,
          colliders: piece.colliders, category: 'props', colliderOwner: piece.owner ?? piece.id });
      }
    }
    const keeper = installSpeciesHomes(host, { step: homes.step, seed: homes.seed, homes: homes.rows, boss: boss.row, specs,
      species: homes.species, brains, attackers: homes.attackers, think: homes.think, contactMove: kind => `${homes.contact.prefix}${kind}${homes.contact.suffix}`,
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
    const fact = (name: string, actorId: string): void => { context.emit({ kind: 'fact', name, actorId }); };
    const coins = (amount: number, actorId: string): void => { context.emit({ kind: 'coins', amount, actorId }); };
    const encounter = installMarkedBossRow(host, boss, { body: keeper.boss, fact, coins });
    const input = new SignalLashInput();
    let released = { released: false, target: null as string | null };
    host.onStep(SIGNAL_LASH_INPUT, dt => { released = input.sample(dt, context.commands(), !encounter.locked()); },
      { snapshot: () => input.snapshot(), restore: saved => { if (typeof saved !== 'string') throw new Error('Invalid Signal hold continuation'); input.restore(saved); } });
    const tickInputs = context.commands;
    const inputOverflow = new RangeError('Signal inputs exceed the admitted tick bound'), missingSlot = new Error('Missing Signal lash input slot');
    const lights = Array.from({ length: 1024 }, () => ({ targetId: '', heavy: false }));
    const heavy = { targetId: '', heavy: true }, attacks: LashCommand[] = [];
    const worldCommands = new Map(cracks.map(target => [target.act, { world: target.act, heavy: target.crack === 'heavy' }]));
    type ScriptInput = Extract<ReturnType<HeadlessRuntimeInstallation['commands']>[number], { kind: 'script' }>;
    const scripts: ScriptInput[] = [];
    const lash: LashHost = installLashHost(host, { step: manifest.lash.step, row, profile: manifest.lash.profile, eye: manifest.lash.eye, targets: cracks,
      commands: () => {
        attacks.length = 0;
        if (encounter.locked()) return attacks;
        // LashWeapon.update resets cooldown on release and replaces any same-frame light swing with the heavy.
        if (released.released && released.target !== null) {
          lash.lash.cooldown = 0;
          heavy.targetId = released.target;
          attacks.push(heavy);
          return attacks;
        }
        const inputs = tickInputs();
        if (inputs.length > 1024) throw inputOverflow;
        for (let i = 0; i < 1024; i++) {
          const command = inputs[i]; if (command === undefined) break;
          if (command.kind === 'player' && command.attack !== undefined) {
            const light = lights[i]; if (light === undefined) throw missingSlot;
            light.targetId = command.attack.targetId; attacks.push(light);
          } else if (command.kind === 'script' && command.actorId === quest.graph.actor) {
            const world = worldCommands.get(command.value); if (world !== undefined) attacks.push(world);
          }
        }
        return attacks;
      } });
    const signal = new SignalDirector({ lit: () => host.flags.has(FLAG.lit), summon: encounter.summon });
    host.onStep('sunscar.signal-fire', () => undefined, {
      snapshot: () => signal.snapshot(),
      restore: saved => { if (typeof saved !== 'string') throw new Error('Invalid Signal fire continuation'); signal.restore(saved); },
    });
    installQuestGraph(host, { quests: args.shard.quests, ...quest }, { spots, crack: { reach: { light: row.light.range, heavy: row.heavy.range }, cracked: lash.cracked },
      promptRegistrations: parsePromptRegistrations(v.parse(v.object({ promptRegistrations: v.unknown() }), baked).promptRegistrations),
      commands: () => {
        scripts.length = 0; const inputs = tickInputs();
        if (inputs.length > 1024) throw inputOverflow;
        for (let i = 0; i < 1024; i++) {
          const command = inputs[i];
          if (command === undefined) break;
          if (command.kind === 'script') scripts.push(command);
        }
        return scripts;
      }, fact, coins, summon: id => { if (id === boss.row.id) signal.light(); } });
    keeper.settle();
  } };
};
