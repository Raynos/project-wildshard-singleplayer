import * as v from 'valibot';
import type { AnimalRigContext } from '@wildshard/engine/entities/animalRig';

/** Deliberately practice-only. This is not a new platform host or a corpse/contact exemption. */
export const PracticePoseTransitionSchema = v.strictObject({
  owner: v.literal('isolated-practice'),
  joints: v.pipe(v.array(v.pipe(v.string(), v.regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/u))),
    v.minLength(1), v.maxLength(32), v.check(names => new Set(names).size === names.length)),
});
export interface PracticePoseTransition { readonly owner: 'isolated-practice'; readonly joints: readonly string[] }
type Animation = (context: AnimalRigContext) => void;
const admitted = new WeakMap<Animation, PracticePoseTransition>();

/** Only the numeric compiler registers this bounded, stateless evaluator. */
export function registerPracticePoseTransition(animate: Animation, row: PracticePoseTransition): void {
  admitted.set(animate, Object.freeze({ ...row, joints: Object.freeze([...row.joints]) }));
}

/** Quiet admission lookup. An arbitrary animation callback cannot opt into synchronous hit publication. */
export function practicePoseTransition(animate: Animation | undefined): PracticePoseTransition | undefined {
  return animate === undefined ? undefined : admitted.get(animate);
}
