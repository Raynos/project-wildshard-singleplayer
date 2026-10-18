import * as v from 'valibot';
import { isJsonData } from './json';
import { ObservationRefSchema, ScenePointRefSchema } from './sceneRefs';
import { QuestEffectSchema } from './questSteps';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const text = v.pipe(v.string(), v.maxLength(4096));
const finite = v.pipe(v.number(), v.finite());
const ids = v.pipe(v.array(id), v.maxLength(64));
const condition = v.strictObject({ all: v.exactOptional(ids), any: v.exactOptional(ids), none: v.exactOptional(ids) });
const need = v.strictObject({ ...condition.entries, else: v.exactOptional(id) });
/** Presentation commands name only the existing service or published resource.
 * Story acceptance and saved flags remain in the admitted native interactions. */
const effects = v.pipe(v.array(QuestEffectSchema), v.maxLength(64));
const unique = (rows: readonly { readonly id: string }[]) => new Set(rows.map(row => row.id)).size === rows.length;
const promptDefinition = { id, action: id, label: text, when: v.exactOptional(condition),
  labels: v.optional(v.pipe(v.array(v.strictObject({ when: condition, text })), v.maxLength(16)), []) };
/** Z11 page rows contain no borrowed owners, paths, calls or executable hooks. */
export const DeclaredQuestPageSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Quest page requires plain JSON'), v.strictObject({
  version: v.literal(1), quest: id,
  prompts: v.pipe(v.array(v.union([
    v.strictObject({ ...promptDefinition, at: ScenePointRefSchema, radius: v.pipe(finite, v.minValue(0), v.maxValue(100)) }),
    v.strictObject({ id, action: id, label: text, channel: id }),
  ])), v.maxLength(128)),
  observations: v.optional(v.pipe(v.array(v.strictObject({ id, source: ObservationRefSchema })), v.maxLength(128)), []),
  actions: v.pipe(v.array(v.strictObject({ id, interaction: v.exactOptional(id),
    needs: v.optional(v.pipe(v.array(need), v.maxLength(16)), []), denied: v.optional(v.record(id, text), {}),
    refused: v.optional(v.pipe(v.record(id, effects), v.check(rows => Object.keys(rows).length <= 16, 'Bounded refusal effects')), {}),
    before: v.optional(effects, []), after: v.optional(effects, []) })), v.maxLength(128)),
  initial: v.optional(v.pipe(v.array(v.strictObject({ when: condition, effects })), v.maxLength(64)), []),
}), v.check(row => unique(row.prompts) && unique(row.observations) && unique(row.actions)
  && row.prompts.every(prompt => row.actions.some(action => action.id === prompt.action)), 'Unique declared page ids and accepted prompt actions'));
export type DeclaredQuestPage = v.InferOutput<typeof DeclaredQuestPageSchema>;
/** Admission precedes prompt allocation or restore effects. */
export function parseDeclaredQuestPage(input: unknown): DeclaredQuestPage { return v.parse(DeclaredQuestPageSchema, input); }
