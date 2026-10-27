// Preserve the original inline unit oracle; production borrows the admitted
// raw module through its original scope, exercised by return-program-raw-modules.
import {readFileSync} from 'node:fs';
import { NALATI_NIGHT } from './nalati-night';
import * as v from 'valibot';
import {WeatherReactionsSchema} from '../../src/format/weatherProgram';
import {DecisionScriptsSchema} from '../../src/format/decisionScripts';
import {sha256} from '../../src/game/plugin/moduleHash';

const raw=v.parse(v.object({...WeatherReactionsSchema.entries,script:DecisionScriptsSchema.pipe[2].item}),
  JSON.parse(readFileSync(new URL('./nalati-weather-original.json',import.meta.url),'utf8')));
export const weatherModuleBytes=Uint8Array.from(readFileSync(new URL('./nalati-weather-original.wasm',import.meta.url)));
if(raw.script.module!==`blobs/wasm/${sha256(weatherModuleBytes)}.wasm`)throw new Error('Weather witness hash mismatch');
export const weatherRaw=raw;
export const weatherWitness={...raw,bytes:Buffer.from(weatherModuleBytes).toString('base64')};
export function withWeatherWitness<T extends {program:{script:{module:string};bytes:string}}>(row:T){
  if(row.program.script.module!==raw.script.module)throw new Error('Night witness hash mismatch');
  return {...row,program:{...row.program,bytes:weatherWitness.bytes}};
}

export const nightParameters=v.parse(v.object({parameters:v.record(v.string(),v.number())}),
  structuredClone(NALATI_NIGHT)).parameters;
