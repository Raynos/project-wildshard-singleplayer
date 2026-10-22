import * as v from 'valibot';
import { SpawnScriptV2Schema } from './spawnScriptV2';
import { layoutV2 } from './scriptWireV2';
import { isJsonData } from './json';
import { SpawnCombatSchema } from './spawnCombat';
import { actorDecisionRows,parseDecisionScripts, type DecisionScriptRow } from './decisionScripts';
import { actorMoveRules, parseActorMoves } from './actorMoves';
import type { DecisionRegistries } from './decisionBindings';

const key = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const handle = v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(256));
export const SpawnScriptRowSchema = v.strictObject({
  v2: v.exactOptional(SpawnScriptV2Schema),
  step: key, roster: key, seed: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(0xffffffff)), script: v.unknown(), bytes: v.string(), controlState: key, maximum: handle,
  slots: v.pipe(v.array(v.strictObject({ id: key, handle, authority: v.exactOptional(v.literal('observe')),release: v.exactOptional(v.picklist(['retain', 'detach'])) })), v.minLength(1), v.maxLength(8)),
  species: v.pipe(v.array(v.strictObject({ id: key, kind: key, variant: key })), v.minLength(1), v.maxLength(64)),
  sites: v.pipe(v.array(v.strictObject({ id: key, slot: key,
    point: v.exactOptional(v.tuple([finite, finite])), face: v.union([v.literal('player'), v.tuple([finite, finite])]),
  })), v.minLength(1), v.maxLength(64)),
  spawns: v.pipe(v.array(v.strictObject({ id: key, species: key, site: key })), v.minLength(1), v.maxLength(64)),
  fields: v.pipe(v.array(v.strictObject({ id: key, source: v.picklist(['x', 'z', 'scripted', 'lookWeight', 'night', 'limit', 'force', 'value', 'observed', 'channel', 'lookHeight', 'hidden', 'seed', 'lastHit', 'strikeTime']), channel: v.exactOptional(key), fallback: v.exactOptional(finite) })), v.maxLength(32)),
  flags: v.pipe(v.array(key), v.maxLength(64)), cues: v.pipe(v.array(key), v.maxLength(32)),
  channels: v.pipe(v.array(key), v.maxLength(16)), strikes: v.exactOptional(SpawnCombatSchema), moves: v.unknown(),
  // Historical wire names and state-slot mappings are content, not hard-coded save-slot names in a host.
  legacy: v.exactOptional(v.strictObject({ spec: v.string(), acc: key, rng: key, countChannel: key,
    groups: v.pipe(v.array(v.strictObject({ key, active: key, slots: v.array(key), values: v.array(key), value: key,
      type: v.picklist(['f64', 'bool']) })), v.maxLength(8)),
  })),
});
export type SpawnScriptRows = Omit<v.InferOutput<typeof SpawnScriptRowSchema>, 'script' | 'moves'> & {
  script: DecisionScriptRow; moves: ReturnType<typeof parseActorMoves>;
};
/** An independent bounded actor-slot catalogue, using the same v1 admission and generated bindings as other guests. */
export function spawnScriptRegistries(data: Pick<SpawnScriptRows, 'slots' | 'spawns' | 'fields' | 'flags' | 'cues' | 'channels' | 'moves' | 'strikes'> & { readonly script?: DecisionScriptRow }): DecisionRegistries {
  const ids = (names: readonly string[]): ReadonlyMap<string, number> => {
    if (new Set(names).size !== names.length) throw new Error('Duplicate spawn script identity');
    return new Map(names.map((name, index) => [name, index + 1]));
  };
  return { actors: new Map(data.slots.map(row => [row.id, row.handle])), spawns: ids([...data.spawns.map(row => row.id), ...(data.script !== undefined && 'spawnGroup' in data.script.binding ? [data.script.binding.spawnGroup] : [])]),
    fields: ids(data.fields.map(row => row.id)), flags: ids(data.flags), cues: ids(data.cues), channels: ids(data.channels),
    moves: ids(data.moves.map(row => row.id)), strikes: ids((data.strikes ?? []).map(row => row.row.id)) };
}
/** Validate recipes and every cross-reference before a script or body can be installed. */
export function parseSpawnScript(input: unknown): SpawnScriptRows {
  if (!isJsonData(input)) throw new Error('Spawn script requires plain JSON');
  const data = v.parse(SpawnScriptRowSchema, input), script = parseDecisionScripts([data.script])[0];
  if (script?.side !== 'sim' || !('shard' in script.binding || 'spawnGroup' in script.binding)) throw new Error('Spawn script requires a simulation shard binding');
  const result = { ...data, script, moves: parseActorMoves(data.moves) };
  const registry = spawnScriptRegistries(result);
  if (data.v2 !== undefined) {
    const row = data.v2, capacities = new Map(row.capacities.map(item => [item.kind,item.capacity]));
    const layout = layoutV2(row.io,row.artifact.pages,capacities);
    const bindings = actorDecisionRows(script).length;
    const needed = new Map([[1,bindings],[2,bindings*script.state.length],[3,bindings*script.state.length],[4,bindings*Object.keys(script.params).length],[5,bindings],[6,bindings*data.fields.length],[7,1],[9,16],[21,bindings],[22,bindings]]);
    if ([...needed].some(([kind,count]) => (capacities.get(kind) ?? 0) < count)) throw new Error('Incomplete spawn v2 input layout');
    if (capacities.size !== row.capacities.length || layout.bytes !== row.artifact.ioBytes) throw new Error('Invalid spawn v2 layout');
    if (row.effects !== undefined) {
      const world = row.effects.world;
      if (world === undefined && row.effects.elites !== true) throw new Error('Empty v2 effect capabilities');
      if (row.effects.elites === true && data.slots.some(slot => slot.authority !== 'observe')) throw new Error('Page effect slots must observe original bodies');
      if (world !== undefined && (new Set(world.targets.map(target => target.handle)).size !== world.targets.length
        || new Set(world.targets.map(target => target.identity)).size !== world.targets.length
        || new Set(world.operations).size !== world.operations.length)) throw new Error('Duplicate v2 effect capability');
    }
    if (row.self !== undefined && 'spawnGroup' in script.binding) throw new Error('V2 spawn groups use their own self slots');
    if (row.self !== undefined && !registry.actors?.has(row.self)) throw new Error('Unknown v2 self slot');
    for (const column of row.columns) if (data.fields[column.id-1]?.id !== column.name || data.fields[column.id-1]?.source !== 'observed') throw new Error('V2 column requires matching observed field');
  }
  if (new Set(data.slots.map(row => row.handle)).size !== data.slots.length || new Set(data.slots.map(row => row.id)).size !== data.slots.length) throw new Error('Duplicate spawn slot handle');
  for (const name of ['species', 'sites', 'spawns'] as const)
    if (new Set(data[name].map(row => row.id)).size !== data[name].length) throw new Error('Duplicate spawn recipe');
  if (data.slots.some(row => row.authority === 'observe') && data.v2 === undefined) throw new Error('Observation-only slots require v2');
  if (data.sites.some(row => !registry.actors?.has(row.slot)) || data.spawns.some(row =>
    !data.sites.some(site => site.id === row.site) || !data.species.some(species => species.id === row.species))) throw new Error('Missing spawn recipe reference');
  if (Object.values(script.spawns).some(id => {
    if ('spawnGroup' in script.binding && id === script.binding.spawnGroup) return false;
    const spawn = data.spawns.find(row => row.id === id), site = data.sites.find(row => row.id === spawn?.site);
    return site === undefined || !Object.values(script.actors).includes(site.slot);
  })) throw new Error('Spawn recipe requires an owned actor slot');
  const commands = new Set(['spawn', 'despawn', 'field', 'flag', 'move', 'stop', 'cue', 'channel', 'strike']);
  const reads = new Set(['x', 'y', 'z', 'yaw', 'hpShare', 'alive', 'field', 'distance', 'nearestPlayer', 'flag', 'groundHeight', 'moving', 'radial', 'random', 'strikeState', 'spawnGroupAlive']);
  if (script.commands.some(command => !commands.has(command)) || script.reads.some(read => !reads.has(read))) throw new Error('Unsupported spawn script capability');
  if (data.fields.some(row => row.source === 'channel' && (row.channel === undefined || !data.channels.includes(row.channel)))) throw new Error('Missing field channel');
  if ((data.strikes ?? []).some(row => [row.startCue, row.activeCue, row.doneCue].some(cue => cue !== undefined && !data.cues.includes(cue)))) throw new Error('Missing strike cue');
  for (const move of result.moves) if (move.kind === 'steer' && Object.values(move.fields).some(id => data.fields.find(row => row.id === id)?.source !== 'value')) throw new Error('Owned steering requires writable value fields');
  if (actorMoveRules(result.moves, { spots: new Set(), fields: new Set(data.fields.map(row => row.id)), strikes: new Set((data.strikes ?? []).map(row => row.row.id)) }).length > 0) throw new Error('Missing owned movement reference');
  return result;
}

/** Owned spawn directors are admitted separately from automatically installed actor decisions. */
export const SpawnScriptsSchema = v.pipe(v.array(v.unknown()), v.maxLength(16), v.transform(input => input.map(parseSpawnScript)),
  v.check(input => input.every(row => row.bytes === '' && (row.v2 === undefined || row.v2.bytes === '')) && new Set(input.map(row => row.step)).size === input.length, 'Catalogue modules must use admitted product bytes and unique step ids'));
