import * as v from 'valibot';
import type { Scope } from '../../src/engine/app/scope';
import { parseDecisionScripts } from '../../src/format/decisionScripts';
import { ReturnProgramSchema } from '../../src/format/namedJsonContracts';
import { ReturnProjectionV2Schema } from '../../src/format/returnProjectionV2';
import { ReturnModulesSchema } from '../../src/format/scriptContract';
import { ReturnProgram } from '../../src/game/population/returnProgram';
import { NALATI_RIDING_PROGRAMS, NALATI_RIDING_WASM, NALATI_RIDING_WITNESS_BYTES } from './nalati-riding';

const mounts = v.parse(v.object({ approach: v.strictObject({ ...ReturnProgramSchema.entries, v2: ReturnProjectionV2Schema }) }),
  structuredClone(NALATI_RIDING_PROGRAMS));
const script = parseDecisionScripts([mounts.approach.script])[0];
if (script === undefined) throw new Error('Missing actual riding script');
const artifact = mounts.approach.v2.artifact;
export const ridingWitnessBytes = Uint8Array.from(NALATI_RIDING_WITNESS_BYTES);
const modules = new Map([
  [script.module.slice('blobs/wasm/'.length, -'.wasm'.length), ridingWitnessBytes],
  [artifact.hash, Uint8Array.from(NALATI_RIDING_WASM)],
]);
const rows = v.parse(ReturnModulesSchema, [{ id: 'nalati.mounts.projection', module: `blobs/wasm/${artifact.hash}.wasm`,
  side: 'sim', abi: 2, lane: 'project', pages: artifact.pages, ioBytes: artifact.ioBytes,
  compilerRevision: artifact.compilerRevision, admissionRevision: artifact.admissionRevision }]);

/** Same original riding/taming module, witness and scoped loan as the full
 * bank, without constructing unrelated held, admission or Titan fixtures. */
export function lendNalatiRiding(owner: Scope): void { ReturnProgram.lendModules(owner, modules, rows); }
