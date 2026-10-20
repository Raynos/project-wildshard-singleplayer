import * as v from 'valibot';
import { isJsonData } from './json';
import { SpawnCombatSchema } from './spawnCombat';
import { parseDecisionScripts, type DecisionScriptRow } from './decisionScripts';
import { actorMoveRules, parseActorMoves } from './actorMoves';
import type { DecisionRegistries } from './decisionBindings';

const key = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const handle = v.pipe(finite, v.integer(), v.minValue(1), v.maxValue(256));
export const SpawnScriptRowSchema = v.strictObject({
  step: key, roster: key, seed: v.pipe(finite, v.integer(), v.minValue(0), v.maxValue(0xffffffff)), script: v.unknown(), bytes: v.string(), controlState: key, maximum: handle,
  slots: v.pipe(v.array(v.strictObject({ id: key, handle, release: v.exactOptional(v.picklist(['retain', 'detach'])) })), v.minLength(1), v.maxLength(8)),
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
  if (new Set(data.slots.map(row => row.handle)).size !== data.slots.length || new Set(data.slots.map(row => row.id)).size !== data.slots.length) throw new Error('Duplicate spawn slot handle');
  for (const name of ['species', 'sites', 'spawns'] as const)
    if (new Set(data[name].map(row => row.id)).size !== data[name].length) throw new Error('Duplicate spawn recipe');
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
  v.check(input => input.every(row => row.bytes === '') && new Set(input.map(row => row.step)).size === input.length, 'Catalogue modules must use admitted product bytes and unique step ids'));
