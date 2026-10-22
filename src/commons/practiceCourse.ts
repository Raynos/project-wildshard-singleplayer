// oxlint-disable-next-line import/no-nodejs-modules -- Compile the shared build-only course source.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Encode compiled immutable program bytes in the existing JSON envelope.
import { Buffer } from 'node:buffer';
import { compileDecisionScripts } from '@wildshard/sdk/buildDecisionScripts';
import type { DecisionScriptRow } from '@wildshard/format/decisionScripts';

/** One bounded course law; values configure its oval or checkpoint observations. */
export async function buildCourseProgram(kind: 'oval' | 'checkpoints', parameters: Readonly<Record<string, number>> = {}): Promise<{ script: DecisionScriptRow; bytes: string }> {
  const padFields = Array.from({ length: 11 }, (_, index) => ['Depth','Eligible','Pitch','StartPitch','StartYaw','Top','Width','X','Yaw','Z'].map(key => `pad${String(index).padStart(2,'0')}${key}`)).flat();
  const state = ['lap','started','running','half','best','last','prevX','phase','elapsed','checkpoint','visited'];
  const fields = [...state,'now','x','y','z','mounted','grounded','startPad','finishPad','padCount','fallY','lowest','courseX','courseY','courseZ','courseTime','courseMounted',...padFields];
  const channels = [...state,'courseEvent','courseFell','reached','visit','finish','fell','pad','spawnX','spawnY','spawnZ','spawnYaw','spawnPitch'];
  const signals = ['reset','step','restart','courseReset','courseStep'];
  const aliases = (names: readonly string[]): Record<string,string> => Object.fromEntries(names.map(name => [name,name]));
  const registry = (names: readonly string[]): Map<string,number> => new Map([...names].sort().map((name,index) => [name,index+1]));
  const source = 'behaviour/course.as';
  const row = { id: 'practice.course', abi:'1.0',side:'sim',module:`blobs/wasm/${'0'.repeat(64)}.wasm`,source,
    binding:{shard:true},pages:1,onFail:'hold',on:['signal'],tick:null,stateVersion:1,state:[],
    params:{ courseKind:kind==='oval'?0:1,courseRadius:0,courseWidth:0,courseLine:0,resetX:0,resetZ:0,resetYaw:0,resetPitch:0,resetPrevX:0,...parameters },
    reads:['field'],commands:['channel'],fields:aliases(fields),channels:aliases(channels),signals:aliases(signals) };
  const built = await compileDecisionScripts([row], { fields:registry(fields),channels:registry(channels),signals:registry(signals) },
    new Map([[source,readFileSync(new URL('scripts/course.as',import.meta.url),'utf8')]]), { asLineCeiling:256,singleSignal:true });
  const script=built.rows[0],blob=built.blobs[0];if(script===undefined||blob===undefined)throw new Error('Missing shared course program');
  return { script,bytes:Buffer.from(blob.bytes).toString('base64') };
}
