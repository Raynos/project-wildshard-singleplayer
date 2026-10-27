// oxlint-disable-next-line import/no-nodejs-modules -- Frozen fixtures resolve from the native test repository, not Vite's HTTP module URL.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Frozen original bytes remain an independent native test oracle.
import { readFileSync } from 'node:fs';
import rows from './nalati-weather-original.json' with { type: 'json' };
import weather from './nalati-weatherChannels-original.json' with { type: 'json' };
import herd from './nalati-herdChannels-original.json' with { type: 'json' };
import { parseClientChannels } from '../../src/sdk/rows';
import { parseDecisionScripts } from '../../src/sdk/decisionScripts';
import { hashImmutableBytes } from '../../src/sdk/immutable';
import type { NalatiWeather } from '../../src/shards/nalati-grasslands/generators/weatherProgram';
import { originalScriptOrder } from './original-script-order';

const binary = Uint8Array.from(readFileSync(resolve('test/fixtures', 'nalati-weather-original.wasm')));
const script = parseDecisionScripts([rows.script])[0];
if (script === undefined || script.module !== `blobs/wasm/${hashImmutableBytes(binary)}.wasm`
  || rows.compiled.bytes !== binary.byteLength) throw new Error('Original weather executable differs');
/** Complete independent predecessor inputs; production always constructs its own weather. */
export const NALATI_WEATHER: NalatiWeather = {
  binary, rows: { ...rows, bytes: '', script: originalScriptOrder(rows.script, script) },
  channels: {
    weather: { ...weather, clientChannels: parseClientChannels(weather.clientChannels) },
    herd: { ...herd, clientChannels: parseClientChannels(herd.clientChannels) },
  },
};
