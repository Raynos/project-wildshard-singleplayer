import { readFileSync } from 'node:fs';
import { compileDecisionScripts } from '../../src/sdk/buildDecisionScripts';
import { contractCatalogue } from '../../src/shards/pine-hollow/generators/contractRows';
import { CONTRACT_PROGRAM_SCRIPT, contractProgramRegistries } from '../../src/shards/pine-hollow/generators/contractProgram';
import { parseContractCatalogue } from '../../src/format/contracts';

// GR8 (B5): the product compiles the guest (output.ts contractModule) and ships its Wasm as a named return module, so
// the authored rows carry no programme; unit fixtures compile the same sources the same way.
const sources = new Map(['contracts', 'contractsRandom', 'contractsRules'].map(name =>
  [`behaviour/${name}.as`, readFileSync(new URL(`../../src/shards/pine-hollow/behaviour/${name}.as`, import.meta.url), 'utf8')]));
const built = await compileDecisionScripts([CONTRACT_PROGRAM_SCRIPT], contractProgramRegistries(), sources, { asLineCeiling: 256, singleSignal: true });
const script = built.rows[0], blob = built.blobs[0];
if (script === undefined || blob === undefined) throw new Error('Missing compiled contract programme');
/** The compiled guest's row and Wasm bytes. */
export const CONTRACT_PROGRAM = { script, bytes: blob.bytes };

/** Unit fixtures play the retained author rows through the real parser, with the guest's bytes inline (play without an
 *  owner); the product's board borrows the same bytes from its return-module loan instead. */
export const CONTRACTS = parseContractCatalogue({ ...contractCatalogue(),
  program: { script, bytes: btoa(String.fromCodePoint(...blob.bytes)) } });
