import weather from '../data/weather.json' with {type:'json'};
import { parseWeatherProgram } from '@wildshard/format/weatherProgram';
import { nameBlob, emitNamedBlobs } from '@wildshard/sdk/blobs';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';

/** Author weather once; page and native owners consume the same admitted numeric program. */
const emitted=emitNamedBlobs([nameBlob('world/weather.json','json',new TextEncoder().encode(encodeCanonicalJson(parseWeatherProgram(weather))))]);
export const output={namedFiles:emitted.files,assets:emitted.assets};
