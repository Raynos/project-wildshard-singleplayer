import {expect,test,vi} from 'vitest';
import * as v from 'valibot';
import {BufferGeometry,BufferAttribute,InterleavedBufferAttribute,Object3D} from 'three';
import {SkyRig} from '../src/engine/world/skyRig';
import {modelContext} from '../src/engine/models/model';
import {Rng} from '../src/engine/core/rng';
import {Scope} from '../src/engine/app/scope';
import {entryDeckSpecimen,entryDeckFiles} from '../src/shards/driftwood-isle/generators/entryDeckSpecimen';
import {entryDeckGeometries} from '../src/shards/driftwood-isle/generators/entryDeckGeometry';
import {prepareSpecimenCatalogue,defineSpecimenCatalogue} from '../src/game/models/specimenCatalogue';
import {driftwoodModelCatalogue} from './fixtures/driftwoodModelCatalogue';

test('the unplaced shrine retains its explicit demand policy',async()=>{
  const book:unknown=await driftwoodModelCatalogue();
  v.assert(v.object({siteCatalogue:v.object({models:v.array(v.object({key:v.string(),load:v.optional(v.literal('demand'))}))})}),book);
  expect(book.siteCatalogue.models.filter(model=>model.load!==undefined).map(model=>model.key)).toEqual(['shrine']);
});

test('the existing reader preserves all geometry attributes, bounds and independent ownership',async()=>{
  const scope=new Scope('deck files'),rows=[entryDeckSpecimen()],source=entryDeckFiles(),file=vi.fn((name:string)=>{
    const row=source.find(candidate=>candidate.name===name);if(row===undefined)throw new Error('Unknown specimen');return Promise.resolve(row.bytes);
  });
  const sky:unknown=Object.create(SkyRig.prototype);if(!(sky instanceof SkyRig))throw new Error('Missing fixture sky');
  vi.spyOn(sky,'setupMaterial').mockImplementation(()=>undefined);
  try{
    const bytes=await prepareSpecimenCatalogue({file},rows,scope);expect(file).toHaveBeenCalledTimes(3);
    const catalogue=defineSpecimenCatalogue<{entryDeck:{deck:string}}>(rows,undefined,{},bytes),original=entryDeckGeometries();
    for(const deck of ['deep','shallow','world'] as const){
      const model=catalogue.model('entryDeck'),built=model.build(modelContext(sky),{deck},new Rng(1)),again=model.build(modelContext(sky),{deck},new Rng(1));
      if(built instanceof Object3D||again instanceof Object3D)throw new Error('Expected original parts');
      const geometry:unknown=built[0]?.geometry,second:unknown=again[0]?.geometry;
      if(!(geometry instanceof BufferGeometry)||!(second instanceof BufferGeometry))throw new Error('Missing original geometry');
      expect(geometry.getIndex()).toBeNull();expect(geometry).not.toBe(second);
      const attrs:unknown=original[deck].attributes,actualAttrs:unknown=geometry.attributes;
      if(typeof attrs!=='object'||attrs===null||typeof actualAttrs!=='object'||actualAttrs===null)throw new Error('Missing attributes');
      expect(Object.keys(actualAttrs)).toEqual(Object.keys(attrs));
      for(const [name,attribute]of Object.entries(attrs)){
        const actual:unknown=geometry.getAttribute(name),next:unknown=second.getAttribute(name);
        if(!(attribute instanceof BufferAttribute||attribute instanceof InterleavedBufferAttribute)||!(actual instanceof BufferAttribute||actual instanceof InterleavedBufferAttribute)||!(next instanceof BufferAttribute||next instanceof InterleavedBufferAttribute))throw new Error('Missing original attribute');
        expect(actual.array).toEqual(attribute.array);expect(actual.itemSize).toBe(attribute.itemSize);expect(actual.normalized).toBe(attribute.normalized);expect(actual.array.buffer).not.toBe(next.array.buffer);
      }
      original[deck].computeBoundingBox();expect(geometry.boundingBox).toEqual(original[deck].boundingBox);
      geometry.dispose();second.dispose();original[deck].dispose();
    }
    await expect(prepareSpecimenCatalogue({file:()=>Promise.resolve(new Uint8Array(4))},rows,scope)).rejects.toThrow('byte count');
  }finally{scope.dispose();vi.restoreAllMocks();}
});
