/** Synchronous stateless numeric projection. This installs no clock, query or
 * body owner; callers retain their existing continuation and decision slots. */
import { parseReturnProjectionV2,returnProjectionV2Layout } from '@wildshard/format/returnProjectionV2';
import { prepareV2Rng } from '@wildshard/format/scriptRngV2';
import { admitScriptV2 } from '@wildshard/format/scriptAdmissionV2';
import { writeV2Frame,validateV2Frame,type V2FrameAuthority } from '@wildshard/format/scriptWireV2';
import type { Rng,RngState } from '@wildshard/engine/core/rng';
import { sha256 } from '../plugin/moduleHash';
import { ScriptModuleV2 } from '@wildshard/engine/script/moduleV2';
import { prepareV2Observations } from '@wildshard/engine/script/observationsV2';

export interface PreparedProjectionV2 { readonly values: Readonly<Record<string,number>>; readonly accept: () => void }
function sameRng(a: RngState,b: RngState): boolean {
  return a.version === b.version && a.state === b.state && a.initial === b.initial && a.scrambledFork === b.scrambledFork;
}
export class ReturnProjectionV2 {
  private readonly row;
  private readonly layout;
  private readonly module: ScriptModuleV2;
  private busy = false;
  constructor(input: unknown) {
    this.row = parseReturnProjectionV2(input);this.layout = returnProjectionV2Layout(this.row.fields.length,this.row.artifact.pages);
    const bytes = Uint8Array.from(atob(this.row.bytes),byte => byte.codePointAt(0) ?? 0);
    if (sha256(bytes) !== this.row.artifact.hash) throw new Error('Return projection hash mismatch');
    const admitted = admitScriptV2(bytes,{ lane: 'project',ioBytes: this.layout.bytes,compilerRevision: this.row.artifact.compilerRevision,admissionRevision: this.row.artifact.admissionRevision });
    if (admitted.initialPages !== this.row.artifact.pages || admitted.io !== this.layout.io) throw new Error('Return projection layout mismatch');
    this.module = new ScriptModuleV2(bytes,{ seed: [0,0],initFuel: 400000,output: [],ioBytes: this.layout.bytes });
    if (this.module.io !== this.layout.io) throw new Error('Return projection IO mismatch');
  }
  /** Capture once. No RNG is changed until the caller has validated its retained
   * state as well as every channel. Traps and rejected candidates consume none. */
  prepare(signal: string,observations: Readonly<Record<string,number>>,random?: Rng,candidates: readonly Readonly<Record<string,number>>[] = []): PreparedProjectionV2 {
    if (this.busy) throw new Error('Reentrant return projection');
    const signalId = this.row.signals.indexOf(signal)+1;
    if (signalId === 0 || candidates.length > 8 || [observations,...candidates].some(frame => Object.values(frame).some(value => !Number.isFinite(value)))) throw new Error('Invalid return request');
    const before = random?.snapshot(), layout = this.layout;
    const rng = prepareV2Rng(layout,before === undefined ? [] : [{ binding: 1,stream: 1,algorithm: 1,
      state: [before.state,before.initial,Number(before.scrambledFork),0,0,0] }]);
    const fields = Array.from({ length: 9 },(_,actor) => this.row.fields.map((name,index) => {
      const frame = actor === 0 ? observations : candidates[actor-1],value = frame?.[name];
      return { name: `${String(actor)}/${name}`,id: actor*this.row.fields.length+index+1,...(value === undefined ? {} : { value }) };
    })).flat();
    const input = prepareV2Observations(layout,0,{ bindings: [{ identity: 'projection',handle: 1,self: 1,player: 0,observed: new Set([1]),enabled: true,due: true,
      divisor: 6,fuel: 400000,previousTick: 0,currentTick: 0,state: [],parameters: [{ name: 'signal',value: signalId }],fields,sample: { atTick: 0,target: 0 } }],
    players: [],edges: [],events: [],actions: new Set(),eventKinds: new Set() });
    const counts = new Map(input.counts);counts.set(21,rng.count);
    let authority: V2FrameAuthority | undefined;
    this.busy = true;
    try {
      const answer = this.module.project(400000,view => {
        authority = writeV2Frame(view,layout,{ lane: 2,module: 1,sequence: 0,tick: 0,due: 1 },counts);input.write(view);
        const bank = layout.regions[20];if (bank === undefined) throw new Error('Missing projection RNG bank');
        new Uint8Array(view.buffer,layout.io+bank.offset,rng.bytes.length).set(rng.bytes);
      },view => {
        if (authority === undefined) throw new Error('Missing projection authority');
        const actual = validateV2Frame(view,layout,authority),bank = layout.regions[9],values: Record<string,number> = {};
        if (bank === undefined) throw new Error('Missing projection output bank');
        for (let index = 0; index < (actual[9] ?? 0); index++) {
          const at = layout.io+bank.offset+index*64,name = this.row.channels[view.getUint32(at+8,true)-1],value = view.getFloat64(at+16,true);
          if (view.getUint32(at,true) !== 1 || view.getUint32(at+4,true) !== 25 || view.getUint32(at+12,true) !== 0 || name === undefined || Object.hasOwn(values,name)
            || !Number.isFinite(value) || [24,32,40,48,56].some(offset => view.getFloat64(at+offset,true) !== 0)) throw new Error('Invalid return output');
          values[name] = value;
        }
        const next = rng.readCandidate(view,actual[21] ?? 0,new Set([1]))[0];
        return { values,next };
      }).value;
      let accepted = false;
      return { values: Object.freeze(answer.values),accept: () => {
        if (accepted) throw new Error('Return projection already accepted');
        if (before !== undefined && random !== undefined) {
          if (!sameRng(before,random.snapshot()) || answer.next === undefined) throw new Error('Changed projection RNG owner');
          random.restore({ ...before,state: answer.next.state[0] });
        }
        accepted = true;
      } };
    } finally { this.busy = false; }
  }
  project(signal: string,observations: Readonly<Record<string,number>>,random?: Rng,candidates: readonly Readonly<Record<string,number>>[] = []): Readonly<Record<string,number>> {
    const result = this.prepare(signal,observations,random,candidates);result.accept();return result.values;
  }
}
