import { nalatiNativeProgram } from './nalati-native-program';
import * as v from 'valibot';
import type { NalatiTitanProgram, NalatiTitanPrograms } from '../../src/shards/nalati-grasslands/generators/stormTitanRows.mjs';
import { nalatiTitanWire, type NalatiTitan } from '../../src/shards/nalati-grasslands/generators/stormTitanProgram';

/** GR6: Nalati's Storm Titan and pasture rows, module and witness bytes as the product builds them (stormTitanRows.mjs),
 *  compiled once in a plain Node child (`nalati-titan-compile.mjs`); the retired job's generated files no longer exist. */
const Module = v.object({ wasm: v.string(), witness: v.string() });
const compiled = v.parse(v.object({ programs: v.unknown(), titan: Module, pasture: Module }),
  JSON.parse(await nalatiNativeProgram('titan')));
const bytes = (text: string): Uint8Array => new Uint8Array(Buffer.from(text, 'base64'));
// the builder's own key order survives (an object schema would move its declared keys first)
export const NALATI_TITAN_PROGRAMS: NalatiTitanPrograms = nalatiTitanWire(JSON.stringify(compiled.programs));
/** The build's whole titan program value (rows plus both modules). */
export const NALATI_TITAN: NalatiTitan = { programs: NALATI_TITAN_PROGRAMS,
  titan: { wasm: bytes(compiled.titan.wasm), witness: bytes(compiled.titan.witness) }, pasture: { wasm: bytes(compiled.pasture.wasm), witness: bytes(compiled.pasture.witness) } };
/** The shared pasture programme (the retired job's pasture.generated.json: the titan rows' `wind`). */
export const NALATI_PASTURE: NalatiTitanProgram = NALATI_TITAN_PROGRAMS.wind;
