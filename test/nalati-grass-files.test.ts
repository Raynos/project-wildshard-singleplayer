// oxlint-disable-next-line import/no-nodejs-modules -- Original compressed payload hashes, never replacement geometry.
import {createHash} from 'node:crypto';
import * as v from 'valibot';
import {expect,test} from 'vitest';
import {nameBlob} from '../src/sdk/blobs';
import {nalatiGrass,nalatiGrassJson} from './fixtures/nalati-grass-bake';
import {GrassPresentationSchema,grassPresentationFiles} from '../src/format/fieldPresentation';
import {GrassPresentationProfile} from '../src/game/looks/grassPresentation';
import {GRASS_FILES,originalGrassProfile} from './fixtures/nalatiGrass';
import reference from './fixtures/nalati-grass-blocks.json' with {type:'json'};
import {grassChannelBytes} from '../src/shards/nalati-grasslands/generators/grassRows';
import nativeReference from './fixtures/nalati-grass-native-blocks.json' with {type:'json'};
// oxlint-disable-next-line import/no-nodejs-modules -- The committed terrain lattice feeds the predecessor grass.
import {readFileSync} from 'node:fs';
import {nalatiGrassBake} from '../src/shards/nalati-grasslands/generators/grassBake.mjs';
import {sampledDressingPlacements} from './fixtures/nalati-sampled-dressing';

const input:unknown=nalatiGrassJson();
const rows=v.parse(GrassPresentationSchema,input);
const sources=v.parse(v.object({sources:v.array(v.object({name:v.string(),source:v.string(),options:v.object({decoded:v.number()})}))}),input).sources;
const hash=(bytes:Uint8Array):string=>createHash('sha256').update(bytes).digest('hex');

// Original scene pins remain independent: only their transport is reconstructed.
test('native publication preserves every old block and pins the full replacement inventory',()=>{
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
    const blob=source===undefined?grassChannelBytes().map(row=>nameBlob(row.name,'bin',row.bytes,{decoded:row.decoded})).find(row=>row.file.name===`look/grass/${pin.id}.bin`):nameBlob(source.name,'bin',nalatiGrass.files.get(source.name)??new Uint8Array(),source.options);
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

// QF24 (2c1ad0bbcc): the dressing follows LEGACY's continuous spruce mask. Over the predecessor's sampled-lattice placements
// the same bake still makes the old mask block byte for byte, and every other block equals the product's: the
// forest law is the mask's only change (35434 -> 35499 B).
test('the sampled-forest predecessor keeps the old grass mask and every other block',async()=>{
  const before=nalatiGrassBake(new Uint8Array(readFileSync('public/assets/baked/nalati-grasslands/terrain.bin')),await sampledDressingPlacements());
  const mask=before.files.get('look/grass/mask.bin');if(mask===undefined)throw new Error('Missing predecessor grass mask');
  expect({bytes:mask.length,hash:hash(mask)}).toEqual({bytes:35434,hash:'73d990f4ee4b6c5cd31d766daa0a321545403ab343b34b31058c36bd620a42f5'});
  for(const [name,bytes]of nalatiGrass.files)if(name!=='look/grass/mask.bin')expect(before.files.get(name),name).toEqual(bytes);
},120000);
