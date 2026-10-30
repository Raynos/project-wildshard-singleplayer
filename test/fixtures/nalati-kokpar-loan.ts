import * as v from 'valibot';
import type { Scope } from '../../src/engine/app/scope';
import { parseDecisionScripts } from '../../src/format/decisionScripts';
import { ReturnProgramSchema } from '../../src/format/namedJsonContracts';
import { ReturnModulesSchema } from '../../src/format/scriptContract';
import { ReturnProgram } from '../../src/game/population/returnProgram';
import { NALATI_KOKPAR, NALATI_KOKPAR_WASM } from './nalati-kokpar';

const input = v.parse(v.object({ program: ReturnProgramSchema }), JSON.parse(JSON.stringify(NALATI_KOKPAR)));
const script = parseDecisionScripts([input.program.script])[0];
if (script === undefined) throw new Error('Missing actual Kokpar script');
const modules = new Map([[script.module.slice('blobs/wasm/'.length, -'.wasm'.length), Uint8Array.from(NALATI_KOKPAR_WASM)]]);
const rows = v.parse(ReturnModulesSchema, [script]);

/** Chapter fixtures borrow the same checked Kokpar executable and scoped
 * intake, without constructing unrelated held, riding and Titan programs. */
export function lendNalatiKokpar(owner: Scope): void { ReturnProgram.lendModules(owner, modules, rows); }
