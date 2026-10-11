import * as v from 'valibot';
import { compileDirectorWhen } from './directorWhen';

const key = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.-]*$/u), v.maxLength(128));
const name = v.pipe(v.string(), v.regex(/^[A-Za-z_][A-Za-z0-9_]*$/u), v.maxLength(64));
const bindingSchema = v.pipe(v.string(), v.maxLength(256), v.regex(/^(?:(?:flag|zone|event):[a-z][a-z0-9.-]*|actor:[a-z][a-z0-9.-]*\.(?:dead|present)|day:(?:0(?:\.[0-9]+)?|1)\.\.(?:0(?:\.[0-9]+)?|1))$/u));
const value = v.pipe(v.number(), v.finite(), v.minValue(-10000), v.maxValue(10000));
const action = v.union([
  v.strictObject({ spawn: key }), v.strictObject({ despawn: key }),
  v.strictObject({ flag: v.strictObject({ key, value: v.boolean() }) }),
  v.strictObject({ score: key }), v.strictObject({ weather: key }),
  v.strictObject({ toast: key }), v.strictObject({ reward: key }),
  v.strictObject({ emit: key, value: v.optional(v.union([v.boolean(), value]), 0) }),
]);
const condition = v.pipe(v.string(), v.minLength(1), v.maxLength(1024));
const next = v.union([key, v.pipe(v.array(v.strictObject({ target: key, when: condition })), v.minLength(1), v.maxLength(64))]);
const raw = v.strictObject({
  version: v.literal(2), id: key,
  inputs: v.pipe(v.record(name, bindingSchema), v.check(inputs => Object.keys(inputs).length <= 16, 'At most sixteen director inputs')),
  stages: v.pipe(v.array(v.strictObject({
    id: key, when: v.exactOptional(condition),
    do: v.optional(v.pipe(v.array(action), v.maxLength(32)), []), next: v.exactOptional(next),
  })), v.minLength(1), v.maxLength(64)),
  script: v.optional(v.nullable(v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u))), null),
});
type Stages = v.InferOutput<typeof raw>;

/** Decode a half-open normalized day interval [from, to); unrelated owner bindings return null. */
export function directorDayRange(binding: string): readonly [number, number] | null {
  if (!binding.startsWith('day:')) return null;
  const match = /^day:(0(?:\.[0-9]+)?|1)\.\.(0(?:\.[0-9]+)?|1)$/u.exec(binding);
  if (match === null) throw new Error('Invalid director day range');
  const from = Number(match[1]), to = Number(match[2]);
  if (from >= to) throw new Error('Director day range must increase within [0, 1]');
  return [from, to];
}

/** Defining semantic checks: unique stages, declared targets and bounded boolean conditions over native input bindings. */
export function directorStagesRules(data: Stages): readonly string[] {
  const failures: string[] = [], names = Object.keys(data.inputs), ids = data.stages.map(stage => stage.id);
  if (names.some(input => ['true', 'false', '__proto__', 'constructor', 'prototype'].includes(input))) failures.push('reserved director input');
  if (new Set(ids).size !== ids.length) failures.push('unique director stages');
  for (const binding of Object.values(data.inputs)) {
    try { directorDayRange(binding); } catch { failures.push('bounded director day range'); }
  }
  if (data.stages[0]?.when !== undefined) failures.push('initial director stage is unconditional');
  for (const stage of data.stages) {
    const targets = typeof stage.next === 'string' ? [{ target: stage.next, when: 'true' }] : stage.next ?? [];
    for (const target of targets) {
      if (!ids.includes(target.target)) failures.push('declared director next stage');
      try { compileDirectorWhen(target.when, names); } catch { failures.push('bounded director next condition'); }
    }
    if (stage.when !== undefined) {
      try { compileDirectorWhen(stage.when, names); } catch { failures.push('bounded director condition'); }
    }
  }
  return failures;
}

/** Version-two pacing rows: ordered stage entry, an optional explicit cycle, and a closed set of owner-applied actions. */
export const DirectorStagesSchema = v.pipe(raw, v.check(data => directorStagesRules(data).length === 0, 'Valid director stages'));
/** An admitted stage machine; source bindings identify native owners rather than granting simulated authority. */
export type DirectorStagesData = v.InferOutput<typeof DirectorStagesSchema>;
/** Author input before empty action arrays and a null script are filled by admission. */
export type DirectorStagesDefinition = v.InferInput<typeof DirectorStagesSchema>;
/** An ordered stage-entry command for an existing native owner or presentation subscriber. */
export type DirectorAction = DirectorStagesData['stages'][number]['do'][number];
/** Validate all row syntax and semantic limits before installing or writing a director. */
export function parseDirectorStages(input: unknown): DirectorStagesData { return v.parse(DirectorStagesSchema, input); }


/** Root-owned pacing rows with distinct identities; an AS handler is installed only through explicit trusted bindings. */
export const DirectorsSchema = v.pipe(v.array(DirectorStagesSchema), v.maxLength(16), v.check(rows => new Set(rows.map(row => row.id)).size === rows.length, 'Unique director identities'));

/** Describe stock data-only support: quest flags, bounded day inputs and flag actions.
 * Other admitted actions need trusted native owners; emit is not AssemblyScript delivery. */
export function directorDataHostIssues(data: DirectorStagesData): readonly string[] {
  const issues: string[] = [];
  if (data.script !== null) issues.push('script requires a trusted typed director host');
  for (const [inputName, binding] of Object.entries(data.inputs)) {
    if (!binding.startsWith('flag:') && directorDayRange(binding) === null) issues.push(`input ${inputName} (${binding}) requires a native observation owner`);
  }
  for (const stage of data.stages) for (const command of stage.do) {
    if (!('flag' in command)) issues.push(`stage ${stage.id}: ${Object.keys(command)[0]} requires a native action owner${'emit' in command ? '; emit does not deliver an AssemblyScript input' : ''}`);
  }
  return issues;
}
