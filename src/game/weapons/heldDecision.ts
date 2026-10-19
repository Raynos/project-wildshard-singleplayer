import * as v from 'valibot';
import type {Scope} from '@wildshard/engine/app/scope';
import { ReturnProgram } from '../population/returnProgram';
/** ABI-v1 scalar weapon projection, capped at ten snapshots per second.
 * Inputs accumulate in the native action owner until a snapshot is consumed. */
export class HeldDecision {
 private elapsed=0;
 readonly program:ReturnProgram;
 private readonly signal:string;
 constructor(input:unknown,owner?:Scope){const row=v.parse(v.strictObject({script:v.unknown(),bytes:v.string(),signal:v.optional(v.string(),'step')}),input);this.signal=row.signal;this.program=ReturnProgram.page({script:row.script,bytes:row.bytes},owner);}
 update(dt:number,observed:Readonly<Record<string,number>>,candidates:readonly Readonly<Record<string,number>>[]=[]):Readonly<Record<string,number>>|null{
  this.elapsed+=dt;if(this.elapsed<.1-1e-9)return null;
  const result=this.program.project(this.signal,{...observed,dt:this.elapsed,count:candidates.length},undefined,candidates);
  this.elapsed=0;return result;
 }
}
