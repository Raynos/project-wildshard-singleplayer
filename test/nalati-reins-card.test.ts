import {expect,test} from 'vitest';
import {zlibSync} from 'fflate';
import {parse} from 'valibot';
import {Scope} from '@wildshard/engine/app/scope';
import {SpecimenBookSchema} from '@wildshard/format/specimenCatalogue';
import {encodeCanonicalJson,hashImmutableBytes} from '../src/sdk/immutable';
import {readBakedGeometry} from '../src/game/plugin/geometry';
import {prepareSpecimenCatalogue} from '../src/game/models/specimenCatalogue';
import {reinsCardBinary} from '../src/shards/nalati-grasslands/generators/reinsCard';
import {coverSpecimenBlobs} from '../src/shards/nalati-grasslands/generators/coverSpecimens';
import reins from '../src/shards/nalati-grasslands/data/reins.json' with {type:'json'};
import { nalatiCover } from './fixtures/nalati-cover';

type Book=ReturnType<typeof parse<typeof SpecimenBookSchema>>;
const encode=(input:unknown):Uint8Array=>new TextEncoder().encode(encodeCanonicalJson(input));
// Reconstruct only the retired transport; complete predecessor hashes below
// independently pin geometry, materials, model metadata and all other cards.
/** The book before the reins left inline storage; with a tier, also before 4a5a2ed0cd: its packed shapes were the public
 *  `/assets/nalati/baked/cover-<tier>.bin` and its models' provenance file was the retired bake-cover.mjs. */
function predecessor(book:Book,bytes:Uint8Array,tier?:'phone'|'desktop'):Book {
  const compressed=zlibSync(bytes);let text='';for(const byte of compressed)text+=String.fromCodePoint(byte);
  const baked='src/shards/nalati-grasslands/generators/coverBake.mjs',retired='src/shards/nalati-grasslands/generators/bake-cover.mjs';
  const packed=tier===undefined||book.packed===undefined?{}:{packed:{...book.packed,bin:`/assets/nalati/baked/cover-${tier}.bin`}};
  return parse(SpecimenBookSchema,{...book,...packed,rows:book.rows.map(row=>{
    if(tier!==undefined&&row.model.file===baked)return {...row,model:{...row.model,file:retired}};
    if(row.key!=='reins')return row;
    if(row.source.kind!=='file')throw new Error('Missing native reins');
    return {...row,source:{kind:'inline',data:btoa(text),geometry:row.source.geometry,material:row.source.material}};
  })});
}

test('the reins card preserves every original byte, material and standing bounds',()=>{
  const made=reinsCardBinary(),row=made.book.rows[0];if(row?.source.kind!=='file')throw new Error('Missing raw reins');
  const strap=(reins.span*3+1)*2;
  expect(row.source.geometry).toMatchObject({count:2*strap,indexCount:2*reins.span*3*6});
  expect(row.source.material).toMatchObject({family:'painterly',rim:reins.paint.rim,bands:reins.paint.bands,side:'double'});
  const compressed=zlibSync(made.bytes);
  expect([compressed.byteLength,hashImmutableBytes(compressed)]).toEqual([617,'f24be3bb0f7cd28875595567133b333fb8802638afe5a8dd1b2142b9778b2da8']);
  expect([made.bytes.byteLength,hashImmutableBytes(made.bytes)]).toEqual([3024,'bf5749fc2dd6f8160197c903a85a8ac293f5eaf709126c2eded4ad0f9ce57714']);
  const book=encode(predecessor(made.book,made.bytes));
  expect([book.byteLength,hashImmutableBytes(book)]).toEqual([1330,'3af9ee0c8c9b96fc3cdf8d09db57553d42c8dc9486c5cea61f35095749bf2927']);
  const geometry=readBakedGeometry(made.bytes,0,row.source.geometry);
  geometry.computeBoundingBox();const box=geometry.boundingBox;if(box===null)throw new Error('Missing reins bounds');
  expect(box.min.y).toBeCloseTo(0,5);expect(box.min.x+box.max.x).toBeCloseTo(0,5);expect(box.max.z-box.min.z).toBeGreaterThan(.5);
  geometry.dispose();
});

test('raw producer calls own detached bytes and declarations',()=>{
  const first=reinsCardBinary(),second=reinsCardBinary();
  expect(first.bytes).not.toBe(second.bytes);expect(first.book).not.toBe(second.book);
  first.bytes.fill(0);first.book.rows.length=0;
  expect(hashImmutableBytes(second.bytes)).toBe('bf5749fc2dd6f8160197c903a85a8ac293f5eaf709126c2eded4ad0f9ce57714');
  expect(second.book.rows).toHaveLength(1);
});

