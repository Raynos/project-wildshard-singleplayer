import {expect,test} from 'vitest';
import * as v from 'valibot';
// oxlint-disable-next-line import/no-nodejs-modules -- Compare retained native pixels without embedding any binary in JSON.
import {createHash} from 'node:crypto';
import {output} from '../src/shards/nine-dragon-stack/generators/output';
import {readNamedBlob} from '../src/sdk/blobs';
import {readImagePixels} from '../src/sdk/bake/image';
import before from './fixtures/nine-decal-binary.json' with {type:'json'};

for(const tier of ['phone','desktop'] as const)test(`${tier} decal uses the original PNG, costs and native pixels through declared file intake`,async()=>{
  const source=v.parse(v.strictObject({name:v.string(),kind:v.literal('image'),source:v.string()}),output.blobs.find(row=>row.name===`looks/jian-decal-${tier}.png`));
  const blob=await readNamedBlob('src/shards/nine-dragon-stack',source.name,source.source,source.kind),image=await readImagePixels(blob.bytes);
  expect(blob.file).toStrictEqual(before[tier].file);
  expect(image.width).toBe(before[tier].width);expect(image.height).toBe(before[tier].height);
  expect(createHash('sha256').update(image.pixels).digest('hex')).toBe(before[tier].pixelHash);
});
