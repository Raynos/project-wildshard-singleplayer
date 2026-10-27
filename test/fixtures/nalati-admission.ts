// oxlint-disable-next-line import/no-nodejs-modules -- Frozen fixtures resolve from the native test repository, not Vite's HTTP module URL.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Keep independent original executable bytes as the existing assertions' oracle.
import { readFileSync } from 'node:fs';
import original from './nalati-admission-original.json' with { type: 'json' };
import { nalatiAdmissionRows, type NalatiAdmissionProgram } from '../../src/shards/nalati-grasslands/generators/admissionProgram';

const wasm = Uint8Array.from(readFileSync(resolve('test/fixtures', 'nalati-admission-original.wasm')));
const witness = Uint8Array.from(readFileSync(resolve('test/fixtures', 'nalati-admission-witness-original.bin')));
export const NALATI_ADMISSION = nalatiAdmissionRows(original, wasm, witness);
export const NALATI_ADMISSION_PROGRAM: NalatiAdmissionProgram = { program: NALATI_ADMISSION, wasm, witness };
