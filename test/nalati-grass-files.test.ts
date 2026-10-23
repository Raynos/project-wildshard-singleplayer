// oxlint-disable-next-line import/no-nodejs-modules -- Original compressed payload hashes, never replacement geometry.
import {createHash} from 'node:crypto';
// oxlint-disable-next-line import/no-nodejs-modules -- Read generated source declarations without static JSON inference.
import {readFileSync} from 'node:fs';
import * as v from 'valibot';
import {expect,test} from 'vitest';
import {readNamedBlob} from '../src/sdk/blobs';
import {GrassPresentationSchema,grassPresentationFiles} from '../src/format/fieldPresentation';
import {GrassPresentationProfile} from '../src/game/looks/grassPresentation';
import {GRASS_FILES} from './fixtures/nalatiGrass';
import reference from './fixtures/nalati-grass-blocks.json' with {type:'json'};

const input:unknown=JSON.parse(readFileSync('src/shards/nalati-grasslands/data/grass.generated.json','utf8'));
const rows=v.parse(GrassPresentationSchema,input);
const sources=v.parse(v.object({sources:v.array(v.object({name:v.string(),source:v.string(),options:v.object({decoded:v.number()})}))}),input).sources;
const hash=(bytes:Uint8Array):string=>createHash('sha256').update(bytes).digest('hex');

test('all grass payloads use named binary intake with the original compressed bytes',async()=>{
  expect(grassPresentationFiles(rows)).toHaveLength(10);expect(sources).toHaveLength(10);
  for(const before of reference){
    const source=sources.find(row=>row.name===`look/grass/${before.id}.bin`);
    if(source===undefined)throw new Error(`Missing grass file ${before.id}`);
    const blob=await readNamedBlob('src/shards/nalati-grasslands',source.name,source.source,'bin',source.options);
    expect(blob.bytes.length).toBe(before.bytes);expect(hash(blob.bytes)).toBe(before.hash);
    expect(blob.file.decoded).toBe(before.decoded);expect(blob.bytes).toEqual(GRASS_FILES.get(source.name));expect(blob.file.kind).toBe('bin');
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
