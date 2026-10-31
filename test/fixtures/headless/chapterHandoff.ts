// oxlint-disable-next-line import/no-nodejs-modules -- Content-address the actual checked native continuation.
import {createHash} from 'node:crypto';
import * as v from 'valibot';
import {HeadlessTapePlanSchema,HeadlessTapeReportSchema} from '../../../src/sdk/tickProtocol';
import {decodeSimSnapshot,type SimSnapshot,type SimSnapshotBytes} from '../../../src/engine/sim/snapshot';
import {physicsState} from '../../fake/simState';
import {PACKED_CHAPTER_TAMING,unpackChapterTaming} from './chapterObservation';

const natural=v.pipe(v.number(),v.safeInteger(),v.minValue(0)),digest=v.pipe(v.string(),v.regex(/^[a-f0-9]{64}$/u));
export const chapterObserved:readonly string[]=Object.freeze(['nalati.taming','nalati.chapter','nalati.kokpar','nalati.talk','nalati.king-closed']);
export const chapterTwoObserved:readonly string[]=Object.freeze([PACKED_CHAPTER_TAMING,...chapterObserved.slice(1)]);
export const ChapterPartSchema=v.strictObject({plan:HeadlessTapePlanSchema,expected:HeadlessTapeReportSchema,digest});
export type ChapterPart=v.InferOutput<typeof ChapterPartSchema>;
export const ChapterHandoffSchema=v.pipe(v.strictObject({version:v.literal(1),stage:v.picklist(['plains','approach','bond','goat','return','home','carving-road','carving-arrival','carvings']),source:digest,
  tick:natural,bondStart:v.optional(natural),snapshot:v.pipe(v.string(),v.maxLength(24_000_000)),digest,parts:v.pipe(v.array(ChapterPartSchema),v.minLength(1),v.maxLength(128))}),
  v.check(row=>row.stage==='approach'?row.bondStart!==undefined&&row.bondStart<row.tick
    &&row.parts.some(part=>part.expected.observations[0]?.tick===row.bondStart):row.bondStart===undefined,
  'Only an earned approach carries its original bond input budget'));
export type ChapterHandoff=v.InferOutput<typeof ChapterHandoffSchema>;

/** Unlike ordinary JSON, preserve every original signed-zero input and
 * observation through a child boundary. The strict schemas admit no marker. */
export function chapterWire(value:unknown):string {
  return JSON.stringify(value,(_key:string,entry:unknown):unknown=>typeof entry==='number'&&Object.is(entry,-0)?{'chapter.number':'-0'}:entry);
}
export function chapterRead(wire:string):unknown {
  return JSON.parse(wire,(_key:string,entry:unknown):unknown=>{
    if(entry!==null&&typeof entry==='object'&&!Array.isArray(entry)&&Object.keys(entry).length===1&&Reflect.get(entry,'chapter.number')==='-0')return -0;
    return entry;
  });
}
export const chapterWireHash=(wire:string):string=>createHash('sha256').update(wire).digest('hex');
const canonical=(value:unknown):string=>JSON.stringify(value,(_key:string,entry:unknown):unknown=>{
  if(typeof entry==='number'&&Object.is(entry,-0))return {'chapter.number':'-0'};
  return entry!==null&&typeof entry==='object'&&!Array.isArray(entry)
    ?Object.fromEntries(Object.entries(entry).sort(([a],[b])=>a.localeCompare(b))):entry;
});
export const chapterInputHash=(parts:readonly ChapterPart[]):string=>createHash('sha256')
  .update(canonical(parts.flatMap(part=>part.plan.segments.flatMap(segment=>segment.frames??[])))).digest('hex');
/** Object key order is codec-independent; arrays and every numeric bit stay
 * exact, including signed zero outside physics. Physics uses its real world. */
export function chapterSnapshotDigest(snapshot:SimSnapshot|SimSnapshotBytes|string):string {
  const {physics,...rest}=typeof snapshot==='string'?decodeSimSnapshot(snapshot):snapshot;
  return createHash('sha256').update(canonical(rest)).update('\0')
    .update(new Uint8Array(Float64Array.from(physicsState(physics).values).buffer)).digest('hex');
}
/** Every earned child inherits the whole preceding ledger. A new worker
 * grants no second part, command, tick or observation allowance. */
export function checkChapterLedger(parts:readonly ChapterPart[],tick:number):void {
  let actualTick=0,commands=0,bytes=0,packed=false;
  if(parts.length>128)throw new Error('Chapter aggregate part allowance exceeded');
  for(let index=0;index<parts.length;index++){
    const part=parts[index];if(part===undefined)throw new Error('Missing chapter part');
    const segment=part.plan.segments[0],observation=part.expected.observations[0];
    const selection=JSON.stringify(part.plan.observe),fullSelection=selection===JSON.stringify(chapterObserved),packedSelection=selection===JSON.stringify(chapterTwoObserved);
    if(packedSelection){
      const preceding=parts[index-1]?.expected.observations[0];
      if(preceding?.flags.includes('quest:tulpar')!==true)throw new Error('Packed chapter observation requires its earned first-chapter completion');
      const loan=observation?.adapters?.find(row=>row.id===PACKED_CHAPTER_TAMING);
      if(loan===undefined)throw new Error('Missing complete packed taming observation');unpackChapterTaming(loan.state);packed=true;
    }else if(packed||!fullSelection)throw new Error('Chapter handoff changed an ordered input observation selection');
    if(part.plan.segments.length!==1||segment===undefined||segment.id!==`chapter-${index}`||segment.ticks<1||segment.ticks>512
      ||segment.frames?.length!==segment.ticks||segment.commands.length>0||segment.route!==undefined
      ||part.expected.observations.length!==1
      ||observation?.id!==segment.id||part.expected.ticks!==segment.ticks)throw new Error('Chapter handoff changed an ordered input part');
    actualTick+=segment.ticks;if(observation.tick!==actualTick)throw new Error('Chapter handoff skipped an input interval');
    commands+=segment.frames.reduce((sum,frame)=>sum+frame.length,0);
    bytes+=new TextEncoder().encode(JSON.stringify(observation)).byteLength;
  }
  if(actualTick!==tick)throw new Error('Chapter handoff lost its actual tick');
  if(tick>60_000||commands>60_000||bytes>8_000_000)throw new Error('Chapter aggregate tape allowance exceeded');
}
