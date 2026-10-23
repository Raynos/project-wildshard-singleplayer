import * as v from 'valibot';

type CueField='pan'|'gain'|'strength'|'sprinting'|'surface'|'point'|'dir'|'speed'|'heavy'|'kind'|'killed'|'clang'|'headshot'|'phase';
type CueScalar=number|boolean|string;
type CueCondition={op:'present';field:CueField}|{op:'number';field:CueField}
 |{op:'equals';field:CueField;value:CueScalar}|{op:'in';field:CueField;values:CueScalar[]};
interface CueDefaults {
 pan?:number|undefined; gain?:number|undefined; strength?:number|undefined; speed?:number|undefined;
 heavy?:boolean|undefined; killed?:boolean|undefined; sprinting?:boolean|undefined;
 surface?:string|undefined; kind?:string|undefined; phase?:string|undefined; clang?:'wood'|'stone'|undefined;
}
interface CueActionInput {
 voice:string; when?:CueCondition[]|undefined; defaults?:CueDefaults|undefined;
 overrides?:CueDefaults|undefined; delay?:number|null|undefined;
}
interface CueAction {
 voice:string; when:CueCondition[]; defaults:CueDefaults; overrides?:CueDefaults|undefined; delay:number|null;
}
interface CueRouteInput {
 id:string; bus?:'audio'|'combat'|undefined; when?:CueCondition[]|undefined; actions:CueActionInput[];
}
interface CueRoute {
 id:string; bus?:'audio'|'combat'|undefined; when:CueCondition[]; actions:CueAction[];
}
type VoiceValue={kind:'literal';value:CueScalar}|{kind:'field';field:CueField;fallback?:CueScalar}
 |{kind:'owner';owner:string;key:string};
type VoiceArgument=VoiceValue|{kind:'options';fields:Record<string,VoiceValue>};
interface VoiceBindingInput {
 id:string; owner:string; method:string; when?:CueCondition[]|undefined; args:VoiceArgument[];
}
interface VoiceBinding {
 id:string; owner:string; method:string; when:CueCondition[]; args:VoiceArgument[];
}

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const field = v.picklist(['pan', 'gain', 'strength', 'sprinting', 'surface', 'point', 'dir', 'speed', 'heavy', 'kind', 'killed', 'clang', 'headshot', 'phase']);
const scalar = v.union([finite, v.boolean(), id]);
const condition = v.variant('op', [
  v.strictObject({ op: v.literal('present'), field }), v.strictObject({ op: v.literal('number'), field }),
  v.strictObject({ op: v.literal('equals'), field, value: scalar }),
  v.strictObject({ op: v.literal('in'), field, values: v.pipe(v.array(scalar), v.minLength(1), v.maxLength(32)) }),
]);
const conditions = v.pipe(v.array(condition), v.maxLength(16));
const defaults = v.strictObject({ pan: v.optional(v.pipe(finite, v.minValue(-1), v.maxValue(1))),
  gain: v.optional(v.pipe(finite, v.minValue(0), v.maxValue(8))), strength: v.optional(v.pipe(finite, v.minValue(0), v.maxValue(8))),
  speed: v.optional(v.pipe(finite, v.minValue(0), v.maxValue(60))), heavy: v.optional(v.boolean()), killed: v.optional(v.boolean()),
  sprinting: v.optional(v.boolean()), surface: v.optional(id), kind: v.optional(id), phase: v.optional(id), clang: v.optional(v.picklist(['wood', 'stone'])) });
const action = v.strictObject({ voice: id, when: v.optional(conditions, []), defaults: v.optional(defaults, {}),
  overrides: v.optional(defaults),
  delay: v.optional(v.nullable(v.pipe(finite, v.minValue(0), v.maxValue(60))), null) });
/** Ordered bounded cue rules dispatch admitted catalogue voices, with optional conditions, defaults and scope-owned delayed actions. No author callbacks. */
export const AudioRoutingSchema: v.GenericSchema<CueRouteInput[],AudioRouting> = v.pipe(v.array(v.strictObject({ id, bus: v.optional(v.picklist(['audio', 'combat'])), when: v.optional(conditions, []),
  actions: v.pipe(v.array(action), v.maxLength(16)) })), v.maxLength(512));
/** Canonical cue routes accepted by the audio interpreter; array order preserves today's dispatch boundaries. */
export type AudioRouting = CueRoute[];
/** Validate author cue routing before any sound is scheduled or installed. */
export function parseAudioRouting(input: unknown): AudioRouting { return v.parse(AudioRoutingSchema, input); }

const member=v.pipe(id,v.regex(/^[A-Za-z][A-Za-z0-9_]*$/u),v.check(key=>!['constructor','prototype','__proto__','caller','callee','arguments'].includes(key)));
const voiceValue=v.variant('kind',[
  v.strictObject({kind:v.literal('literal'),value:scalar}),
  v.strictObject({kind:v.literal('field'),field,fallback:v.exactOptional(scalar)}),
  v.strictObject({kind:v.literal('owner'),owner:id,key:member})
]);
const voiceArgument=v.union([voiceValue,v.strictObject({kind:v.literal('options'),fields:v.pipe(v.record(member,voiceValue),v.check(rows=>Object.keys(rows).length<=16))})]);
/** Bounded argument loans to existing voice methods; caller objects and point references remain native. */
export const AudioVoiceBindingsSchema:v.GenericSchema<VoiceBindingInput[],AudioVoiceBindings>=v.pipe(v.array(v.strictObject({id,owner:id,method:member,when:v.optional(conditions,[]),args:v.pipe(v.array(voiceArgument),v.maxLength(8))})),v.maxLength(128),v.check(rows=>new Set(rows.map(row=>row.id)).size===rows.length));
export type AudioVoiceBindings=VoiceBinding[];
