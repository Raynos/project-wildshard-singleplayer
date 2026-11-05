import * as v from 'valibot';
import { QuestPageTalksSchema } from './npcs.ts';
import { QuestRuntimeFileSchema } from './questRuntime.ts';
import { ContractBoardPageSchema } from './contracts.ts';

const text=v.pipe(v.string(),v.minLength(1),v.maxLength(2048)),n=v.pipe(v.number(),v.finite());
const point=v.tuple([n,n,n]);
const transition=v.strictObject({full:n,lowered:n,seconds:v.pipe(n,v.minValue(Number.MIN_VALUE)),exponent:v.pipe(n,v.minValue(Number.MIN_VALUE)),
  depth:text,film:n,lift:n,bank:n,reveal:v.pipe(v.array(n),v.length(2))});
const surface=v.strictObject({look:text,name:text,renderOrder:v.pipe(n,v.integer(),v.minValue(0),v.maxValue(16))});
const board = v.omit(ContractBoardPageSchema, ['contracts', 'panel', 'store']);
/** G1004: complete authored story bindings. World, map, pool and cable fields
 * retain their original entered-world owners; this contract adds no decisions. */
export const QuestStoryBindingsSchema:v.GenericSchema<unknown,QuestStoryBindingsRows>=v.strictObject({
  page:text,ranged:text,quest:text,spawns:text,content:QuestRuntimeFileSchema,
  panels:v.strictObject({board:text,count:text}),
  files:v.strictObject({stall:text,contracts:text,signals:text,door:text,services:text,director:text}),
  store:ContractBoardPageSchema.entries.store,pickupEvent:text,wheel:v.strictObject({flag:text,speed:n}),door:v.strictObject({id:text,flag:text}),
  board:v.strictObject({...board.entries,ammunition:board.entries.ammunition.wrapped}),
  debug:v.strictObject({id:text,browser:text}),
  collections:v.pipe(v.array(v.strictObject({event:text,completeEvent:text,prefix:text,names:v.pipe(v.array(text),v.maxLength(256)),label:text,complete:text})),v.maxLength(64)),
  shelf:v.strictObject({scene:text,collection:text}),talks:QuestPageTalksSchema,
  secret:v.strictObject({x:n,z:n,yaw:n,floorY:n,mid:point,mouths:v.pipe(v.array(point),v.maxLength(256)),
    floor:v.strictObject({x:n,z:n,hw:n,hd:n,y:n,rot:n}),scene:text,projection:text}),
  signals:v.pipe(v.array(v.strictObject({id:text,x:n,z:n,height:n})),v.maxLength(256)),
  cable:v.strictObject({id:text,scene:text,trolley:text,prompt:point,radius:n,label:text,top:point,launch:point,landing:point,arrival:text,audio:text,shot:text}),
  mover:v.strictObject({id:text,mesh:text,binding:v.strictObject({systemId:text,bindings:v.pipe(v.array(v.strictObject({id:text,target:text,
    group:v.literal('group'),visibility:v.literal('enabled'),order:v.literal('XYZ')})),v.maxLength(32))}),rest:text}),
  journal:v.strictObject({event:text}),
  pool:v.strictObject({name:text,flag:text,water:text,still:v.strictObject({scene:text,surface:v.strictObject({...surface.entries,transition})}),
    trickle:v.strictObject({scene:text,surface}),level:v.strictObject({look:text,param:text}),fade:v.strictObject({look:text,param:text})}),
  map:v.strictObject({pois:v.pipe(v.array(v.strictObject({id:text,name:text,x:n,z:n,r:n,foot:v.nullable(v.tuple([n,n]))})),v.maxLength(4096)),
    zones:v.pipe(v.array(v.strictObject({label:text,x:n,z:n})),v.maxLength(4096))}),
  jumps:v.pipe(v.record(text,v.strictObject({x:n,z:n,phase:v.exactOptional(n),height:v.exactOptional(v.strictObject({x:n,z:n,up:n})),
    look:v.strictObject({x:n,z:n,yaw:v.exactOptional(n)}),flags:v.pipe(v.array(text),v.maxLength(256))})),v.maxEntries(256)),
});

export interface QuestStoryBindingsRows { talks: v.InferOutput<typeof QuestPageTalksSchema>; content: string; board: { at: { x: number; z: number; yaw: number; }; finishes: Record<string, string>; ammunition: { loadout: string; kind: string; }; height: number; radius: number; notices: { claimed: string; filled: string; progress: string; }; label: string; filled: string; }; door: { id: string; flag: string; }; signals: { id: string; x: number; z: number; height: number; }[]; cable: { id: string; scene: string; trolley: string; prompt: [number, number, number]; radius: number; label: string; top: [number, number, number]; launch: [number, number, number]; landing: [number, number, number]; arrival: string; audio: string; shot: string; }; mover: { id: string; mesh: string; binding: { systemId: string; bindings: { id: string; target: string; group: string; visibility: string; order: string; }[]; }; rest: string; }; secret: { mid: [number, number, number]; mouths: [number, number, number][]; scene: string; projection: string; x: number; z: number; yaw: number; floorY: number; floor: { x: number; z: number; hw: number; hd: number; y: number; rot: number; }; };
// the views' rows (game/quest/questPageViews): the journal-complete achievement; the dam sluice's flag lowers the pool
journal: { event: string; };
// the beaver pool: the dam sluice's flag lowers it (its look stands the surface over the bed, the declared creek's pool
// stretch follows its level, generators/bake-geography.mjs POOL_LEVEL), the dam's trickle fades in across the travel
pool: { name: string; flag: string; water: string; still: { scene: string; surface: { look: string; name: string; renderOrder: number; transition: { full: number; lowered: number; seconds: number; exponent: number; depth: string; film: number; lift: number; bank: number; reveal: number[]; }; }; }; trickle: { scene: string; surface: { look: string; name: string; renderOrder: number; }; }; level: { look: string; param: string; }; fade: { look: string; param: string; }; }; map: { pois: { id: string; name: string; x: number; z: number; r: number; foot: [number, number] | null; }[]; zones: { label: string; x: number; z: number; }[]; }; jumps: Record<string, { phase?: number; height?: { x: number; z: number; up: number; }; look: { x: number; z: number; yaw?: number; }; flags: string[]; x: number; z: number; }>; page: string; ranged: string; quest: string; spawns: string; panels: { board: string; count: string; }; files: { stall: string; contracts: string; signals: string; door: string; services: string; director: string; }; store: { slot: string; state: string; }; pickupEvent: string; wheel: { flag: string; speed: number; }; debug: { id: string; browser: string; }; collections: { event: string; completeEvent: string; prefix: string; names: string[]; label: string; complete: string; }[]; shelf: { scene: string; collection: string; }; }
