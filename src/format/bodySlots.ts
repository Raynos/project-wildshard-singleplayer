import * as v from 'valibot';
import { isJsonData } from './json';

/** Admitted ball-body pool policy; optional mechanics remain absent unless authored. */
export interface BodySlotsData {
 count:number; clocks:'f32'|'number'; initial:1|2;
 restSpeed:number; restTime:number; maxAge:number; inclusive:boolean;
 landing?:{impact:number;timeout:number;wet:boolean;clearDistance:number};
 body:{radius:number;material:'wood'|'stone'|'metal';density:number;friction:number;restitution:number;angularDamping:number;
  rolling?:number;group:'ITEM'|'DEBRIS';ccd:boolean;expendable:boolean};
 contact?:{radius:number;height:number;horizontalBounce:number;up:number};
 float?:{level:number;buoyancy:number;drag:number;waves:boolean};
 spin?:{phase:[number,number];x:[number,number];y:[number,number];z:[number,number]};
 settle?:{depth:number};
}
interface BodyIdentity {id:string;at:{x:number;y:number;z:number};yaw:number}
interface DeclaredActorBody extends BodyIdentity {kind:'actor';species:string;variant:string}
interface DeclaredPropBody extends BodyIdentity {
 kind:'prop';shape:{ball:number}|{cylinder:{radius:number;halfHeight:number}}|{cuboid:{x:number;y:number;z:number}};
 owner:{kind:string;id:string};material:'wood'|'stone'|'metal'|'sand'|'grass'|'rock'|'earth'|'felt';
 density?:number;friction?:number;restitution?:number;linearDamping?:number;angularDamping?:number;rolling?:number;
 keep?:boolean;expendable?:boolean;ccd?:boolean;group?:'ITEM'|'DEBRIS';
}
/** JSON-only body/collider rows; no raw native handle is authored. */
export interface DeclaredBodyOpsRows {
 bodies:(DeclaredActorBody|DeclaredPropBody)[];
 floors:{x:number;z:number;step:number;width:number;height:number;values:(number|null)[]}[];
 colliders:{id:string;target:{kind:'body';body:string}|{kind:'box';box:{x:number;z:number;hw:number;hd:number;yTop:number;yBottom:number}}}[];
}

const nonnegative = v.pipe(v.number(), v.finite(), v.minValue(0));
const positive = v.pipe(nonnegative, v.minValue(Number.MIN_VALUE));
const range = v.pipe(v.tuple([v.pipe(v.number(), v.finite()), v.pipe(v.number(), v.finite())]), v.check(([a, b]) => a <= b));
/** Bounded ball-body mechanics. Contact produces value events; no content callback is accepted. */
export const BodySlotsSchema: v.GenericSchema<BodySlotsData> = v.strictObject({
  count: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(128)), clocks: v.picklist(['f32', 'number']), initial: v.picklist([1, 2]),
  restSpeed: nonnegative, restTime: nonnegative, maxAge: nonnegative, inclusive: v.boolean(),
  landing: v.exactOptional(v.strictObject({ impact: nonnegative, timeout: nonnegative, wet: v.boolean(), clearDistance: nonnegative })),
  body: v.strictObject({ radius: positive, material: v.picklist(['wood', 'stone', 'metal']), density: positive, friction: nonnegative, restitution: nonnegative, angularDamping: nonnegative,
    rolling: v.exactOptional(v.pipe(nonnegative, v.maxValue(1))), group: v.picklist(['ITEM', 'DEBRIS']), ccd: v.boolean(), expendable: v.boolean() }),
  contact: v.exactOptional(v.strictObject({ radius: positive, height: nonnegative, horizontalBounce: v.pipe(v.number(), v.finite()), up: nonnegative })),
  float: v.exactOptional(v.strictObject({ level: v.pipe(v.number(), v.finite()), buoyancy: positive, drag: nonnegative, waves: v.boolean() })),
  spin: v.exactOptional(v.strictObject({ phase: range, x: range, y: range, z: range })),
  settle: v.exactOptional(v.strictObject({ depth: positive })),
});


