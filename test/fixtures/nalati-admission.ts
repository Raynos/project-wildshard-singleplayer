// oxlint-disable-next-line import/no-nodejs-modules -- Keep independent original executable bytes as the existing assertions' oracle.
import { readFileSync } from 'node:fs';
import original from './nalati-admission-original.json' with { type: 'json' };
import { nalatiAdmissionRows, type NalatiAdmissionProgram } from '../../src/shards/nalati-grasslands/generators/admissionProgram';

const wasm = Uint8Array.from(readFileSync(new URL('./nalati-admission-original.wasm', import.meta.url)));
const witness = Uint8Array.from(readFileSync(new URL('./nalati-admission-witness-original.bin', import.meta.url)));
export const NALATI_ADMISSION = nalatiAdmissionRows(original, wasm, witness);
export const NALATI_ADMISSION_PROGRAM: NalatiAdmissionProgram = { program: NALATI_ADMISSION, wasm, witness };
