// oxlint-disable-next-line import/no-nodejs-modules -- Bind the actual earned continuation and input ledger between two bounded children.
import {createHash} from 'node:crypto';
import * as v from 'valibot';
import {HeadlessTapePlanSchema,HeadlessTapeReportSchema} from '../../../src/sdk/tickProtocol';

const natural=v.pipe(v.number(),v.safeInteger(),v.minValue(0));
const digest=v.pipe(v.string(),v.regex(/^[a-f0-9]{64}$/u));
export const TitanPartSchema=v.strictObject({plan:HeadlessTapePlanSchema,expected:HeadlessTapeReportSchema,digest});
export type TitanPart=v.InferOutput<typeof TitanPartSchema>;
export const TitanHandoffSchema=v.strictObject({version:v.literal(1),source:digest,snapshot:v.pipe(v.string(),v.maxLength(24_000_000)),digest,
  checkpointTick:natural,captureTicks:natural,initialKills:natural,
  parts:v.pipe(v.array(TitanPartSchema),v.minLength(1),v.maxLength(128))});
export type TitanHandoff=v.InferOutput<typeof TitanHandoffSchema>;
export const titanWireHash=(wire:string):string=>createHash('sha256').update(wire).digest('hex');

/** The second case inherits the first case's actual, checked inputs and
 * observations. A fresh worker does not grant a second tape allowance. */
export function checkTitanLedger(parts:readonly TitanPart[],checkpointTick:number):void{
  let tick=checkpointTick,commands=0,bytes=0;
  if(parts.length>128)throw new Error('Titan aggregate part allowance exceeded');
  for(let index=0;index<parts.length;index++){
    const part=parts[index];if(part===undefined)throw new Error('Missing Titan part');
    const segment=part.plan.segments[0],observation=part.expected.observations[0];
    if(part.plan.segments.length!==1||segment===undefined||segment.id!==`titan-${index}`||segment.ticks>512
      ||segment.frames?.length!==segment.ticks||segment.commands.length>0||segment.route!==undefined
      ||JSON.stringify(part.plan.observe)!==JSON.stringify(['nalati.titan','nalati.weapons','nalati.chapter-records'])
      ||part.expected.observations.length!==1||observation?.id!==segment.id||part.expected.ticks!==segment.ticks)
      throw new Error('Titan handoff changed an ordered part');
    tick+=segment.ticks;
    if(observation.tick!==tick)throw new Error('Titan handoff skipped an input interval');
    commands+=segment.frames.reduce((sum,frame)=>sum+frame.length,0);
    bytes+=new TextEncoder().encode(JSON.stringify(observation)).byteLength;
  }
  if(tick-checkpointTick>60_000||commands>60_000||bytes>8_000_000)throw new Error('Titan aggregate tape allowance exceeded');
}
