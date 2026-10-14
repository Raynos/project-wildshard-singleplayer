import * as v from 'valibot';
import { QuestGraphSchema } from './questGraph';
import { InteractionRowsSchema, QuestPageInteractionsSchema } from './questInteractions';
import { NpcRowSchema } from './npcs';
import { DirectorStagesSchema } from './directorStages';
import { compileDirectorWhen } from './directorWhen';

const name = v.pipe(v.string(), v.minLength(1), v.maxLength(96));
const names = v.pipe(v.array(name), v.maxLength(64));
const observations = v.pipe(v.record(name, v.boolean()), v.check(value => Object.keys(value).length <= 16, 'Bounded quest initial observations'));
const initial = v.pipe(v.array(observations), v.maxLength(64));
const inputs = v.pipe(v.record(name, v.pipe(name, v.regex(/^(?:flag|event):[a-z][a-z0-9.-]*$/u))), v.check(value => Object.keys(value).length <= 16, 'Bounded quest command inputs'));
const raw = v.strictObject({
  version: v.literal(1), graph: QuestGraphSchema, interactions: InteractionRowsSchema,
  page: v.exactOptional(QuestPageInteractionsSchema),
  npcs: v.pipe(v.array(NpcRowSchema), v.maxLength(64)), drive: v.picklist(['commands', 'external']),
  actors: v.strictObject({ ids: names, error: name }),
  observations: v.pipe(v.array(v.variant('kind', [
    v.strictObject({ binding: name, kind: v.literal('all-dead'), actors: names }),
    v.strictObject({ binding: name, kind: v.literal('owner'), owner: name }),
  ])), v.maxLength(64)),
  stages: v.pipe(v.array(v.strictObject({
    row: DirectorStagesSchema, initial,
    seed: v.exactOptional(v.strictObject({ flag: name, initial })),
    tick: v.boolean(),
    continuation: v.exactOptional(v.strictObject({ step: name, error: name })),
  })), v.maxLength(16)),
  summons: v.pipe(v.array(v.strictObject({ target: name, director: name })), v.maxLength(64)),
  commands: v.strictObject({
    step: v.nullable(name), inputs,
    routes: v.pipe(v.array(v.strictObject({
      value: v.pipe(v.number(), v.safeInteger(), v.minValue(0)), spot: name,
      when: v.pipe(v.string(), v.minLength(1), v.maxLength(1024)),
      action: v.variant('kind', [v.strictObject({ kind: v.literal('row'), id: name }), v.strictObject({ kind: v.literal('owner'), id: name })]),
    })), v.maxLength(64)),
  }),
});
/** Bounded native quest composition. Actual bodies, mover poses, commands and effects are borrowed from their owners. */
export type QuestHostRow = v.InferOutput<typeof raw>;

/** Refuse dangling routes, observations, continuations and stage requests before a native host installs anything. */
export function questHostRules(row: QuestHostRow): readonly string[] {
  const errors: string[] = [], stages = new Set(row.stages.map(stage => stage.row.id)), bindings = new Set(row.observations.map(observation => observation.binding));
  const unique = (values: readonly (string | number)[]): boolean => new Set(values).size === values.length;
  if (!unique(row.actors.ids) || !unique(row.stages.map(stage => stage.row.id)) || !unique(row.observations.map(observation => observation.binding))
    || !unique(row.summons.map(request => request.target)) || !unique(row.commands.routes.map(route => route.value))
    || !unique(row.npcs.map(npc => npc.id)) || !unique(row.npcs.map(npc => npc.spot))) errors.push('Unique native quest identities');
  if (row.drive === 'external' && row.interactions.marks.length > 0) errors.push('External quest marks require their existing continuation owner');
  if (row.drive === 'commands' && row.commands.routes.length > 0) errors.push('Native quest command routes have one owner');
  if (row.commands.step === null && (row.commands.routes.length > 0 || row.stages.some(stage => stage.tick))) errors.push('Tick-driven quest rows require a step');
  if (!unique(row.stages.flatMap(stage => stage.continuation === undefined ? [] : [stage.continuation.step]))) errors.push('Unique quest continuation steps');
  if (row.stages.some(stage => stage.continuation?.step === row.commands.step || row.drive === 'commands' && stage.continuation?.step === row.graph.step)
    || row.drive === 'commands' && row.commands.step === row.graph.step) errors.push('Distinct quest continuation owners');
  const checkBinding = (binding: string): void => { if (!binding.startsWith('flag:') && !bindings.has(binding)) errors.push('Declared native quest observation'); };
  for (const observation of row.observations) {
    if (!observation.binding.startsWith('event:')) errors.push('Native quest event binding');
    if (observation.kind === 'all-dead' && (observation.actors.length === 0 || !unique(observation.actors) || observation.actors.some(actor => !row.actors.ids.includes(actor)))) errors.push('Declared quest body observations');
  }
  for (const binding of Object.values(row.commands.inputs)) checkBinding(binding);
  for (const stage of row.stages) {
    if (stage.row.script !== null) errors.push('Native quest stages require data-only rows');
    for (const binding of Object.values(stage.row.inputs)) checkBinding(binding);
    const keys = Object.keys(stage.row.inputs);
    for (const value of [...stage.initial, ...(stage.seed?.initial ?? [])]) {
      if (Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) errors.push('Exact quiet quest initial observations');
    }
  }
  for (const request of row.summons) if (!stages.has(request.director)) errors.push('Declared quest request director');
  for (const action of row.graph.actions) if (!row.interactions.rows.some(entry => entry.id === action.row) || !row.summons.some(request => request.target === action.summon)) errors.push('Declared quest graph action');
  for (const route of row.commands.routes) {
    try { compileDirectorWhen(route.when, Object.keys(row.commands.inputs)); } catch { errors.push('Bounded quest command condition'); }
    if (route.action.kind === 'row' && !row.interactions.rows.some(entry => entry.id === route.action.id)) errors.push('Declared quest command row');
  }
  const interactionIds=new Set(row.interactions.rows.map(entry=>entry.id)),marks=new Set(row.interactions.marks.map(mark=>mark.id));
  for(const action of row.page?.actions??[]) {
    if(action.interaction!==undefined&&!interactionIds.has(action.interaction))errors.push('Declared page interaction rule');
    for(const effect of [...action.before??[],...action.after??[]])if(effect.kind==='mark'&&!marks.has(effect.target))errors.push('Declared page interaction mark');
  }
  const pageActions=new Set(row.page?.actions.map(action=>action.id));
  for(const prompt of row.page?.bindings?.prompts??[])if(!pageActions.has(prompt.target))errors.push('Declared page prompt action');
  for(const reaction of row.page?.world??[])if(reaction.action!==undefined&&!pageActions.has(reaction.action))errors.push('Declared world reaction action');
  for(const seed of row.page?.initial??[])for(const effect of seed.effects)if(effect.kind==='mark'&&!marks.has(effect.target))errors.push('Declared page interaction mark');
  return errors;
}

