// oxlint-disable-next-line import/no-nodejs-modules -- Original compressed payload hashes, never replacement geometry.
import {createHash} from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Read generated source declarations without static JSON inference.
import {readFileSync} from 'node:fs';
import * as v from 'valibot';
import {expect,test} from 'vitest';
import {readNamedBlob,nameBlob} from '../src/sdk/blobs';
import {GrassPresentationSchema,grassPresentationFiles} from '../src/format/fieldPresentation';
import {GrassPresentationProfile} from '../src/game/looks/grassPresentation';
import {GRASS_FILES,originalGrassProfile} from './fixtures/nalatiGrass';
import reference from './fixtures/nalati-grass-blocks.json' with {type:'json'};
import {grassChannelBytes} from '../src/shards/nalati-grasslands/generators/grassRows';
import nativeReference from './fixtures/nalati-grass-native-blocks.json' with {type:'json'};

const input:unknown=JSON.parse(readFileSync('src/shards/nalati-grasslands/data/grass.generated.json','utf8'));
const rows=v.parse(GrassPresentationSchema,input);
const sources=v.parse(v.object({sources:v.array(v.object({name:v.string(),source:v.string(),options:v.object({decoded:v.number()})}))}),input).sources;
const hash=(bytes:Uint8Array):string=>createHash('sha256').update(bytes).digest('hex');

// Original scene pins remain independent: only their transport is reconstructed.
test('native publication preserves every old block and pins the full replacement inventory',async()=>{
  expect(grassPresentationFiles(rows)).toHaveLength(12);expect(sources).toHaveLength(10);
  const original=originalGrassProfile();
  for(const before of reference){
    const bytes=original.files.get(`look/grass/${before.id}.bin`);
    if(bytes===undefined)throw new Error(`Missing original grass file ${before.id}`);
    expect(bytes.length).toBe(before.bytes);expect(hash(bytes)).toBe(before.hash);
  }
  const inventory=[...reference.filter(row=>!row.id.includes('-')),...nativeReference];
  expect(inventory).toHaveLength(12);
  for(const pin of inventory){
    const source=sources.find(row=>row.name===`look/grass/${pin.id}.bin`);
    const blob=source===undefined?grassChannelBytes().map(row=>nameBlob(row.name,'bin',row.bytes,{decoded:row.decoded})).find(row=>row.file.name===`look/grass/${pin.id}.bin`):await readNamedBlob('src/shards/nalati-grasslands',source.name,source.source,'bin',source.options);
    if(blob===undefined||blob.file.name===undefined)throw new Error(`Missing grass file ${pin.id}`);
    expect(blob.bytes.length).toBe(pin.bytes);expect(hash(blob.bytes)).toBe(pin.hash);
    expect(blob.file.decoded).toBe(pin.decoded);expect(blob.bytes).toEqual(GRASS_FILES.get(blob.file.name));expect(blob.file.kind).toBe('bin');
  }
});

test('raw grass profiles preserve full height and field layouts and reject missing files before texture allocation',()=>{
  expect(()=>new GrassPresentationProfile(rows)).toThrow('Missing grass file');
  const profile=new GrassPresentationProfile(rows,GRASS_FILES),texture=profile.heightTexture();
  expect(texture.image.width).toBe(512);expect(texture.image.height).toBe(512);
  expect(profile.bytes(profile.input.field).length).toBe(126*126*4);
  expect(profile.bytes(profile.input.ground).length).toBe(126*126*4);
  expect(profile.bytes(profile.input.mask).length).toBe(512*512*4);
  for(const tier of [profile.input.phone,profile.input.desktop])for(const block of Object.values(tier.scenes))expect(()=>profile.scene(block)).not.toThrow();
  texture.dispose();
});
