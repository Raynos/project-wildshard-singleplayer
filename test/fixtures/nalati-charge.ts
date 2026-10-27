// oxlint-disable-next-line import/no-nodejs-modules -- The compiler runs in plain Node, outside the test's happy-dom.
import {execFileSync} from 'node:child_process';
import * as v from 'valibot';
import {parseSpawnScript,SpawnScriptRowSchema} from '../../src/format/spawnScripts';
import {nalatiChargeWire,type NalatiChargeProgram} from '../../src/shards/nalati-grasslands/generators/chargeProgram';

/** GR6: the Qara Batyr charge rows and module as the product builds them (chargeRows.ts), compiled once in a plain Node
 *  child (`nalati-charge-compile.mjs`); the retired job's generated files no longer exist. */
const built=v.parse(v.object({rows:v.unknown(),wasm:v.string()}),
  JSON.parse(execFileSync(process.execPath,['--import','./scripts/bake-loader.mjs','test/fixtures/nalati-charge-compile.mjs'],{encoding:'utf8',maxBuffer:1<<26})));
/** The build's whole charge program value (rows plus module bytes). */
export const NALATI_CHARGE:NalatiChargeProgram={rows:nalatiChargeWire(JSON.stringify(built.rows)),wasm:new Uint8Array(Buffer.from(built.wasm,'base64'))};
const {compiled,...row}=v.parse(v.object({...SpawnScriptRowSchema.entries,compiled:v.object({source:v.string(),bytes:v.number()})}),structuredClone(NALATI_CHARGE.rows));
export const charge=parseSpawnScript(row);
export const chargeModule=Uint8Array.from(NALATI_CHARGE.wasm);
export const chargeModuleSize=compiled.bytes;