const declaredId = v.pipe(v.string(), v.minLength(1), v.maxLength(128));
const declaredFinite = v.pipe(v.number(), v.finite());
const declaredPoint = v.strictObject({ x: declaredFinite, y: declaredFinite, z: declaredFinite });
const declaredPositive = v.pipe(declaredFinite, v.minValue(Number.MIN_VALUE));
const declaredBase = { id: declaredId, at: declaredPoint, yaw: declaredFinite };
const declaredShape = v.union([
  v.strictObject({ ball: declaredPositive }),
  v.strictObject({ cylinder: v.strictObject({ radius: declaredPositive, halfHeight: declaredPositive }) }),
  v.strictObject({ cuboid: v.strictObject({ x: declaredPositive, y: declaredPositive, z: declaredPositive }) }),
]);
/** Declared body identities, immutable profiles and original collision targets.
 * Actors are client-only native species bodies outside manager target lists.
 * Props use the existing dynamic-body service and its unchanged tier caps. */
export const DeclaredBodyOpsSchema: v.GenericSchema<unknown,DeclaredBodyOpsRows> = v.pipe(v.unknown(), v.check(isJsonData, 'Declared bodies require plain JSON data'), v.strictObject({
  bodies: v.pipe(v.array(v.variant('kind', [
    v.strictObject({ ...declaredBase, kind: v.literal('actor'), species: declaredId, variant: declaredId }),
    v.strictObject({ ...declaredBase, kind: v.literal('prop'), shape: declaredShape,
      owner: v.strictObject({ kind: declaredId, id: declaredId }),
      material: v.picklist(['wood', 'stone', 'metal', 'sand', 'grass', 'rock', 'earth', 'felt']),
      density: v.exactOptional(declaredPositive), friction: v.exactOptional(nonnegative), restitution: v.exactOptional(nonnegative),
      linearDamping: v.exactOptional(nonnegative), angularDamping: v.exactOptional(nonnegative), rolling: v.exactOptional(v.pipe(nonnegative, v.maxValue(1))),
      keep: v.exactOptional(v.boolean()), expendable: v.exactOptional(v.boolean()), ccd: v.exactOptional(v.boolean()),
      group: v.exactOptional(v.picklist(['ITEM', 'DEBRIS'])),
    }),
  ])), v.maxLength(64)),
  floors: v.optional(v.pipe(v.array(v.strictObject({ x: declaredFinite, z: declaredFinite, step: v.pipe(declaredFinite, v.minValue(.001)),
    width: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(64)), height: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(64)),
    values: v.pipe(v.array(v.nullable(declaredFinite)), v.maxLength(4096)),
  })), v.maxLength(64)), []),
  colliders: v.pipe(v.array(v.strictObject({ id: declaredId, target: v.variant('kind', [
    v.strictObject({ kind: v.literal('body'), body: declaredId }),
    v.strictObject({ kind: v.literal('box'), box: v.strictObject({ x: declaredFinite, z: declaredFinite,
      hw: declaredPositive, hd: declaredPositive, yTop: declaredFinite, yBottom: declaredFinite }) }),
  ]) })), v.maxLength(64)),
}), v.check(rows => rows.floors.every(row => row.values.length === row.width * row.height)
  && new Set(rows.bodies.map(row => row.id)).size === rows.bodies.length
  && new Set(rows.colliders.map(row => row.id)).size === rows.colliders.length
  && rows.colliders.every(row => row.target.kind !== 'body' || rows.bodies.some(body => body.kind === 'prop' && row.target.kind === 'body' && body.id === row.target.body)), 'unique body and collider identities with declared prop targets'));
/** Compiler and runtime resolve the same sorted identities, independently of aliases. */
export function declaredBodyRegistries(rows: DeclaredBodyOpsRows): { bodies: ReadonlyMap<string, number>; colliders: ReadonlyMap<string, number> } {
  const catalogue = (names: readonly string[]): ReadonlyMap<string, number> => new Map([...names].sort().map((name, index) => [name, index + 1]));
  return { bodies: catalogue(rows.bodies.map(row => row.id)), colliders: catalogue(rows.colliders.map(row => row.id)) };
}
