import {expect,test} from 'vitest';
import {headlessAssembly} from '../src/shards/nalati-grasslands/generators/nativeGroups';
import {nativeWeatherBundle} from '../src/game/plugin/weather';
import weather from '../src/shards/nalati-grasslands/data/weather.json' with {type:'json'};
import reactions from '../src/shards/nalati-grasslands/behaviour/weather.generated.json' with {type:'json'};
import physics from '../src/shards/nalati-grasslands/data/physics.generated.json' with {type:'json'};

test('native weather admits current camp shelters without a physics-bake field',()=>{
 const circles=headlessAssembly.constants.nativeShelters;
 expect(circles.length).toBeGreaterThan(0);expect(circles).toEqual(physics.yurts);
 const bundle=nativeWeatherBundle({weather,reactions},circles);
 expect(bundle.reactions.shelter.circles).toEqual(circles);
 expect(()=>nativeWeatherBundle({weather,reactions},[[0,0,()=>3]])).toThrow();
});
