import {expect,test} from 'vitest';
import {parse} from 'valibot';
import {Scope} from '@wildshard/engine/app/scope';
import {SpecimenBookSchema} from '@wildshard/format/specimenCatalogue';
import {readBakedGeometry} from '../src/game/plugin/geometry';
import {prepareSpecimenCatalogue} from '../src/game/models/specimenCatalogue';
import {reinsCardBinary} from '../src/shards/nalati-grasslands/generators/reinsCard';
import {coverSpecimenBlobs} from '../src/shards/nalati-grasslands/generators/coverSpecimens';
import reins from '../src/shards/nalati-grasslands/data/reins.json' with {type:'json'};
import { nalatiCover } from './fixtures/nalati-cover';

test('the reins card uses its authored ribbon counts, material and standing bounds',()=>{
  const made=reinsCardBinary(),row=made.book.rows[0];if(row?.source.kind!=='file')throw new Error('Missing raw reins');
  const strap=(reins.span*3+1)*2;
  expect(row.source.geometry).toMatchObject({count:2*strap,indexCount:2*reins.span*3*6});
  expect(row.source.material).toMatchObject({family:'painterly',rim:reins.paint.rim,bands:reins.paint.bands,side:'double'});
  const geometry=readBakedGeometry(made.bytes,0,row.source.geometry);
  geometry.computeBoundingBox();const box=geometry.boundingBox;if(box===null)throw new Error('Missing reins bounds');
  expect(box.min.y).toBeCloseTo(0,5);expect(box.min.x+box.max.x).toBeCloseTo(0,5);expect(box.max.z-box.min.z).toBeGreaterThan(.5);
  geometry.dispose();
});

test('raw producer calls own detached bytes and declarations',()=>{
  const first=reinsCardBinary(),second=reinsCardBinary();
  const before=second.bytes.slice();
  expect(first.bytes).not.toBe(second.bytes);expect(first.book).not.toBe(second.book);
  first.bytes.fill(0);first.book.rows.length=0;
  expect(second.bytes).toEqual(before);
  expect(second.book.rows).toHaveLength(1);
});

test('both cover books depend on their packed shapes and one shared reins binary',()=>{
  const blobs=coverSpecimenBlobs(nalatiCover),binary=blobs.find(row=>row.file.name==='models/specimens/reins.bin');
  if(binary===undefined)throw new Error('Missing published reins');
  expect(blobs.filter(row=>row.file.name===binary.file.name)).toHaveLength(1);
  expect(binary.file).toMatchObject({kind:'bin',compressed:binary.bytes.byteLength,decoded:binary.bytes.byteLength,critical:false,dependencies:[]});
  for(const tier of ['phone','desktop']as const){
    const file=blobs.find(row=>row.file.name===`models/cover-${tier}.json`);if(file===undefined)throw new Error('Missing cover book');
    const book=parse(SpecimenBookSchema,JSON.parse(new TextDecoder().decode(file.bytes))),reinsRow=book.rows.find(row=>row.key==='reins');
    expect(reinsRow?.source).toMatchObject({kind:'file',file:binary.file.name});
    // 4a5a2ed0cd: each tier's packed cover shapes are its own product file, which its book names and depends on
    const shapes=blobs.find(row=>row.file.name===`models/cover-${tier}.bin`);if(shapes===undefined)throw new Error('Missing cover shapes');
    expect(shapes.file).toMatchObject({kind:'bin',compressed:shapes.bytes.byteLength,dependencies:[]});
    expect(book.packed?.bin).toEqual({file:shapes.file.name,bytes:shapes.bytes.byteLength});
    expect(file.file.dependencies).toEqual([binary.file.hash,shapes.file.hash]);
  }
  const gear=blobs.find(row=>row.file.name==='models/gear-book.json');if(gear===undefined)throw new Error('Missing original gear book');
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
