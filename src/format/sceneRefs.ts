import * as v from 'valibot';
import { isJsonData } from './json';

/** Exact Z2 publication names, never paths into a shard-owned object. */
export const HandleIdSchema = v.pipe(v.string(), v.minLength(1), v.maxLength(256), v.regex(/^[a-z0-9][a-zA-Z0-9.-]*$/));
export type HandleId = v.InferOutput<typeof HandleIdSchema>;
const id = v.pipe(v.string(), v.minLength(1), v.maxLength(256));
const finite = v.pipe(v.number(), v.finite());
/** A named scene origin, published point with world offset, or prompt identity. */
export const ScenePointRefSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Scene point reference requires plain JSON'), v.union([
  v.strictObject({ part: HandleIdSchema }),
  v.strictObject({ point: HandleIdSchema, offset: v.exactOptional(v.tuple([finite, finite, finite])) }),
]));
export type ScenePointRef = v.InferOutput<typeof ScenePointRefSchema>;
export const SceneRefSchema = v.union([ScenePointRefSchema, v.pipe(v.unknown(), v.check(isJsonData, 'Scene reference requires plain JSON'), v.strictObject({ prompt: id }))]);
export type SceneRef = v.InferOutput<typeof SceneRefSchema>;
/** Read-only game state identities; no reflected property or function access. */
export const ObservationRefSchema = v.pipe(v.unknown(), v.check(isJsonData, 'Observation reference requires plain JSON'), v.union([
  v.strictObject({ flag: id }), v.strictObject({ mark: id }),
  v.strictObject({ mover: id, state: v.picklist(['at-end', 'moving']) }),
]));
export type ObservationRef = v.InferOutput<typeof ObservationRefSchema>;
/** Check all publications before a consumer allocates prompts or effects. */
export function admitSceneRefs(refs: readonly SceneRef[], published: ReadonlySet<HandleId>, prompts: ReadonlySet<string> = new Set()): void {
  for (const input of refs) {
    const ref = v.parse(SceneRefSchema, input);
    const target = 'part' in ref ? ref.part : 'point' in ref ? ref.point : ref.prompt;
    if (!('prompt' in ref ? prompts : published).has(target)) throw new Error(`Missing scene reference: ${target}`);
  }
}
