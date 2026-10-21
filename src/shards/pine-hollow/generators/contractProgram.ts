import { parseDecisionScripts,type DecisionScriptRow } from '@wildshard/format/decisionScripts';
import type { DecisionRegistries } from '@wildshard/format/decisionBindings';

const roles=['serial','salt','attempts','first','fallback','kind','target','variant','label','elite','rank','targetRank','knownRank','below','excludeElite','excluded','tagged','match','have','need','x','y','z','px','py','pz','radius','next','claimed','streak','best','slot','slots','open','value','valid','pointValid','count','candidate','accepted'];
const fields=[...roles,...['a','b','c'].flatMap(prefix=>Array.from({length:4},(_,i)=>`${prefix}${String(i).padStart(2,'0')}`))];
const signals=['random','tag','elite','count','progress','loaded','near','draw','collision','drawFinish','claim','tear','use','restore','loadNext'];
const channels=['value','index','band','target','retry','salt','have','moved','next','claimed','streak','best','status','slot','open','operation','milestone'];
const aliases=(names:readonly string[])=>Object.fromEntries(names.map(name=>[name,`contract.${name}`]));
const script=parseDecisionScripts([{id:'pine.contracts',abi:'1.0',side:'sim',source:'behaviour/contracts.as',module:`blobs/wasm/${'0'.repeat(64)}.wasm`,binding:{shard:true},pages:1,onFail:'hold',on:['signal'],tick:null,reads:['field'],commands:['channel'],fields:aliases(fields),signals:aliases(signals),channels:aliases(channels),params:{},stateVersion:1,state:[]}])[0];
if(script===undefined)throw new Error('Missing contract guest declaration');
/** Stateless decisions only; the original board and its native save remain authoritative. */
export const CONTRACT_PROGRAM_SCRIPT=script;
/** ReturnProgram reads the same sorted identities as the generated ABI header. */
export function contractProgramRegistries(row:DecisionScriptRow=CONTRACT_PROGRAM_SCRIPT):DecisionRegistries{
 const ids=(values:Readonly<Record<string,string>>)=>new Map(Object.values(values).sort().map((id,i)=>[id,i+1]));
 return {fields:ids(row.fields),signals:ids(row.signals),channels:ids(row.channels)};
}
