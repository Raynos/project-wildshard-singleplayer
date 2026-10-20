import * as v from 'valibot';
import { PageGroupRowsSchema } from './creatures';
import { ReturnProgramSchema } from './namedJsonContracts';
import { ForagerPopulationSchema, ForagerContinuation } from './ambientLife';

const n = v.pipe(v.number(),v.finite()),id = v.pipe(v.string(),v.minLength(1),v.maxLength(128));
const count = v.pipe(n,v.integer(),v.minValue(0),v.maxValue(256)),point = { x: n,z: n };
/** Ordered page population placement and native relationships. Presentation
 * receives explicit crowd/forager build commands instead of factory callbacks. */
export const WildlifePopulationSchema = v.strictObject({
  seed: n,random: n,groups: PageGroupRowsSchema,admission: ReturnProgramSchema,pasture: ReturnProgramSchema,
  kinds: v.strictObject({ predator: id,mount: id,guardian: id,guardianVariant: id }),
  coats: v.array(id),young: v.array(id),leader: id,
  packs: v.pipe(v.array(v.strictObject({ ...point,variants: v.array(id) })),v.maxLength(8)),
  herds: v.pipe(v.array(v.strictObject({ ...point,mares: count,foals: count,stallion: v.boolean() })),v.maxLength(8)),
  flocks: v.pipe(v.array(v.strictObject({ ...point,count,dog: v.boolean(),range: v.optional(n,45) })),v.maxLength(4)),
  mountables: v.array(v.strictObject({ ...point,yaw: n,variant: id })),
  foragers: v.nullable(v.strictObject({ row: ForagerPopulationSchema,seed: n,initial: ForagerContinuation,cue: id,runSpeed: n })),
  relations: v.strictObject({ alert: id,range: id,packRadius: n,disturbRadius: n,disturbSeconds: n,scareSeconds: n }),
  trample: v.strictObject({ kinds: v.record(id,n),minSpeed: n,range: n,fullSpeed: n }),
  soundHeight: n,
});
