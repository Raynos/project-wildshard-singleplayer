// oxlint-disable-next-line import/no-nodejs-modules -- Check the registered catalogue and exact original geometry bytes.
import {readFileSync} from 'node:fs';
import {expect,test,vi} from 'vitest';
import {BufferGeometry,BufferAttribute,InterleavedBufferAttribute,Object3D} from 'three';
import {SkyRig} from '../src/engine/world/skyRig';
import {modelContext} from '../src/engine/models/model';
import {Rng} from '../src/engine/core/rng';
import {Scope} from '../src/engine/app/scope';
import {entryDeckSpecimen,entryDeckFiles} from '../src/shards/driftwood-isle/generators/entryDeckSpecimen';
import {entryDeckGeometries} from '../src/shards/driftwood-isle/generators/entryDeckGeometry';
import {prepareSpecimenCatalogue,defineSpecimenCatalogue} from '../src/game/models/specimenCatalogue';
import {encodeCanonicalJson,hashImmutableBytes} from '../src/sdk/immutable';

const pins={deep:'247da8ed53b57d128fdfc9de4dc17722e85594ccc091a308ce0060224b98d47a',shallow:'fdd6865555774ed20743338b7b16afd9798d8ecf9fa7fa0609c8bd503c513548',world:'f53767fa4ff41a219b644198f806d0615e380d1be5daa55dcc41b3a7461898e4'};
test('the complete original catalogue changes only the three deck transport references',()=>{
  const book:unknown=JSON.parse(readFileSync('src/shards/driftwood-isle/boot/modelCatalogue.generated.json','utf8'));
  expect(hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson(book)))).toBe('475877ed3676170b688c4cc64561ff012cb45ab2644a38e4b1dbd5b47f7f582c');
  const files=entryDeckFiles();expect(files).toHaveLength(3);
  for(const [deck,hash]of Object.entries(pins)){
    const file=files.find(row=>row.name===`models/entry-deck-${deck}.bin`);if(file===undefined)throw new Error('Missing original deck');
    const bytes=new Uint8Array(readFileSync(`src/shards/driftwood-isle/${file.source}`));
    expect(bytes.byteLength).toBe(19440);expect(hashImmutableBytes(bytes)).toBe(hash);expect(file.bytes).toEqual(bytes);
  }
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
