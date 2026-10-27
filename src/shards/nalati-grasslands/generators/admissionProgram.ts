import type { ProjectGenerationContext } from '@wildshard/sdk/projectGeneration';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { parseDecisionScripts, parseReturnProjectionV2, type DecisionScriptRow, type ReturnProjectionV2Rows } from '@wildshard/sdk/decisionScripts';
import { NALATI_DECISION_SOURCES } from './decisionSourceInventory';

export interface NalatiAdmission {
  script: DecisionScriptRow; bytes: ''; v2: ReturnProjectionV2Rows;
  compiled: { witnessBytes: number; source: string; bytes: number; hash: string };
}
export interface NalatiAdmissionProgram { program: NalatiAdmission; wasm: Uint8Array; witness: Uint8Array }
const text = new TextEncoder(), decode = new TextDecoder('utf-8', { fatal: true });
const fields=['tx','tz','ready','threshold','turn','yaw','look','scale','x','z','radius','normal','height','water','wet','clash','coats','mares','foals','stallion','index','start',
  'elite','packs','groups','variants','bodies','bonds','px','py','pz','cx','cz','dt','bark','rest','wolf','distance','wx','wy','wz','straggler','sx','sy','sz','playerX','playerY','playerZ','elites','retired','dormant','unique','herd','expected','id','initial','nextId','variant','speed','awareness','owned','health','held','dog','state','previousState','laneT','runT','phase2','engaged','bonded','same','rule','phase','storm','kills','line','mode','crouched','elapsed','light','count','strength','dot'];
const channels=['x','z','accept','attempts','yaw','start','count','variant','radius','place','mother','scale','bark','rest','snarl','low','speed','turn','path','state','lookX','lookY','lookZ','look','emit','awareness','time','laneT','runT','capture','signature','lead','adopt','fraction'];
const signals=['steer','riderDamage','spot','accept','begin','yaw','packPlan','dogPlan','herdStart','herdMember','foal','pack','bond','dog','restoreBounds','restorePack','restoreBody','restoreBond','speed','whistle','scare','firstRaid','damage','dispatch','argymaqTick','eliteRule','eliteAux','eliteDamage','visibility','downwind','hearing'];
const aliases=(values: readonly string[]): Record<string, string> =>Object.fromEntries(values.map(name=>[name,name]));
const registry=(values: readonly string[]): ReadonlyMap<string, number> =>new Map([...values].sort((a,b)=>a<b?-1:a>b?1:0).map((name,index)=>[name,index+1]));
const source={id:'nalati.admission',abi:'1.0',side:'sim',module:`blobs/wasm/${'0'.repeat(64)}.wasm`,source:'behaviour/admission.as',
  binding:{shard:true},pages:1,onFail:'hold',on:['signal'],tick:null,stateVersion:1,state:[],params:{},
  reads:['field','random','radial'],commands:['channel'],fields:aliases(fields),channels:aliases(channels),signals:aliases(signals)};
const registries={fields:registry(fields),channels:registry(channels),signals:registry(signals)};

const record = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Validate cached metadata against both original raw executable identities and the runtime row contracts. */
export function nalatiAdmissionRows(input: unknown, wasm: Uint8Array, witness: Uint8Array): NalatiAdmission {
  if (!record(input) || input['bytes'] !== '' || !record(input['compiled'])) throw new Error('Invalid owned admission metadata');
  const compiled = input['compiled'], script = parseDecisionScripts([input['script']])[0], v2 = parseReturnProjectionV2(input['v2']);
  if (script === undefined || script.sourceHash === undefined || script.id !== 'nalati.admission' || v2.bytes !== ''
    || script.module !== `blobs/wasm/${hashImmutableBytes(witness)}.wasm`
    || typeof compiled['hash'] !== 'string' || compiled['hash'] !== hashImmutableBytes(wasm) || v2.artifact.hash !== compiled['hash']
    || typeof compiled['bytes'] !== 'number' || compiled['bytes'] !== wasm.byteLength
    || typeof compiled['witnessBytes'] !== 'number' || compiled['witnessBytes'] !== witness.byteLength
    || compiled['source'] !== 'behaviour/admission.generated.wasm')
    throw new Error('Nalati admission metadata differs from owned executables');
  // The compiler appended sourceHash after binding generation; preserve that original wire order.
  const { sourceHash, ...binding } = script;
  return { script: { ...binding, sourceHash }, bytes: '', v2, compiled: { witnessBytes: compiled['witnessBytes'], source: compiled['source'], bytes: compiled['bytes'], hash: compiled['hash'] } };
}

/** Compile the original full-handler witness and selected projection from explicit relative authored inputs. */
export async function nalatiAdmissionProgram(ctx: Pick<ProjectGenerationContext, 'cached' | 'compileDecisionRows' | 'compileReturnProjection'>): Promise<NalatiAdmissionProgram> {
  const compileRows = ctx.compileDecisionRows, compileDual = ctx.compileReturnProjection;
  if (compileRows === undefined || compileDual === undefined) throw new Error('Admission requires injected decision and projection compilers');
  const files = await ctx.cached({ id: 'admission-program', native: true, inputs: NALATI_DECISION_SOURCES }, async inputs => {
    const authored = new Map([...inputs].map(([name, bytes]): [string, string] => [name, decode.decode(bytes)]));
    const original = await compileRows([source], registries, authored, { asLineCeiling: 3184 });
    const script = original.rows[0], blob = original.blobs[0];
    if (original.rows.length !== 1 || original.blobs.length !== 1 || script === undefined || blob === undefined) throw new Error('Missing native admission witness');
    const dual = await compileDual(source, registries, authored, { asLineCeiling: 3184 });
    const compiled = { witnessBytes: blob.bytes.length, source: 'behaviour/admission.generated.wasm', bytes: dual.binary.length, hash: dual.candidate.artifact.hash };
    const program = { script, bytes: '', v2: { ...dual.candidate, bytes: '' }, compiled };
    return new Map([['admission.json', text.encode(JSON.stringify(program))], ['admission.wasm', dual.binary], ['admission-witness.bin', blob.bytes]]);
  });
  const document = files.get('admission.json'), wasm = files.get('admission.wasm'), witness = files.get('admission-witness.bin');
  if (files.size !== 3 || document === undefined || wasm === undefined || witness === undefined) throw new Error('Invalid owned admission inventory');
  return { program: nalatiAdmissionRows(JSON.parse(decode.decode(document)), wasm, witness), wasm, witness };
}