test('both complete cover books share one admitted binary and retain every predecessor field',()=>{
  const blobs=coverSpecimenBlobs(nalatiCover),binary=blobs.find(row=>row.file.name==='models/specimens/reins.bin');
  if(binary===undefined)throw new Error('Missing published reins');
  expect(blobs.map(row=>row.file.name).sort((a,b)=>(a??'').localeCompare(b??''))).toEqual(['models/cover-desktop.bin','models/cover-desktop.json','models/cover-phone.bin','models/cover-phone.json','models/gear-book.json','models/specimens/reins.bin']);
  expect([binary.bytes.byteLength,hashImmutableBytes(binary.bytes)]).toEqual([3024,'bf5749fc2dd6f8160197c903a85a8ac293f5eaf709126c2eded4ad0f9ce57714']);
  expect(binary.file).toMatchObject({kind:'bin',compressed:3024,decoded:3024,critical:false,dependencies:[]});
  const originals={phone:[13891,'32cc1b5c0a0b54fd099221a6ffd5f5adee3212df2e0c4870aa4a3e33e712791c'],desktop:[13901,'78e4154d751b172f5af65adc00c9e4b7db95460a794b899a53026e04c17ae695']};
  for(const tier of ['phone','desktop']as const){
    const file=blobs.find(row=>row.file.name===`models/cover-${tier}.json`);if(file===undefined)throw new Error('Missing cover book');
    const book=parse(SpecimenBookSchema,JSON.parse(new TextDecoder().decode(file.bytes))),reinsRow=book.rows.find(row=>row.key==='reins');
    expect(reinsRow?.source).toMatchObject({kind:'file',file:binary.file.name});
    // 4a5a2ed0cd: each tier's packed cover shapes are its own product file, which its book names and depends on
    const shapes=blobs.find(row=>row.file.name===`models/cover-${tier}.bin`);if(shapes===undefined)throw new Error('Missing cover shapes');
    expect(shapes.file).toMatchObject({kind:'bin',compressed:shapes.bytes.byteLength,dependencies:[]});
    expect(book.packed?.bin).toEqual({file:shapes.file.name,bytes:shapes.bytes.byteLength});
    expect(file.file.dependencies).toEqual([binary.file.hash,shapes.file.hash]);
    const old=encode(predecessor(book,binary.bytes,tier));expect([old.byteLength,hashImmutableBytes(old)]).toEqual(originals[tier]);
  }
  const gear=blobs.find(row=>row.file.name==='models/gear-book.json');if(gear===undefined)throw new Error('Missing original gear book');
  expect([gear.bytes.byteLength,hashImmutableBytes(gear.bytes)]).toEqual([8840,'6e209b5a809ab3f3bef9c7f2884f454471212c8a449a6bc9587e472804bc07b8']);
  expect(gear.file.dependencies).toEqual([]);
});

test('the real specimen intake prepares both tiers and refuses missing, truncated or retired loans',async()=>{
  const blobs=coverSpecimenBlobs(nalatiCover),binary=blobs.find(row=>row.file.name==='models/specimens/reins.bin');
  if(binary===undefined||binary.file.name===undefined)throw new Error('Missing raw reins');
  for(const tier of ['phone','desktop']as const){
    const file=blobs.find(row=>row.file.name===`models/cover-${tier}.json`);if(file===undefined)throw new Error('Missing book');
    const book=parse(SpecimenBookSchema,JSON.parse(new TextDecoder().decode(file.bytes))),reads:string[]=[];
    const prepared=await prepareSpecimenCatalogue({hasFile:name=>name===binary.file.name,file:name=>{reads.push(name);return Promise.resolve(binary.bytes);}},book.rows);
    expect(reads).toEqual([binary.file.name]);expect(prepared.get(binary.file.name)).toBe(binary.bytes);
    await expect(prepareSpecimenCatalogue({},book.rows)).rejects.toThrow('requires its product reader');
    await expect(prepareSpecimenCatalogue({hasFile:()=>false,file:()=>{throw new Error('Must refuse before reading');}},book.rows)).rejects.toThrow('Missing binary source');
    await expect(prepareSpecimenCatalogue({file:()=>Promise.resolve(binary.bytes.subarray(1))},book.rows)).rejects.toThrow('byte count differs');
    const owner=new Scope('retired reins intake');owner.dispose();
    await expect(prepareSpecimenCatalogue({file:()=>{throw new Error('Must refuse before reading');}},book.rows,owner)).rejects.toThrow('owner retired');
  }
});
