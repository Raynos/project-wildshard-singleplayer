import * as v from 'valibot';

const id = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const finite = v.pipe(v.number(), v.finite());
const gain = v.pipe(finite, v.minValue(0), v.maxValue(8));
const list = v.pipe(v.array(id), v.minLength(1), v.maxLength(32));
/** Boot inventory/overlay policy; playback and decoders retain the original recordings. */
const catalogue = v.strictObject({ ownMusic: v.boolean(), priorityOwn: v.boolean(), overlaySamples: v.boolean(),
  inventoryOmitSlots: v.pipe(v.array(id), v.maxLength(32)), loopOrder: v.pipe(v.array(id), v.maxLength(32)) });
const optionalIds = v.optional(v.pipe(v.array(id), v.maxLength(128), v.check((ids) => new Set(ids).size === ids.length, 'unique sample ids')));
const scalar = v.union([finite, v.boolean(), id, v.null()]);
const conditions = v.pipe(v.array(v.strictObject({ field: id, op: v.picklist(['equals', 'not-equals', 'greater']), value: scalar })), v.maxLength(16));
/** Bounded numerical mix expressions over supplied listener/clock/geometry values. */
export type AudioMixOp = '+' | '-' | '*' | '/' | 'min' | 'max' | 'abs' | 'sin' | 'hypot' | 'ss' | 'in' | 'lt' | 'gt' | 'if' | 'and' | 'or' | 'not' | 'clamp' | 'zone' | 'dist';
export type AudioMixExpr = number | string | readonly [AudioMixOp, ...AudioMixExpr[]];
function boundedMix(expr:AudioMixExpr):boolean {
  const pending:{value:AudioMixExpr;depth:number}[]=[{value:expr,depth:0}];
  for(let count=0;count<256;count++){
    const current=pending.pop();if(current===undefined)return true;if(current.depth>16)return false;
    if(typeof current.value!=='number'&&typeof current.value!=='string') {
      const arity=current.value.length-1,op=current.value[0];
      const wanted=op==='ss'||op==='in'||op==='if'||op==='clamp'?3:op==='-'||op==='/'||op==='min'||op==='max'||op==='hypot'||op==='lt'||op==='gt'?2:op==='abs'||op==='sin'||op==='not'||op==='zone'||op==='dist'?1:null;
      if(arity<1||arity>8||(wanted!==null&&arity!==wanted)||((op==='dist'||op==='zone')&&typeof current.value[1]!=='string'))return false;
      for(const value of current.value.slice(1))pending.push({value,depth:current.depth+1});
    }
  }
  return pending.length===0;
}
const mixExpr:v.GenericSchema<AudioMixExpr> = v.pipe(v.lazy(()=>v.union([finite,id,v.tupleWithRest([v.picklist(['+','-','*','/','min','max','abs','sin','hypot','ss','in','lt','gt','if','and','or','not','clamp','zone','dist'])],mixExpr)])),v.check(value=>boundedMix(value),'bounded mix expression'));
const mixValues=(max:number)=>v.pipe(v.array(v.tuple([id,mixExpr])),v.maxLength(max));
/** Ordered weights, levels, filters, sends and diagnostics. All graph/geometry ports remain native. */
export const AudioMixSchema = v.strictObject({values:mixValues(256),levels:mixValues(64),cutoffs:mixValues(16),
  rooms:v.pipe(v.array(v.strictObject({id,weight:mixExpr,level:mixExpr})),v.maxLength(16)),diag:mixValues(64),zones:mixValues(32),
  zoneMode:v.picklist(['first','max']),zoneFloor:v.pipe(finite,v.minValue(0),v.maxValue(1)),defaultZone:id,
  shade:v.exactOptional(v.tuple([mixExpr,mixExpr]))});
export type AudioMixRecipe = v.InferOutput<typeof AudioMixSchema>;

