import { expect, test, vi } from 'vitest';
import { zlibSync } from 'fflate';
import { BoxGeometry, BufferGeometry, Group } from 'three';
import { Scope } from '../src/engine/app/scope';
import { SceneDressing } from '../src/game/shardfile/sceneDressing';
import type { ShardContext } from '../src/game/plugin/context';
import { SceneDressingSchema } from '../src/format/sceneDressing';
import { writeGeometry, join } from '../src/shards/nalati-grasslands/generators/geometryWriter';
import { legacyDouble } from '@wildshard/engine/test/FakeGame';
import * as v from 'valibot';

test.each(['valid','missing','truncated','corrupt','address'] as const)('logical lane bakes preserve geometry and refuse invalid input before publication (%s)',async failure=>{
  const source=new BoxGeometry(1,2,3);source.clearGroups();
  const expected=source.clone(),blocks:Uint8Array[]=[];
  const row=writeGeometry(source,blocks,'lane-file'),part=join(blocks);
  const raw=new Uint8Array(32+part.length*2);raw.set(part,32);raw.set(part,32+part.length);
  const input=failure==='truncated'?raw.subarray(0,-4):raw,words=input.length/4,lanes=new Uint8Array(input.length);
  for(let i=0;i<words;i++)for(let byte=0;byte<4;byte++)lanes[byte*words+i]=input[i*4+byte]??0;
  const compressed=failure==='corrupt'?new Uint8Array([1,2,3]):zlibSync(lanes),original=compressed.slice();
  const addresses=new Uint8Array(8),view=new DataView(addresses.buffer);view.setUint32(0,32,true);view.setUint32(4,32+part.length,true);
  const scope=new Scope('lane-file'),root=new Group(),owned=vi.spyOn(scope,'own'),system=vi.fn<ShardContext['system']>();
  const product=legacyDouble<ShardContext['product']>({
    slug:'lane-fixture',
    hasFile:name=>name==='addresses.bin'||(name==='shape.bin'&&failure!=='missing'),
    file:vi.fn(function readFile(this:ShardContext['product'],name:string){
      expect(this).toBe(product);
      if(name==='shape.bin')return Promise.resolve(compressed);
      if(name==='addresses.bin')return Promise.resolve(failure==='address'?addresses.subarray(0,3):addresses);
      throw new Error(`Unexpected file ${name}`);
    }),
  });
  type Runtime=NonNullable<ShardContext['game']['runtime']>;
  type World=NonNullable<Runtime['world']>;
  const ctx=legacyDouble<ShardContext>({scope,root,product,system,
    game:legacyDouble<ShardContext['game']>({runtime:legacyDouble<Runtime>({world:legacyDouble<World>({sky:legacyDouble<World['sky']>({})})})})});
  const fetch=vi.spyOn(globalThis,'fetch').mockRejectedValue(new Error('Private URLs forbidden'));
  const clock=vi.spyOn(performance,'now').mockReturnValue(0);
  const inputRows={name:'logical-bake',catalogues:[],packs:{},geometry:{
    first:{kind:'baked-file',file:'shape.bin',address:{file:'addresses.bin',word:0},row},
    second:{kind:'baked-file',file:'shape.bin',address:{file:'addresses.bin',word:1},row},
  },materials:{},layers:[],statics:[],animations:[]};
  try{
    const install=SceneDressing.install(ctx,inputRows);
    if(failure!=='valid'){
      await expect(install).rejects.toThrow(failure==='missing'?'Missing scene geometry bake file':failure==='truncated'?'exceeds its source':failure==='address'?'Invalid scene geometry address':undefined);
      expect(root.children).toEqual([]);expect(system).not.toHaveBeenCalled();
      if(failure==='missing')expect(product.file).not.toHaveBeenCalled();
    }else{
      await install;
      const geometries=owned.mock.calls.map(([resource])=>resource).filter((resource):resource is BufferGeometry=>resource instanceof BufferGeometry);
      expect(geometries).toHaveLength(2);expect(product.file).toHaveBeenCalledTimes(2);
      for(const geometry of geometries){
        for(const name of Object.keys(expected.attributes))expect(Array.from(geometry.getAttribute(name).array)).toEqual(Array.from(expected.getAttribute(name).array));
        expect(Array.from(geometry.index?.array??[])).toEqual(Array.from(expected.index?.array??[]));
      }
      expect(geometries[0]?.getAttribute('position').array).not.toBe(geometries[1]?.getAttribute('position').array);
      expect(()=>v.parse(SceneDressingSchema,{...inputRows,geometry:{first:{...inputRows.geometry.first,url:'/private.bin'}}})).toThrow();
    }
    expect(compressed).toEqual(original);expect(fetch).not.toHaveBeenCalled();
  }finally{scope.dispose();source.dispose();expected.dispose();clock.mockRestore();fetch.mockRestore();owned.mockRestore();}
});
