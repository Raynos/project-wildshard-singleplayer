import { nalatiNativeProgram } from './nalati-native-program';
import * as v from 'valibot';
import type { NalatiRidingPrograms } from '../../src/shards/nalati-grasslands/generators/ridingRows.mjs';
import { nalatiRidingWire } from '../../src/shards/nalati-grasslands/generators/ridingProgram';

/** GR6: Nalati's riding rows, module and witness bytes as the product builds them (ridingRows.mjs), compiled once in a
 *  plain Node child (`nalati-riding-compile.mjs`); the retired job's generated files no longer exist. */
const compiled = v.parse(v.object({ programs: v.unknown(), wasm: v.string(), witness: v.string() }),
  JSON.parse(await nalatiNativeProgram('riding')));
// the builder's own key order survives (an object schema would move its declared keys first)
export const NALATI_RIDING_PROGRAMS: NalatiRidingPrograms = nalatiRidingWire(JSON.stringify(compiled.programs));
export const NALATI_RIDING_WASM: Uint8Array = new Uint8Array(Buffer.from(compiled.wasm, 'base64'));
export const NALATI_RIDING_WITNESS_BYTES: Uint8Array = new Uint8Array(Buffer.from(compiled.witness, 'base64'));
