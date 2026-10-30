import * as v from 'valibot';
import {expect,test} from 'vitest';
import {nameBlob} from '../src/sdk/blobs';
import {nalatiGrass,nalatiGrassJson} from './fixtures/nalati-grass-bake';
import {GrassPresentationSchema,grassPresentationFiles} from '../src/format/fieldPresentation';
import {GrassPresentationProfile} from '../src/game/looks/grassPresentation';
import {GRASS_FILES} from './fixtures/nalatiGrass';
import {grassChannelBytes} from '../src/shards/nalati-grasslands/generators/grassRows';

const input:unknown=nalatiGrassJson();
const rows=v.parse(GrassPresentationSchema,input);
const sources=v.parse(v.object({sources:v.array(v.object({name:v.string(),source:v.string(),options:v.object({decoded:v.number()})}))}),input).sources;

test('native publication supplies every file declared by its grass profile',()=>{
  const inventory=grassPresentationFiles(rows);expect(inventory.length).toBeGreaterThan(0);
  for(const name of inventory){
    const source=sources.find(row=>row.name===name);
    const blob=source===undefined?grassChannelBytes().map(row=>nameBlob(row.name,'bin',row.bytes,{decoded:row.decoded})).find(row=>row.file.name===name):nameBlob(source.name,'bin',nalatiGrass.files.get(source.name)??new Uint8Array(),source.options);
    if(blob===undefined||blob.file.name===undefined)throw new Error(`Missing grass file ${name}`);
    expect(blob.bytes).toEqual(GRASS_FILES.get(blob.file.name));expect(blob.file.kind).toBe('bin');
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

