import { hasDeclaredClientPage } from './runtimeBinds';
import type { Shardfile } from './shardSchema';
import { parseClientPlan } from './clientPlan';
import { parseNativeRuntimePlan, nativeRuntimeActorIds } from './nativeRuntimePlan';

/** Cross-section ownership replaces the former runtime-only requirement. This
 * runs on author output and checked network/native products before allocation. */
export function clientOwnershipRules(source: Shardfile, sections: ReadonlyMap<string, unknown>): readonly string[] {
  const raw = sections.get('client/plan');
  const features = raw === undefined ? [] : parseClientPlan(raw).features;
  const page = hasDeclaredClientPage(source), native = features.some(row => row.kind === 'population.homes');
  if (!page && !native) return [];
  const errors: string[] = [];
  if (!page || source.runtime !== null) errors.push('Native client features require their typed data page owner');
  for (const kind of ['world.scenes', 'motion.channels', 'species.program', 'held.melee', 'quest.page', 'population.homes'] as const)
    if (!features.some(row => row.kind === kind)) errors.push(`Data page requires ${kind}`);
  const quest = features.find(row => row.kind === 'quest.page'), held = features.find(row => row.kind === 'held.melee');
  const declared = source.questHost?.page;
  if (quest?.kind !== 'quest.page' || declared === undefined || !('version' in declared)
    || declared.quest !== quest.rows.id || !source.quests.quests.some(row => row.id === quest.rows.id)
    || !source.questNpcs?.some(row => !('kind' in row) && row.npc.id === quest.rows.npc)) errors.push('Data page requires its original declared quest and NPC');
  if (held?.kind !== 'held.melee' || source.items.loadout.primary !== held.item || source.items.loadout.secondary !== null
    || source.items.loadout.tools.length > 0 || !source.items.rows.some(row => row.kind === 'weapon' && row.id === held.item)) errors.push('Data page requires its one admitted held primary');
  if (source.creatures.spawns.length + source.rows.species.length + source.encounters.length + source.crowds.length > 0)
    errors.push('Data page native roster cannot also install a flat simulation roster');
  for (const name of ['world/scenes', 'world/targets', 'actors/species-programs', 'sim/runtime-plan', 'sim/scripts', 'look/painted'])
    if (!sections.has(name)) errors.push(`Data page requires ${name}`);
  const channels = new Set(source.clientChannels?.map(row => row.id));
  for (const feature of features) if (feature.kind === 'motion.channels') {
    const programs = feature.rows.groups.flatMap(group => group.programs).concat(feature.rows.frames.map(frame => frame.program));
    if (programs.some(id => !channels.has(id))) errors.push('Data page motion requires every declared channel program');
  }
  const rawPlan = sections.get('sim/runtime-plan');
  if (rawPlan !== undefined) {
    const plan = parseNativeRuntimePlan(rawPlan), owner = plan.recipe.population.owner;
    const bosses = features.filter(row => row.kind === 'boss.held' || row.kind === 'boss.spawned');
    if (bosses.length !== 1 || bosses.some(row => row.actor !== owner.actor || (row.kind === 'boss.held') !== (owner.profile.pattern === 'held')))
      errors.push('Data page requires its actual native encounter pattern');
    const actors = new Set(nativeRuntimeActorIds(plan));
    if (source.questHost?.actors.ids.some(id => !actors.has(id))) errors.push('Data page quest requires actual native actors');
  }
  return errors;
}
