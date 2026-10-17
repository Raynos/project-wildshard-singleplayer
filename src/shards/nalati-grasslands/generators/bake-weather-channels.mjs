import { nalatiDayChannels } from './dayChannels.ts';
import { NALATI_FAR_HERD_CHANNELS } from './clientMotion.ts';
import { NALATI_WEATHER_PROGRAMS } from './weatherChannels.ts';
import {parseClientChannels} from '@wildshard/format/clientChannels';
import {encodeCanonicalJson} from '@wildshard/sdk/immutable';
import {byteWriter} from '../../../../scripts/bake-output.mjs';
import {fileURLToPath} from 'node:url';

const writer=byteWriter(process.argv.includes('--check'),'weather-channels');
writer.put(fileURLToPath(new URL('../data/weatherChannels.generated.json',import.meta.url)),encodeCanonicalJson({clientChannels:parseClientChannels([...NALATI_WEATHER_PROGRAMS, ...nalatiDayChannels()])}));
writer.put(fileURLToPath(new URL('../data/herdChannels.generated.json',import.meta.url)),encodeCanonicalJson({clientChannels:parseClientChannels(NALATI_FAR_HERD_CHANNELS)}));
writer.finish();
