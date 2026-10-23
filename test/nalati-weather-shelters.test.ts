// oxlint-disable-next-line import/no-nodejs-modules -- validate generated shelter observations without inferring the full physics JSON type
import {readFileSync} from 'node:fs';
import {array,finite,number,object,parse,pipe,tuple} from 'valibot';
import {expect,test} from 'vitest';
import {headlessAssembly} from '../src/shards/nalati-grasslands/generators/nativeGroups';
import {nativeWeatherBundle} from '../src/game/weather/reactions';
import weather from '../src/shards/nalati-grasslands/data/weather.json' with {type:'json'};
import {weatherWitness as reactions} from './fixtures/weatherInlineWitness';

const scalar=pipe(number(),finite());
const physics=parse(object({yurts:array(tuple([scalar,scalar,scalar]))}),
 JSON.parse(readFileSync('src/shards/nalati-grasslands/data/physics.generated.json','utf8')));

test('native weather admits current camp shelters without a physics-bake field',()=>{
 const circles=headlessAssembly.constants.nativeShelters;
 expect(circles.length).toBeGreaterThan(0);expect(circles).toEqual(physics.yurts);
 const bundle=nativeWeatherBundle({weather,reactions},circles);
 expect(bundle.reactions.shelter.circles).toEqual(circles);
 expect(()=>nativeWeatherBundle({weather,reactions},[[0,0,()=>3]])).toThrow();
});
