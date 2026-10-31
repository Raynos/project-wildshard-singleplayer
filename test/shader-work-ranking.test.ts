import {expect,test} from 'vitest';
import {rankShaderWork,type ShaderPixelFact} from './fixtures/shader-work-ranking';

const shader='a'.repeat(64),other='b'.repeat(64);
function fact(id:string,capture:string,pixels:number,fragmentShaderHash=shader):ShaderPixelFact{
 return {id,capture,name:id,fragmentShaderHash,pixels,kind:'fullscreen',saturatedPixels:0};
}
test('sum real draws within a capture and rank worst poses without adding unrelated frames',()=>{
 const result=rankShaderWork([{id:'one',fragmentShaderHash:shader,unconditional:10},{id:'alias',fragmentShaderHash:shader,unconditional:10},
  {id:'two',fragmentShaderHash:other,unconditional:20}],
 [fact('draw1','P1',20),fact('draw2','P1',30),fact('draw1','P2',40),fact('draw3','P1',30,other)]);
 expect(result.allFactsMatched).toBe(true);
 expect(result.rows.map(row=>[row.unconditionalWork,row.capture,row.pixels])).toEqual([[600,'P1',30],[500,'P1',50]]);
 expect(result.rows[1]?.programs).toEqual(['alias','one']);
});
test('a familiar label cannot join a changed shader or invent missing coverage',()=>{
 const result=rankShaderWork([{id:'silhouette',fragmentShaderHash:shader,unconditional:100}],
 [{...fact('draw','P1',100,other),name:'silhouette'}]);
 expect(result).toMatchObject({rows:[],allFactsMatched:false});expect(result.unmatched).toHaveLength(1);
});
test('colour samples and saturated readbacks stay explicitly censored proxies',()=>{
 const result=rankShaderWork([{id:'one',fragmentShaderHash:shader,unconditional:10}],
 [{...fact('draw','P1',90),kind:'colour-sample-proxy',saturatedPixels:2}]);
 expect(result.rows[0]).toMatchObject({unconditionalWork:900,proxy:true,saturatedPixels:2});
 expect(result).toMatchObject({usesProxy:true,hasSaturation:true});
 const smaller=rankShaderWork([{id:'one',fragmentShaderHash:shader,unconditional:10}],
  [fact('large','P2',100),{...fact('small','P1',10),kind:'colour-sample-proxy',saturatedPixels:1}]);
 expect(smaller.rows[0]).toMatchObject({capture:'P2',proxy:false});
 expect(smaller).toMatchObject({usesProxy:true,hasSaturation:true});
});
test('duplicate observations, invalid pixels and conflicting cost identities refuse',()=>{
 const costs=[{id:'one',fragmentShaderHash:shader,unconditional:10}];
 expect(()=>rankShaderWork(costs,[fact('same','P1',10),fact('same','P1',10)])).toThrow('Duplicate');
 for(const pixels of [-1,Infinity,Number.NaN])expect(()=>rankShaderWork(costs,[fact('draw','P1',pixels)])).toThrow('coverage');
 expect(()=>rankShaderWork([...costs,{id:'two',fragmentShaderHash:shader,unconditional:11}],[])).toThrow('Ambiguous');
 expect(()=>rankShaderWork(costs,[{...fact('draw','P1',10),saturatedPixels:1}])).toThrow('coverage');
 const bound=fact('bound','P1',100);Reflect.set(bound,'kind','viewport-upper-bound');
 expect(()=>rankShaderWork(costs,[bound])).toThrow('coverage');
});
