// oxlint-disable-next-line import/no-nodejs-modules -- Read the actual native floor payloads without importing megabyte JSON types.
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import * as v from 'valibot';
import { nativeGroundRecordSchema } from '../src/format/nativePhysics';
import { nativeBakeFloats, nativeBakeGround } from '../src/game/population/nativeBake';
import { hashImmutableBytes } from '../src/sdk/immutable';

for (const slug of ['driftwood-isle','pine-hollow']) test(`${slug} retains all floor bytes and values through inline and raw intake`, () => {
  const source:unknown=JSON.parse(readFileSync(`src/shards/${slug}/data/physics.generated.json`,'utf8'));
  const row=v.parse(v.object({ground:nativeGroundRecordSchema(256,true)}),source).ground;
  const original=typeof row.heights==='string' ? nativeBakeFloats(row.heights)
    : new Float32Array(Uint8Array.from(readFileSync(`src/shards/${slug}/${row.heights.file}`)).buffer);
  const bytes=new Uint8Array(original.buffer);
  const inline=nativeBakeGround(row,256,500,slug,typeof row.heights==='string' ? undefined : {file:row.heights.file,bytes});
  const file='data/floor.bin';
  const raw=nativeBakeGround({...row,heights:{file}},256,500,slug,{file,bytes});
  expect(original).toHaveLength(65536);
  if(slug==='pine-hollow') expect(hashImmutableBytes(bytes)).toBe('baf2636f4cd6668e9104241c91a265734f1c34f915832184809f7e0e50de1acd');
  for (const current of [inline,raw]) {
    expect(hashImmutableBytes(new Uint8Array(current.heights.buffer))).toBe(hashImmutableBytes(bytes));
    expect(original.every((value,index)=>Object.is(value,current.heights[index]))).toBe(true);
    expect(current.scale).toEqual({x:500,y:1,z:500});
    expect(current.at).toEqual({x:0,y:0,z:0});
    expect(current.friction).toBe(row.friction);expect(current.groups).toBe(row.groups);
  }
  console.info(`${slug}: 262144 bytes, 65536 Object.is values; SHA-256 ${hashImmutableBytes(bytes)}`);
});
