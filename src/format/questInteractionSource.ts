import * as v from 'valibot';
import {isJsonData} from './json.ts';

const n=v.pipe(v.number(),v.finite(),v.minValue(-1_000_000),v.maxValue(1_000_000));
const key=v.pipe(v.string(),v.minLength(1),v.maxLength(256)),text=v.pipe(v.string(),v.maxLength(2048));
const names=v.pipe(v.array(key),v.maxLength(4096));
const condition=v.strictObject({all:v.exactOptional(names),any:v.exactOptional(names),none:v.exactOptional(names)});
const place=v.strictObject({poi:v.picklist(['world','hut','lookout','wreck','shrine','cave','pier']),x:n,z:n,yaw:v.exactOptional(n),y:v.exactOptional(n),dy:v.exactOptional(n),anchor:v.exactOptional(key)});
const base={id:v.pipe(key,v.regex(/^[a-z0-9][a-z0-9-]{0,47}$/u)),at:place,requires:v.exactOptional(condition),lockedLabel:v.exactOptional(text),showWhen:v.exactOptional(condition),
  sets:v.exactOptional(names),toast:v.exactOptional(text),reach:v.exactOptional(v.pipe(n,v.minValue(.8),v.maxValue(6)))};
const contents=v.pipe(v.array(v.union([
  v.strictObject({item:key,n:v.exactOptional(v.pipe(n,v.integer(),v.minValue(1),v.maxValue(99)))}),
  v.strictObject({key,label:text}),v.strictObject({flag:key,label:text}),
])),v.minLength(1),v.maxLength(4096));
interface Condition {all?:string[];any?:string[];none?:string[]}
export interface QuestInteractionPlace {poi:'world'|'hut'|'lookout'|'wreck'|'shrine'|'cave'|'pier';x:number;z:number;yaw?:number;y?:number;dy?:number;anchor?:string}
interface Base {id:string;at:QuestInteractionPlace;requires?:Condition;lockedLabel?:string;showWhen?:Condition;sets?:string[];toast?:string;reach?:number}
export type QuestInteractionRow=Base & (
 {kind:'chest';lock?:string;contents:({item:string;n?:number}|{key:string;label:string}|{flag:string;label:string})[];look?:'chest'|'strongbox'|'treasure'}|
 {kind:'key';key:string;label:string}|{kind:'door';w:number;h:number;look:'plank'|'grate'|'sluice';lock?:string;opensWhen?:Condition;latch?:boolean}|
 {kind:'lever';label?:string;latch?:boolean}|{kind:'plate';size:number;by:'player'|'barrel'|'any'}|{kind:'barrel';leash:number}|
 {kind:'pickup';look:string;item?:string;label:string;touch?:boolean;color?:string}|{kind:'beacon';label:string}|{kind:'bench';label:string}|
 {kind:'altar';label:string;fills:string[];socketLook:string}
);
export interface QuestInteractionTable {external:string[];rows:QuestInteractionRow[]}
/** Complete data table of the existing native interaction kit. Its original
 * validateTable still owns flags, locks, inventory and platform resource ids. */
export const QuestInteractionTableSchema:v.GenericSchema<unknown,QuestInteractionTable>=v.strictObject({external:v.pipe(v.array(v.pipe(key,v.regex(/^[a-z]+:[a-z0-9-]+$/u))),v.maxLength(4096)),
 rows:v.pipe(v.array(v.variant('kind',[
  v.strictObject({...base,kind:v.literal('chest'),lock:v.exactOptional(key),contents,look:v.exactOptional(v.picklist(['chest','strongbox','treasure']))}),
  v.strictObject({...base,kind:v.literal('key'),key,label:text}),
  v.strictObject({...base,kind:v.literal('door'),w:v.pipe(n,v.minValue(Number.MIN_VALUE),v.maxValue(6)),h:v.pipe(n,v.minValue(Number.MIN_VALUE),v.maxValue(6)),look:v.picklist(['plank','grate','sluice']),lock:v.exactOptional(key),opensWhen:v.exactOptional(condition),latch:v.exactOptional(v.boolean())}),
  v.strictObject({...base,kind:v.literal('lever'),label:v.exactOptional(text),latch:v.exactOptional(v.boolean())}),
  v.strictObject({...base,kind:v.literal('plate'),size:v.pipe(n,v.check(value=>value>.3),v.maxValue(4)),by:v.picklist(['player','barrel','any'])}),
  v.strictObject({...base,kind:v.literal('barrel'),leash:v.pipe(n,v.check(value=>value>1),v.maxValue(40))}),
  v.strictObject({...base,kind:v.literal('pickup'),look:key,item:v.exactOptional(key),label:text,touch:v.exactOptional(v.boolean()),color:v.exactOptional(text)}),
  v.strictObject({...base,kind:v.literal('beacon'),label:text}),v.strictObject({...base,kind:v.literal('bench'),label:text}),
  v.strictObject({...base,kind:v.literal('altar'),label:text,fills:v.pipe(v.array(key),v.minLength(1),v.maxLength(8)),socketLook:key}),
 ])),v.maxLength(256)),
});
export interface QuestInteractionPlacement {
 id:string;kind:string;x:number;y:number;z:number;yaw:number;prompt?:{x:number;y:number;z:number};
 collider?:{x:number;z:number;hw:number;hd:number;rot:number;yBottom:number;yTop:number};
}
export interface QuestInteractionSourceRows {constants:{interact:QuestInteractionTable;interactSpots:QuestInteractionPlacement[]}}
const placement=v.strictObject({id:key,kind:v.pipe(key,v.maxLength(64)),x:n,y:n,z:n,yaw:n,prompt:v.exactOptional(v.strictObject({x:n,y:n,z:n})),
 collider:v.exactOptional(v.strictObject({x:n,z:n,hw:n,hd:n,rot:n,yBottom:n,yTop:n}))});
/** G1004: the whole native guest-input envelope. Do not replace it with an
 * unknown constants map or project away its prompt/collider metadata. */
export const QuestInteractionSourceSchema:v.GenericSchema<unknown,QuestInteractionSourceRows>=v.pipe(v.unknown(),v.check(isJsonData),v.strictObject({
 constants:v.strictObject({interact:QuestInteractionTableSchema,interactSpots:v.pipe(v.array(placement),v.maxLength(4096))}),
}),v.check(row=>{
 const rows=row.constants.interact.rows,spots=row.constants.interactSpots;
 const ids=new Map(spots.map(spot=>[spot.id,spot.kind]));
 return ids.size===spots.length&&new Set(rows.map(item=>item.id)).size===rows.length
  &&rows.length===spots.length&&rows.every(item=>ids.get(item.id)===item.kind);
},'Exact native interaction placements'));
