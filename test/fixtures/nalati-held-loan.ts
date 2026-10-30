import * as v from 'valibot';
import type { Scope } from '../../src/engine/app/scope';
import { parseDecisionScripts } from '../../src/format/decisionScripts';
import { ReturnProgramSchema } from '../../src/format/namedJsonContracts';
import { ReturnProjectionV2Schema } from '../../src/format/returnProjectionV2';
import { ReturnModulesSchema } from '../../src/format/scriptContract';
import { ReturnProgram } from '../../src/game/population/returnProgram';
import { originalHeldMetadata } from './nalati-held-original';
import { originalSpeciesFile } from './nalati-original-species';

const held = v.parse(v.object({ program: v.strictObject({ ...ReturnProgramSchema.entries, v2: ReturnProjectionV2Schema }) }), originalHeldMetadata().held).program;
const script = parseDecisionScripts([held.script])[0];
if (script === undefined) throw new Error('Missing actual held script');
const artifact = held.v2.artifact;
const modules = new Map([
  [script.module.slice('blobs/wasm/'.length, -'.wasm'.length), originalSpeciesFile('held-witness.bin')],
  [artifact.hash, originalSpeciesFile('held-weapons.wasm')],
]);
const rows = v.parse(ReturnModulesSchema, [{ id: 'nalati.held-weapons.projection', module: `blobs/wasm/${artifact.hash}.wasm`,
  side: 'sim', abi: 2, lane: 'project', pages: artifact.pages, ioBytes: artifact.ioBytes,
  compilerRevision: artifact.compilerRevision, admissionRevision: artifact.admissionRevision }]);

/** Same held/stealth raw program and scoped intake as the full bank, without
 * constructing unrelated admission, riding, Kokpar or Titan programs. */
export function lendNalatiHeld(owner: Scope): void { ReturnProgram.lendModules(owner, modules, rows); }
