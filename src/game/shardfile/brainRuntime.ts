import { preparePlatformBrains, type PlatformBrainSpec, type PlatformSpawn, type BrainNavigation } from '@wildshard/engine/ai/platform';
import { SkirmisherBrain, type SkirmisherPorts } from '@wildshard/engine/ai/skirmisher';
import { GuardianBrain, type GuardianPorts } from '@wildshard/engine/ai/guardian';
import { PerchHunterBrain, type PerchHunterPorts } from '@wildshard/engine/ai/perchHunter';
import { RamGrazerBrain, type RamGrazerPorts } from '@wildshard/engine/ai/ramGrazer';
import type { StrikeSpec } from '@wildshard/engine/ai/strikes';
import type { AnimalSim } from '@wildshard/engine/entities/AnimalSim';
import type { SimHost, SimStateAdapter } from '@wildshard/engine/sim';
import { parseSkirmisher, parseGuardian, parsePerchHunter, type ShardSkirmisher, type ShardGuardian, type ShardPerchHunter } from './brains';
import { parseRamGrazer, type ShardRamGrazer } from './grazers';

/** Native decision families and the existing pursuit family; custom scripts require a composed host. */
export type DeclaredNativeBrain = PlatformBrainSpec | ShardSkirmisher | ShardGuardian | ShardPerchHunter | ShardRamGrazer;
/** One trusted actor's observations and body recipe; construction must not execute gameplay or consume RNG. */
export interface DeclaredBrainRecipe<P> { observe: (dt: number) => P; body: (dt: number) => void }
/** Loader-injected native recipes retain navigation, vertical movement, attack tokens and strike ownership. */
export interface DeclaredBrainPorts {
  navigation?: BrainNavigation;
  skirmisher?: (actor: AnimalSim, host: SimHost) => DeclaredBrainRecipe<SkirmisherPorts<AnimalSim>>;
  guardian?: (actor: AnimalSim, host: SimHost) => DeclaredBrainRecipe<GuardianPorts<AnimalSim>>;
  perchHunter?: (actor: AnimalSim, host: SimHost) => DeclaredBrainRecipe<PerchHunterPorts<AnimalSim>>;
  /** Pure preparation binds the declared strike and native floor/body without executing gameplay. */
  ramGrazer?: (actor: AnimalSim, declaration: ShardRamGrazer, host: SimHost) => DeclaredBrainRecipe<RamGrazerPorts<AnimalSim>> & { strike: StrikeSpec };
}
interface Registration { id: string; run: (dt: number) => void; adapter: SimStateAdapter }
function nativeRegistration<P>(id: string, actor: AnimalSim, divisor: number, brain: SimStateAdapter & { think: (ports: P) => void }, recipe: DeclaredBrainRecipe<P>, host: SimHost): Registration {
  if (typeof recipe.observe !== 'function' || typeof recipe.body !== 'function') throw new Error('Missing native brain recipe');
  const contract = JSON.stringify({ divisor, policy: brain.snapshot() });
  return { id, run: dt => {
    if (!actor.alive) return;
    if (host.state.tick % divisor === 0) brain.think(recipe.observe(divisor / 60));
    recipe.body(dt);
  }, adapter: { snapshot: () => contract, restore: saved => {
    if (saved !== contract) throw new Error('Incompatible native brain continuation');
  } } };
}
/** Preflight every actor, declaration and native port before registering any callback; restore installs without running recipes. */
export function installDeclaredBrains(host: SimHost, rows: readonly PlatformSpawn[], declarations: readonly DeclaredNativeBrain[], ports: DeclaredBrainPorts = {}): ReadonlyMap<string, SimStateAdapter> {
  const definitions = new Map(declarations.map(row => [row.id, row]));
  if (definitions.size !== declarations.length || new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Duplicate declared brain identity');
  for (const row of declarations) {
    switch (row.kind) {
      case 'pursue': break;
      case 'skirmisher': parseSkirmisher(row); break;
      case 'guardian': parseGuardian(row); break;
      case 'perch-hunter': parsePerchHunter(row); break;
      case 'ram-grazer': parseRamGrazer(row); break;
      default: throw new Error('Unsupported declared brain family');
    }
  }
  for (const row of rows) {
    if (row.brain === null) continue;
    const spec = definitions.get(row.brain);
    if (!host.entities.has(row.id) || spec === undefined || host.adapters.has(`brain.${row.id}`)) throw new Error('Unresolved or installed declared brain');
    if ((spec.kind === 'skirmisher' && ports.skirmisher === undefined) || (spec.kind === 'guardian' && ports.guardian === undefined)
      || (spec.kind === 'perch-hunter' && ports.perchHunter === undefined)
      || (spec.kind === 'ram-grazer' && ports.ramGrazer === undefined)) throw new Error('Missing native brain port');
  }
  const pursueRows = rows.filter(row => row.brain !== null && definitions.get(row.brain)?.kind === 'pursue');
  const pursuits = preparePlatformBrains(host, pursueRows, declarations.filter(row => row.kind === 'pursue'), ports.navigation);
  const registrations: Registration[] = [];
  for (const row of rows) {
    if (row.brain === null) continue;
    const spec = definitions.get(row.brain), actor = host.entities.get(row.id), pursuit = pursuits.get(row.id), id = `brain.${row.id}`;
    if (spec === undefined || actor === undefined) throw new Error('Unresolved declared actor');
    switch (spec.kind) {
      case 'pursue':
        if (pursuit === undefined) throw new Error('Unresolved pursuit policy');
        registrations.push({ id, run: () => { pursuit.step(host.state.tick); }, adapter: pursuit }); break;
      case 'skirmisher':
        if (ports.skirmisher === undefined) throw new Error('Missing native brain port');
        registrations.push(nativeRegistration(id, actor, spec.thinkDivisor, new SkirmisherBrain(actor, spec), ports.skirmisher(actor, host), host)); break;
      case 'guardian':
        if (ports.guardian === undefined) throw new Error('Missing native brain port');
        registrations.push(nativeRegistration(id, actor, spec.thinkDivisor, new GuardianBrain(actor, spec), ports.guardian(actor, host), host)); break;
      case 'perch-hunter':
        if (ports.perchHunter === undefined) throw new Error('Missing native brain port');
        registrations.push(nativeRegistration(id, actor, spec.thinkDivisor, new PerchHunterBrain(actor, spec), ports.perchHunter(actor, host), host)); break;
      case 'ram-grazer': {
        if (ports.ramGrazer === undefined) throw new Error('Missing native brain port');
        const recipe = ports.ramGrazer(actor, spec, host);
        if (typeof recipe.observe !== 'function' || typeof recipe.body !== 'function' || recipe.strike.id !== spec.strike) throw new Error('Unresolved declared grazer strike or recipe');
        const brain = new RamGrazerBrain(actor, spec, recipe.strike), contract = JSON.stringify({ version: 1, divisor: spec.thinkDivisor });
        registrations.push({ id, run: dt => {
          if (!actor.alive) return;
          if (host.state.tick % spec.thinkDivisor === 0) brain.think(recipe.observe(spec.thinkDivisor / 60));
          brain.act(recipe.observe(dt)); recipe.body(dt);
        }, adapter: { snapshot: () => [contract, brain.snapshot()], restore: saved => {
          if (!Array.isArray(saved) || saved.length !== 2 || saved[0] !== contract || saved[1] === undefined) throw new Error('Incompatible grazer cadence continuation');
          brain.restore(saved[1]);
        } } }); break;
      }
      default: throw new Error('Unsupported declared brain family');
    }
  }
  const result = new Map<string, SimStateAdapter>();
  const remove: (() => void)[] = [];
  try {
    for (const registration of registrations) { remove.push(host.onStep(registration.id, registration.run, registration.adapter)); result.set(registration.id.slice(6), registration.adapter); }
  } catch (error) { for (const undo of remove) undo(); throw error; }
  return result;
}
