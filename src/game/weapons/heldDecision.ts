import type {Scope} from '@wildshard/engine/app/scope';
import { ReturnProgram } from '../population/returnProgram';
/** ABI-v1 scalar weapon projection, capped at ten snapshots per second.
 * Inputs accumulate in the native action owner until a snapshot is consumed. */
export class HeldDecision {
 private elapsed=0;
 readonly program:ReturnProgram;
 constructor(input:unknown,owner?:Scope){this.program=ReturnProgram.page(input,owner);}
 update(dt:number,observed:Readonly<Record<string,number>>,candidates:readonly Readonly<Record<string,number>>[]=[]):Readonly<Record<string,number>>|null{
  this.elapsed+=dt;if(this.elapsed<.1-1e-9)return null;
  const result=this.program.project('step',{...observed,dt:this.elapsed,count:candidates.length},undefined,candidates);
  this.elapsed=0;return result;
 }
}
