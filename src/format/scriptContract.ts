import { isJsonData } from './json';
import { SpawnScriptsSchema } from './spawnScripts';
import * as v from 'valibot';
import { admitScript, type ScriptAdmission } from './scriptAdmission';
import { admitScriptV2, SCRIPT_V2_REVISIONS, type ScriptAdmissionV2 } from './scriptAdmissionV2';
import { DecisionScriptsSchema, parseDecisionScripts, type DecisionScripts } from './decisionScripts';

/** Fixed ABI2 byte admission metadata, independent of execution or source sniffing. */
export const ScriptV2ContractSchema = v.strictObject({ abi: v.literal(2), lane: v.picklist(['sim', 'project', 'view']), pages: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(4)),
    ioBytes: v.pipe(v.number(), v.integer(), v.minValue(656), v.maxValue(4 * 65536)),
    compilerRevision: v.literal(SCRIPT_V2_REVISIONS.compiler), admissionRevision: v.literal(SCRIPT_V2_REVISIONS.admission) });
/** Explicit byte-admission contract. It is build metadata, never an extra output-index field. */
export const ScriptContractSchema = v.variant('abi', [
  v.strictObject({ abi: v.literal(0) }),
  v.strictObject({ abi: v.literal(1), pages: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(4)) }),
  ScriptV2ContractSchema,
]);
export type ScriptContract = v.InferOutput<typeof ScriptContractSchema>;
/** An explicit view module survives named-file reconstruction, disk and worker transport. */
export const ViewModuleSchema = v.strictObject({ id: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  module: v.pipe(v.string(), v.regex(/^blobs\/wasm\/[a-f0-9]{64}\.wasm$/u)), side: v.literal('view'),
  ...ScriptV2ContractSchema.entries, lane: v.literal('view') });
export const ViewModulesSchema = v.pipe(v.array(ViewModuleSchema), v.maxLength(64),
  v.check(rows => new Set(rows.map(row => row.id)).size === rows.length && new Set(rows.map(row => row.module)).size === rows.length, 'Unique view module ids and paths'));
export type ViewModuleRow = v.InferOutput<typeof ViewModuleSchema>;
const OwnedSimModuleSchema = v.strictObject({ ...ViewModuleSchema.entries,side: v.literal('sim'),lane: v.literal('sim') });
/** Stateless project modules use the same persistent inventory as legacy return
 * policies, never view or scheduled spawn declarations. */
const ProjectModuleSchema = v.strictObject({ ...ViewModuleSchema.entries,side: v.literal('sim'),lane: v.literal('project') });
const ProjectReturnModulesSchema = v.pipe(v.unknown(),v.check(isJsonData,'plain JSON return modules'),
  v.array(v.union([DecisionScriptsSchema.pipe[2].item,ProjectModuleSchema])),v.maxLength(64),
  v.check(rows=>new Set(rows.map(row=>row.id)).size===rows.length,'unique return module ids'),
  v.check(rows=>new Set(rows.map(row=>row.module)).size<=8,'at most eight return modules'),
  v.check(rows=>rows.reduce((count,row)=>count+(row.abi!==2&&'spawnGroup' in row.binding?Object.keys(row.actors).length:1),0)<=64,'at most 64 logical return bindings'),
  v.check(rows=>rows.some(row=>row.abi===2),'explicit project module required'));
export const ReturnModulesSchema = v.union([DecisionScriptsSchema,ProjectReturnModulesSchema]);
export type ReturnModuleRow = v.InferOutput<typeof ReturnModulesSchema>[number];
const OwnedV2ModulesSchema = v.array(v.union([ViewModuleSchema,OwnedSimModuleSchema,ProjectModuleSchema]));
export type ScriptAdmissionRows = readonly (DecisionScripts[number] | ViewModuleRow | v.InferOutput<typeof OwnedSimModuleSchema> | ReturnModuleRow)[];
/** Admit the declared ABI, including instrumentation; v1 and v2 fixed memory must match its row exactly. A v2 module is
 *  admitted (admitScriptV2, its declared lane, I/O and revisions) on a copy of its bytes, before anything instantiates it. */
