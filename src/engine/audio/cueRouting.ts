import type { CombatCueOpts } from '../combat/cues';

type Field = keyof CombatCueOpts;
type Scalar = number | boolean | string;
/** Conditions inspect existing cue options without adding random draws or audio taps. */
export type CueCondition = { op: 'present'; field: Field } | { op: 'number'; field: Field } | { op: 'equals'; field: Field; value: Scalar } | { op: 'in'; field: Field; values: readonly Scalar[] };
type Defaults = { readonly [Key in 'pan' | 'gain' | 'strength' | 'speed' | 'heavy' | 'killed' | 'sprinting' | 'surface' | 'kind' | 'phase' | 'clang']?: CombatCueOpts[Key] | undefined };
/** A voice action keeps the caller's point/direction references; defaults apply only to absent options. Null delay means synchronous. */
export interface CueAction { voice: string; when: readonly CueCondition[]; defaults: Defaults; delay: number | null }
/** First matching route owns a cue; an empty action list consumes intentionally silent cues. */
export interface CueRoute { id: string; when: readonly CueCondition[]; actions: readonly CueAction[] }
/** Voice recipes are trusted platform implementations. A false result preserves the original fallback boundary. Delayed actions use the supplied scope-owned scheduler. */
export interface CueRoutingPorts {
  voices: ReadonlyMap<string, (opts: CombatCueOpts) => boolean | undefined>;
  later?: ((run: () => void, seconds: number) => void) | undefined;
}
function matches(conditions: readonly CueCondition[], opts: CombatCueOpts): boolean {
  return conditions.every((condition) => {
    const value = opts[condition.field];
    if (condition.op === 'present') return value !== undefined;
    if (condition.op === 'number') return typeof value === 'number';
    if (condition.op === 'equals') return value === condition.value;
    return condition.values.some((entry) => entry === value);
  });
}
function withDefaults(opts: CombatCueOpts, defaults: Defaults): CombatCueOpts {
  const merged = { ...opts };
  for (const [key, value] of Object.entries(defaults)) {
    const current: unknown = Reflect.get(merged, key);
    if (current === undefined && value !== undefined) Reflect.set(merged, key, value);
  }
  return merged;
}
/** Resolve every voice and scheduling dependency up front, then dispatch synchronously in declaration order. Routing never creates a sound tap or random draw. */
export function createCueRouter(routes: readonly CueRoute[], ports: CueRoutingPorts): (id: string, opts: CombatCueOpts) => boolean {
  const compiled = routes.map((route) => ({ id: route.id, when: route.when, actions: route.actions.map((action) => {
    const voice = ports.voices.get(action.voice);
    if (voice === undefined) throw new Error(`Unknown catalogue voice: ${action.voice}`);
    if (action.delay !== null && ports.later === undefined) throw new Error('Delayed cue requires a scope-owned scheduler');
    return { ...action, voice };
  }) }));
  return (id, opts) => {
    const route = compiled.find((candidate) => candidate.id === id && matches(candidate.when, opts));
    if (route === undefined) return false;
    for (const action of route.actions) {
      if (!matches(action.when, opts)) continue;
      const input = withDefaults(opts, action.defaults);
      if (action.delay === null) { if (action.voice(input) === false) return false; }
      else ports.later?.(() => { action.voice(input); }, action.delay);
    }
    return true;
  };
}