/** Bounded music catalogue selection; the engine keeps today's bar-grid calm/tension/boss stem decoding. */
export const AudioMusicSchema = v.pipe(v.strictObject({ id, base: id, slots: list, bootSlots: list,
  synthLead: v.picklist(['pluck', 'marimba']), minFade: v.pipe(finite, v.minValue(0), v.maxValue(60)),
  source: v.nullable(v.strictObject({ dir: v.pipe(v.string(), v.regex(/^\/assets\/music\/[a-z0-9_-]+\/$/u)), manifestKey: id })),
  sets: v.record(id, id), selection: v.pipe(v.array(v.strictObject({ slots: list, when: conditions })), v.minLength(1), v.maxLength(64)),
  selectMode: v.picklist(['first', 'all']),
  catalogue: v.exactOptional(v.strictObject({ mode: v.picklist(['slots','bank']), extraStings: v.pipe(v.array(v.picklist(['pickup','death','chunk','dawn'])),v.maxLength(4)), stingSets: v.strictObject({ pickup:v.exactOptional(id),death:v.exactOptional(id),chunk:v.exactOptional(id),dawn:v.exactOptional(id) }) })),
}), v.check((music) => new Set(music.slots).size === music.slots.length && music.slots.includes(music.base)
  && music.bootSlots.every((slot) => slot === 'title' || music.slots.includes(slot))
  && music.selection.every((row) => row.slots.every((slot) => music.slots.includes(slot)))
  && Object.keys(music.sets).every((slot) => music.slots.includes(slot)), 'every selected, base and boot slot belongs to the score (the platform title is allowed)'));
/** Same-byte sample catalogue and loop gain selection, without author decoder callbacks. */
export const AudioSamplesSchema = v.strictObject({ catalogue: v.exactOptional(catalogue), set: id, bed: id, loopGains: v.pipe(v.record(id, gain), v.check((gains) => Object.keys(gains).length <= 32, 'bounded loop gains')), omitLoops: optionalIds, omitShots: optionalIds, omitSlots: optionalIds });
const zone = v.pipe(v.strictObject({ id, x: finite, z: finite, inner: v.pipe(finite, v.minValue(0), v.maxValue(2000)), outer: v.pipe(finite, v.minValue(0), v.maxValue(2000)), gain,
  fade: v.optional(v.pipe(finite, v.minValue(0.001), v.maxValue(2000))), open: v.optional(v.boolean()), source: v.optional(id) }), v.check((row) => row.inner < row.outer && (row.fade === undefined || row.outer === row.inner + row.fade), 'audio zone fade must extend outside its inner radius'));
const rectangle = v.pipe(v.strictObject({ id, zone: id, x0: finite, x1: finite, z0: finite, z1: finite }), v.check((row) => row.x0 < row.x1 && row.z0 < row.z1, 'positive rectangular audio region'));
/** Bounded zone/mixer data. Terrain, moving emitters and bespoke synthesis remain trusted runtime ports. */
export const AudioZonesSchema = v.strictObject({ id, mix:v.exactOptional(AudioMixSchema), smoothSeconds: v.pipe(finite, v.minValue(0.001), v.maxValue(10)), tickHz: v.pipe(finite, v.minValue(0.1), v.maxValue(120)),
  silentSeconds: v.pipe(finite, v.minValue(0), v.maxValue(600)), holdSeconds: v.pipe(finite, v.minValue(0), v.maxValue(60)),
  levels: v.pipe(v.record(id, gain), v.check((levels) => Object.keys(levels).length <= 64, 'bounded levels')),
  blendMetres: v.optional(v.pipe(finite, v.minValue(0.001), v.maxValue(2000))),
  rectangles: v.optional(v.pipe(v.array(rectangle), v.maxLength(512), v.check((rows) => new Set(rows.map((row) => row.id)).size === rows.length, 'unique rectangular regions'))),
  beds: v.optional(v.pipe(v.array(v.strictObject({ id, zone: id })), v.maxLength(32), v.check((rows) => new Set(rows.map((row) => row.id)).size === rows.length, 'unique bed ids'))),
  positional: v.optional(v.strictObject({ sample: id, max: v.pipe(finite, v.safeInteger(), v.minValue(1), v.maxValue(32)), reach: v.pipe(finite, v.minValue(0.001), v.maxValue(2000)) })),
  wet: v.pipe(v.record(id, v.pipe(finite, v.minValue(0), v.maxValue(1))), v.check((levels) => Object.keys(levels).length <= 16, 'bounded rooms')),
  zones: v.pipe(v.array(zone), v.maxLength(512), v.check((zones) => new Set(zones.map((row) => row.id)).size === zones.length, 'unique audio zones')) });
/** The validated score's stable catalogue slots and scene rules. */
export type AudioMusic = v.InferOutput<typeof AudioMusicSchema>;
/** The validated same-byte sample selection. */
export type AudioSamples = v.InferOutput<typeof AudioSamplesSchema>;
/** The validated mixer timing and named ambience zones. */
export type AudioZones = v.InferOutput<typeof AudioZonesSchema>;
