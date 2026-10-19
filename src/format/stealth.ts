import * as v from 'valibot';

const id=v.pipe(v.string(),v.minLength(1),v.maxLength(128)),text=v.pipe(v.string(),v.maxLength(4096)),n=v.pipe(v.number(),v.finite());
/** Bounded static baseline-HUD markup; detection decisions are admitted separately as ABI-v1 programs. */
interface Frame {tag?:'div'|'span'|'b'|'i';cls?:string;ref?:string;text?:string;data?:Record<string,string>;children?:Frame[]}
interface Icon {svg:'svg'|'path'|'circle'|'g'|'rect'|'line'|'polyline'|'polygon'|'ellipse';attrs?:[string,string][];children?:Icon[]}
const frame:v.GenericSchema<unknown,Frame>=v.lazy(()=>v.strictObject({tag:v.exactOptional(v.picklist(['div','span','b','i'])),cls:v.exactOptional(text),ref:v.exactOptional(id),text:v.exactOptional(text),data:v.exactOptional(v.record(id,text)),children:v.exactOptional(v.pipe(v.array(frame),v.maxLength(32)))}));
const icon:v.GenericSchema<unknown,Icon>=v.lazy(()=>v.strictObject({svg:v.picklist(['svg','path','circle','g','rect','line','polyline','polygon','ellipse']),attrs:v.exactOptional(v.pipe(v.array(v.tuple([text,text])),v.maxLength(32))),children:v.exactOptional(v.pipe(v.array(icon),v.maxLength(32)))}));
/** G478 stealth-and-detection rows, shared by independent shard profiles. Client markup is presentation only. */
export const StealthRowsSchema=v.strictObject({program:v.unknown(),tuning:v.pipe(v.record(id,n),v.check(rows=>Object.keys(rows).length<=64)),
 states:v.pipe(v.array(id),v.minLength(1),v.maxLength(16)),labels:v.record(id,text),panels:v.strictObject({layer:frame,row:frame,grass:frame}),icons:v.record(id,icon),
 disc:text,discLabel:text,threatStates:v.pipe(v.array(id),v.maxLength(16)),hint:text,hintSeconds:v.pipe(n,v.minValue(0),v.maxValue(60)),system:id,
 input:v.strictObject({id,actions:v.pipe(v.array(v.picklist(['crouch','crouch.hold'])),v.maxLength(2)),keys:v.record(v.picklist(['crouch','crouch.hold']),v.pipe(v.array(id),v.maxLength(16)))}),
 sneak:v.strictObject({state:id,seconds:v.pipe(n,v.minValue(0),v.maxValue(60)),multiplier:v.pipe(n,v.minValue(0),v.maxValue(100))})});
export type StealthRows=v.InferOutput<typeof StealthRowsSchema>;
