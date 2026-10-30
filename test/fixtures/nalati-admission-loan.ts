import { afterEach } from 'vitest';
import * as v from 'valibot';
import { Scope } from '../../src/engine/app/scope';
import { parseDecisionScripts } from '../../src/format/decisionScripts';
import { ReturnProgramSchema } from '../../src/format/namedJsonContracts';
import { ReturnModulesSchema } from '../../src/format/scriptContract';
import { ReturnProgram } from '../../src/game/population/returnProgram';
import { NALATI_ADMISSION, NALATI_ADMISSION_PROGRAM } from './nalati-admission';

const input = v.parse(v.object({ ...ReturnProgramSchema.entries }), NALATI_ADMISSION);
const script = parseDecisionScripts([input.script])[0];
if (script === undefined || input.v2 === undefined) throw new Error('Missing actual admission script');
export const admission = { ...input, script, v2: input.v2 };
const artifact = admission.v2.artifact;
const modules = new Map([
  [script.module.slice('blobs/wasm/'.length, -'.wasm'.length), Uint8Array.from(NALATI_ADMISSION_PROGRAM.witness)],
  [artifact.hash, Uint8Array.from(NALATI_ADMISSION_PROGRAM.wasm)],
]);
const rows = v.parse(ReturnModulesSchema, [{ id: 'nalati.admission.projection', module: `blobs/wasm/${artifact.hash}.wasm`,
  side: 'sim', abi: 2, lane: 'project', pages: artifact.pages, ioBytes: artifact.ioBytes,
  compilerRevision: artifact.compilerRevision, admissionRevision: artifact.admissionRevision }]);
const owners: Scope[] = [];
afterEach(() => { for (const owner of owners.splice(0)) owner.dispose(); });

/** Same admitted program, scoped raw loan and per-case retirement as the full
 * bank, without constructing unrelated held, riding, Kokpar or Titan programs. */
export function admissionPage(owner?: Scope): ReturnProgram {
  if (owner === undefined) { owner = new Scope('admission.fixture'); owners.push(owner); }
  lendNalatiAdmission(owner);
  return ReturnProgram.page(admission, owner);
}

/** Existing explicit-scope callers retain the same raw module ownership. */
export function lendNalatiAdmission(owner: Scope): void { ReturnProgram.lendModules(owner, modules, rows); }
