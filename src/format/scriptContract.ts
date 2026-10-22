import { SpawnScriptsSchema } from './spawnScripts';
import * as v from 'valibot';
import { admitScript, type ScriptAdmission } from './scriptAdmission';
import { admitScriptV2, SCRIPT_V2_REVISIONS, type ScriptAdmissionV2 } from './scriptAdmissionV2';
import { parseDecisionScripts, type DecisionScripts } from './decisionScripts';

/** Explicit byte-admission contract. It is build metadata, never an extra output-index field. */
export const ScriptContractSchema = v.variant('abi', [
  v.strictObject({ abi: v.literal(0) }),
  v.strictObject({ abi: v.literal(1), pages: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(4)) }),
  /** SCRIPT-ABI v2 (H13): one work lane, fixed pages, the host's I/O bytes, the pinned compiler and admission revisions */
  v.strictObject({ abi: v.literal(2), lane: v.picklist(['sim', 'project', 'view']), pages: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(4)),
    ioBytes: v.pipe(v.number(), v.integer(), v.minValue(656), v.maxValue(4 * 65536)),
    compilerRevision: v.literal(SCRIPT_V2_REVISIONS.compiler), admissionRevision: v.literal(SCRIPT_V2_REVISIONS.admission) }),
]);
export type ScriptContract = v.InferOutput<typeof ScriptContractSchema>;
/** Admit the declared ABI, including instrumentation; v1 and v2 fixed memory must match its row exactly. A v2 module is
 *  admitted (admitScriptV2, its declared lane, I/O and revisions) on a copy of its bytes, before anything instantiates it. */
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
export function decisionModuleContracts(input: readonly DecisionScripts[number][], files: readonly { hash: string; kind: string; path?: string }[]): ReadonlyMap<string, { abi: 1; pages: number }> {
  const rows = parseDecisionScripts(input), contracts = new Map<string, { abi: 1; pages: number }>(), sides = new Map<string, string>();
  for (const row of rows) {
    const file = files.find(value => value.kind === 'wasm' && `blobs/wasm/${value.hash}.wasm` === row.module && (value.path === undefined || value.path === row.module));
    if (file === undefined) throw new Error('Decision script module is not an exact declared Wasm path');
    const old = contracts.get(file.hash);
    if (old !== undefined && (old.pages !== row.pages || sides.get(file.hash) !== row.side)) throw new Error('Conflicting decision module contracts');
    contracts.set(file.hash, { abi: 1, pages: row.pages }); sides.set(file.hash, row.side);
  }
  return contracts;
}

/** Every explicitly owned v1 module participates in byte, memory and inventory admission. */
export function scriptAdmissionRows(sections?: ReadonlyMap<string, unknown>): DecisionScripts {
  const spawn = v.parse(SpawnScriptsSchema, sections?.get('actors/spawn-scripts') ?? []);
  return parseDecisionScripts([...decisionScriptsFromSections(sections), ...spawn.map(row => row.script),
    ...parseDecisionScripts(sections?.get('actors/return-scripts') ?? [])]);
}
