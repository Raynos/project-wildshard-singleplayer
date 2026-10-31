import {expect,test} from 'vitest';
import {Color,type BufferGeometry,type BufferAttribute,type InterleavedBufferAttribute} from 'three';
import {CASTS} from './fixtures/nine-cast-blobs';
import {createModelLibrary} from '../src/game/plugin/geometry';
import {readSourceModel} from '../src/sdk/bake/skinned';
import {castChannels} from '../src/shards/nine-dragon-stack/generators/castSources';
import {crowdPaletteColor,CROWD_LIGHT_DYE} from '../src/shards/nine-dragon-stack/generators/crowdPalette';
import {emitGraphGlsl} from '../src/engine/render/graph/glsl';
import {architectureGraphs,crowdGraph} from '../src/shards/nine-dragon-stack/generators/architectureGraphs';
import {WALKER_DYES} from '../src/shards/nine-dragon-stack/generators/casts';

async function geometry(name:string):Promise<BufferGeometry>{
  const row=CASTS.blobs.find(blob=>blob.file.name===`geometry/casts/${name}.glb`);if(row===undefined)throw new Error('Missing admitted cast');
  const library=createModelLibrary<never,never>({meshes:[],meshUrls:{},hd:[],hdUrls:{},hdLooks:{},aoFloor:1,
    geometryPools:[{url:name,parts:[name],channels:castChannels(name)}]},'crowd palette proof',{},async()=>(await readSourceModel(row.bytes)).gltf);
  await library.preload();const result=library.geometry(name,{borrow:true});if(result===null)throw new Error('Missing crowd geometry');return result;
}
function bits(attribute:BufferAttribute|InterleavedBufferAttribute):Uint32Array{
  const values=new Float32Array(attribute.count*attribute.itemSize);
  for(let i=0;i<attribute.count;i++)for(let c=0;c<attribute.itemSize;c++)values[i*attribute.itemSize+c]=attribute.getComponent(i,c);
  return new Uint32Array(values.buffer);
}
function equal(a:BufferAttribute|InterleavedBufferAttribute,b:BufferAttribute|InterleavedBufferAttribute,label:string):void{
  expect([b.itemSize,b.count],label).toEqual([a.itemSize,a.count]);const x=bits(a),y=bits(b);
  expect(y.length===x.length&&x.every((word,index)=>word===y[index]),label).toBe(true);
}

test('every table LOD retains original primary geometry and both phone colourways bit for bit',async()=>{
  for(const kind of ['walker','sitter'])for(const suffix of ['','-mid12','-mid22','-far']){
    const [dark,light,table]=await Promise.all([geometry(`${kind}-dark${suffix}`),geometry(`${kind}-light${suffix}`),geometry(`${kind}-table${suffix}`)]);
    for(const [name,attribute] of Object.entries(dark.attributes)){
      const actual=table.getAttribute(name);equal(attribute,actual,`${kind}${suffix}/${name}`);
      expect(actual.array.constructor).toBe(attribute.array.constructor);expect(actual.normalized).toBe(attribute.normalized);
    }
    // The table shader substitutes only these authored exact-zero channels.
    // Check every actual phone LOD, including clustered far geometry.
    for(const name of ['aOff','aSpill']){
      const channel=table.getAttribute(name);
      expect(Array.from(bits(channel)).every(word=>word===0),`${kind}${suffix}/${name} exact zero`).toBe(true);
    }
    expect(table.index?.array).toEqual(dark.index?.array);
    equal(light.getAttribute('color'),table.getAttribute('aLightColor'),`${kind}${suffix}/light color`);
    if(kind==='walker')equal(light.getAttribute('aDye'),table.getAttribute('aLightDye'),`${kind}${suffix}/light dye`);
    expect(table.boundingBox).toEqual(dark.boundingBox);expect(table.boundingSphere).toEqual(dark.boundingSphere);
    dark.dispose();light.dispose();table.dispose();
  }
});

test('only the explicit own-light key changes; every real dye keeps its original RGB',()=>{
  for(const group of ['walkers','sitters'] as const){expect(crowdPaletteColor(group,'dark')).toEqual([1,1,1]);expect(crowdPaletteColor(group,'light')).toEqual([0,0,0]);}
  for(const name of ['paper','blue','oxblood'] as const){const c=new Color(WALKER_DYES[name].color);expect(crowdPaletteColor('walkers',name)).toEqual([c.r,c.g,c.b]);}
  expect(CROWD_LIGHT_DYE).toEqual(crowdPaletteColor('walkers','paper').map(Math.fround));
  expect(()=>crowdPaletteColor('sitters','paper')).toThrow();expect(()=>crowdPaletteColor('walkers','unknown')).toThrow();
});


test('ordinary kit shaders never reserve palette inputs and the crowd fits native vertex slots',()=>{
  for(const graph of Object.values(architectureGraphs())){
    const attributes=emitGraphGlsl(graph,{trustedBudget:true}).attributes.map(row=>row.name);
    expect(attributes).not.toContain('aLightColor');expect(attributes).not.toContain('aLightDye');
  }
  const graph=crowdGraph(),attributes=emitGraphGlsl(graph,{trustedBudget:true}).attributes.map(row=>row.name);
  expect(attributes).toContain('aLightColor');expect(attributes).toContain('aLightDye');
  expect(attributes).not.toContain('aOff');expect(attributes).not.toContain('aSpill');
  // position, normal, vertex colour + mat4 instance transform + instance colour.
  expect(attributes.length+3+4+1).toBeLessThanOrEqual(16);
});
