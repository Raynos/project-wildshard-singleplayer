import { bakeScriptModule } from '@wildshard/sdk/compileScript';
import { FAN_GUST_MODULE } from '../data/fanGustModule.ts';

await bakeScriptModule(new URL('../behaviour/fanGust.as', import.meta.url), new URL('../assets/', import.meta.url), FAN_GUST_MODULE, { maximumPages: 1 });
