import * as v from 'valibot';
import { isJsonData } from './json';

const key = v.pipe(v.string(),v.minLength(1),v.maxLength(128));
const finite = v.pipe(v.number(),v.finite());
const codec = v.pipe(v.array(v.strictObject({ state: key,value: finite })),v.maxLength(64));
const memoryDefault = v.strictObject({value:finite,source:v.exactOptional(v.picklist(['x','z','yaw'])),
  when:v.exactOptional(v.strictObject({field:key,equal:finite,value:finite}))});
const point = v.variant('kind',[v.strictObject({kind:v.picklist(['self','player','hit'])}),
  v.strictObject({kind:v.literal('memory'),x:key,z:key,fallback:v.picklist(['self','zero'])})]);
const source = v.variant('kind',[
  v.strictObject({ kind: v.literal('player'),field: v.picklist(['crouched','forwardX','forwardZ','mounted','healthShare']) }),
  v.strictObject({ kind: v.literal('wind'),field: v.picklist(['x','z','strength']) }),
  v.strictObject({ kind: v.literal('environment'),field: v.picklist(['light','storm']) }),
  v.strictObject({ kind: v.literal('grass'),at: v.picklist(['self','player']) }),
  v.strictObject({ kind: v.literal('clock'),field: v.picklist(['hour','dayPhase','night']) }),
  v.strictObject({ kind: v.literal('time'),field: v.picklist(['t','dt']) }),
  v.strictObject({ kind: v.literal('weather'),field: v.literal('stormActive') }),
  v.strictObject({ kind: v.literal('actor'),field: v.picklist(['x','y','z','yaw','alive','speed','hpShare','attackPhase','lastHitValid','lastHitSeconds','scale','yOffset','hp','maxHp','seed','stunned','modSpeed']) }),
  v.variant('field',[
    v.strictObject({kind:v.literal('sense'),field:v.literal('visibility')}),
    v.strictObject({kind:v.literal('sense'),field:v.literal('downwind')}),
    v.strictObject({kind:v.literal('sense'),field:v.literal('hearing'),radii:v.strictTuple([
      v.pipe(finite,v.minValue(0)),v.pipe(finite,v.minValue(0)),v.pipe(finite,v.minValue(0)),v.pipe(finite,v.minValue(0))])}),
  ]),
  v.strictObject({kind:v.literal('memory'),key,default:memoryDefault,
    encoding:v.exactOptional(v.strictObject({kind:v.literal('negative-infinity'),part:v.picklist(['value','valid'])}))}),
  v.strictObject({kind:v.literal('memory-present'),keys:v.pipe(v.array(key),v.minLength(1),v.maxLength(64))}),
  v.strictObject({kind:v.literal('actor-state'),states:v.pipe(v.array(key),v.maxLength(64))}),
  v.strictObject({kind:v.literal('player-position'),axis:v.picklist(['x','y','z'])}),
  v.strictObject({kind:v.literal('context'),field:v.picklist(['calm','playerSpeed'])}),
  v.strictObject({kind:v.literal('hit'),axis:v.picklist(['x','y','z'])}),
  v.strictObject({kind:v.literal('request'),field:v.literal('present')}),
  v.strictObject({kind:v.literal('request-tags'),tags:v.pipe(v.array(key),v.maxLength(32))}),
  v.strictObject({kind:v.literal('equipment'),ids:v.pipe(v.array(key),v.maxLength(32))}),
  v.strictObject({kind:v.literal('result'),channel:key}),
  v.strictObject({kind:v.literal('reference'),binding:key,field:v.picklist(['present','handle','x','y','z','yaw','alive'])}),
  v.strictObject({kind:v.literal('bearing'),target:point}),
  v.strictObject({kind:v.literal('heading-offset'),target:v.union([v.strictObject({kind:v.literal('player')}),v.strictObject({kind:v.literal('memory'),key})])}),
  v.strictObject({kind:v.literal('distance-xz'),from:point,to:point}),
  v.strictObject({kind:v.literal('heading-component'),axis:v.picklist(['sin','cos']),sign:v.picklist([-1,1])}),
  v.strictObject({ kind: v.literal('herd'),group: key,slot: v.pipe(finite,v.integer(),v.minValue(0),v.maxValue(7)),
    field: v.picklist(['cx','cz','trust','alert','beaten','fleeing','sameActor','stallion']) }),
  v.strictObject({ kind: v.literal('herd-state'),group: key,slot: v.pipe(finite,v.integer(),v.minValue(0),v.maxValue(7)),states: codec }),
  v.strictObject({ kind: v.literal('taming'),field: v.picklist(['bonded','companion']) }),
  v.strictObject({ kind: v.literal('mount'),field: v.picklist(['mounted','actor']) }),
]);
/** Finite native observation selectors. Names label AS columns, never reflected
 * object paths. Clocks use explicit units; state codes are authored data. */
export const ObservationColumnsV2Schema = v.pipe(v.array(v.strictObject({ name: key,
  id: v.pipe(finite,v.integer(),v.minValue(1),v.maxValue(0x7fffffff)),source })),v.maxLength(128));
export type ObservationColumnV2 = v.InferOutput<typeof ObservationColumnsV2Schema>[number];
export function parseObservationColumnsV2(input: unknown): readonly ObservationColumnV2[] {
  if (!isJsonData(input)) throw new Error('Observation columns require JSON data');
  const rows = v.parse(ObservationColumnsV2Schema,input);
  if (new Set(rows.map(row => row.id)).size !== rows.length || new Set(rows.map(row => row.name)).size !== rows.length) throw new Error('Duplicate observation column');
  for (const row of rows) {
    const codes = row.source.kind==='herd-state' ? row.source.states : undefined;
    if (codes !== undefined && new Set(codes.map(code => code.state)).size !== codes.length) throw new Error('Duplicate observation state code');
  }
  return rows;
}