/** Pure native quest-host admission; omitted root composition does not alter any existing shardfile. */
export const QuestHostSchema: v.GenericSchema<unknown, QuestHostRow> = v.pipe(raw, v.check(row => questHostRules(row).length === 0, 'Valid native quest host'));
/** Compile the bounded graph, command and stage composition without installing runtime services. */
export function parseQuestHost(input: unknown): QuestHostRow { return v.parse(QuestHostSchema, input); }

/** Root admission binds a native quest host to declared flags and its existing hybrid quest owner. */
export function questHostBindingRules(row: QuestHostRow | null | undefined, flags: readonly string[], bound: boolean): readonly string[] {
  if (row === null || row === undefined) return [];
  const errors: string[] = [];
  if (!bound) errors.push('native quest host requires its bound quest owner');
  const declared = new Set(flags), marks = new Set(row.interactions.marks.map(mark => mark.id));
  const check = (values: readonly string[], transient = false): void => {
    for (const flag of values) if (!declared.has(flag) && !(transient && marks.has(flag))) errors.push(`undeclared native quest flag ${flag}`);
  };
  const reads = (condition: { all?: string[]; any?: string[]; none?: string[] }): string[] => [...condition.all ?? [], ...condition.any ?? [], ...condition.none ?? []];
  for (const mark of row.interactions.marks) if (mark.initial !== undefined) check(reads(mark.initial));
  for (const entry of row.interactions.rows) {
    check(entry.sets, true);
    for (const need of entry.needs ?? []) check(reads(need), true);
  }
  for (const condition of row.interactions.never ?? []) check(reads(condition), true);
  for (const npc of row.npcs) for (const entry of npc.dialogue) {
    check(entry.sets ?? []); if (entry.when !== undefined) check(reads(entry.when));
  }
  for (const binding of [...Object.values(row.commands.inputs), ...row.stages.flatMap(stage => Object.values(stage.row.inputs))]) if (binding.startsWith('flag:')) check([binding.slice(5)]);
  for (const stage of row.stages) {
    if (stage.seed !== undefined) check([stage.seed.flag]);
    for (const command of stage.row.stages.flatMap(entry => entry.do)) if ('flag' in command) check([command.flag.key]);
  }
  const observed=new Set(row.observations.flatMap(entry=>entry.kind==='owner'?[entry.owner]:[]));
  const pageCheck=(condition:{all?:string[];any?:string[];none?:string[]}):void=>check(reads(condition).filter(flag=>!observed.has(flag)),true);
  for(const action of row.page?.actions??[]) {
    for(const need of action.needs??[])pageCheck(need);
    for(const effect of [...action.before??[],...action.after??[]])if(effect.kind==='toast'&&effect.progress!==undefined)check(effect.progress.flags,true);
  }
  for(const reaction of row.page?.world??[]){if(reaction.needs!==undefined)pageCheck(reaction.needs);check(reaction.sets??[],true);}
  for(const seed of row.page?.initial??[])pageCheck(seed.when);
  return [...new Set(errors)];
}