export function admitScriptContract(bytes: Uint8Array, input: Extract<ScriptContract, { abi: 0 | 1 }>): ScriptAdmission;
export function admitScriptContract(bytes: Uint8Array, input: Extract<ScriptContract, { abi: 2 }>): ScriptAdmissionV2;
export function admitScriptContract(bytes: Uint8Array, input: ScriptContract): ScriptAdmission | ScriptAdmissionV2;
export function admitScriptContract(bytes: Uint8Array, input: ScriptContract): ScriptAdmission | ScriptAdmissionV2 {
  const contract = v.parse(ScriptContractSchema, input);
  if (contract.abi === 2) {
    if (contract.ioBytes > contract.pages * 65536) throw new Error('V2 script I/O exceeds its pages');
    const { lane, ioBytes, compilerRevision, admissionRevision } = contract;
    const admitted = admitScriptV2(Uint8Array.from(bytes), { lane, ioBytes, compilerRevision, admissionRevision });
    if (admitted.initialPages !== contract.pages || admitted.maximumPages !== contract.pages) throw new Error('V2 script fixed pages differ from declaration');
    return admitted;
  }
  const admitted = admitScript(bytes, contract.abi);
  if (contract.abi === 1 && (admitted.initialPages !== contract.pages || admitted.maximumPages !== contract.pages)) throw new Error('Decision script fixed pages differ from declaration');
  return admitted;
}
/** Read only the declared platform payload; absent rows retain the separate legacy v0 format. */
export function decisionScriptsFromSections(sections?: ReadonlyMap<string, unknown>): DecisionScripts {
  return sections?.has('sim/scripts') === true ? parseDecisionScripts(sections.get('sim/scripts')) : [];
}
/** Resolve complete module paths against the inventory, never by sniffing bytes or matching a loose filename. */
export function decisionModuleContracts(input: ScriptAdmissionRows, files: readonly { hash: string; kind: string; path?: string }[]): ReadonlyMap<string, Extract<ScriptContract, { abi: 1 | 2 }>> {
  const decisions = parseDecisionScripts(input.filter(row => row.abi !== 2));
  const views = v.parse(OwnedV2ModulesSchema, input.filter(row => row.abi === 2));
  const rows = [...decisions, ...views], contracts = new Map<string, Extract<ScriptContract, { abi: 1 | 2 }>>(), sides = new Map<string, string>();
  if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Duplicate script admission id');
  for (const row of rows) {
    const file = files.find(value => value.kind === 'wasm' && `blobs/wasm/${value.hash}.wasm` === row.module && (value.path === undefined || value.path === row.module));
    if (file === undefined) throw new Error('Decision script module is not an exact declared Wasm path');
    const contract = row.abi === 2 ? v.parse(ScriptV2ContractSchema, { abi: row.abi, lane: row.lane, pages: row.pages, ioBytes: row.ioBytes,
      compilerRevision: row.compilerRevision, admissionRevision: row.admissionRevision }) : { abi: 1 as const, pages: row.pages };
    const old = contracts.get(file.hash);
    if (old !== undefined && (JSON.stringify(old) !== JSON.stringify(contract) || sides.get(file.hash) !== row.side)) throw new Error('Conflicting decision module contracts');
    contracts.set(file.hash, contract); sides.set(file.hash, row.side);
  }
  return contracts;
}

/** Every explicitly owned v1 module participates in byte, memory and inventory admission. */
export function scriptAdmissionRows(sections?: ReadonlyMap<string, unknown>): ScriptAdmissionRows {
  const spawn = v.parse(SpawnScriptsSchema, sections?.get('actors/spawn-scripts') ?? []);
  const returns = v.parse(ReturnModulesSchema,sections?.get('actors/return-scripts') ?? []);
  const decisions = parseDecisionScripts([...decisionScriptsFromSections(sections), ...spawn.map(row => row.script),
    ...returns.filter(row=>row.abi!==2)]);
  const owned = spawn.flatMap(row => row.v2 === undefined ? [] : [{ abi: 2 as const,id: `${row.step}:v2`,side: 'sim' as const,lane: 'sim' as const,module: `blobs/wasm/${row.v2.artifact.hash}.wasm`,pages: row.v2.artifact.pages,ioBytes: row.v2.artifact.ioBytes,compilerRevision: row.v2.artifact.compilerRevision,admissionRevision: row.v2.artifact.admissionRevision }]);
  return [...decisions, ...v.parse(ViewModulesSchema, sections?.get('view/modules') ?? []),...owned,...returns.filter(row=>row.abi===2)];
}
