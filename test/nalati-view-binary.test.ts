// oxlint-disable-next-line import/no-nodejs-modules -- Pin original executable bytes.
import {createHash} from 'node:crypto';
import {expect,test} from 'vitest';
import {readNamedBlob} from '../src/sdk/blobs';
import {admitScriptV2} from '../src/format/scriptAdmissionV2';
import {output} from './fixtures/nalati-output-original';
import {outputPlatformPayloads} from '../src/sdk/outputProduct';

const originals = [
  {
    "stem": "creatureViews",
    "slug": "creature-views",
    "hash": "a9f6ffe5697d4875bc7cb92f13e23d655d80268b46bd53ae95a2c5f0446994b0",
    "bytes": 8793,
    "pages": 1,
    "ioBytes": 8192
  },
  {
    "stem": "eliteViews",
    "slug": "elite-views",
    "hash": "0a3978574d5b0d5cd549c4f12b329f9e68e53d40874a6b16f3ef6ca717dbb473",
    "bytes": 972,
    "pages": 1,
    "ioBytes": 4096
  },
  {
    "stem": "titanView",
    "slug": "titan-view",
    "hash": "79096f2ff7fc171c5147e277f031f9ed8d35019dc5cf32bc44ae7f2ec17e5d1b",
    "bytes": 1414,
    "pages": 1,
    "ioBytes": 4096
  },
  {
    "stem": "titanFireView",
    "slug": "titan-fire-view",
    "hash": "e3410221f4afe5d3d6ebbc51de1adadb571a6f16630d1cd9a3d2acea92489193",
    "bytes": 9114,
    "pages": 3,
    "ioBytes": 81920
  },
  {
    "stem": "titanWhirlsView",
    "slug": "titan-whirls-view",
    "hash": "c363377699e4af7362f7bbf24dadbd214ec204dd1710339d1e7a3aaa1564f405",
    "bytes": 5479,
    "pages": 1,
    "ioBytes": 16384
  }
] as const;
test.each(originals)('raw $stem keeps the original bytes and view admission',async original=>{
  const name=`views/nalati.${original.slug}.wasm`;
  const row=output.blobs.find(blob=>blob.name===name);
  if(row===undefined||row.kind!=='wasm'||!('options' in row))throw new Error('Missing named view source');
  const blob=await readNamedBlob('src/shards/nalati-grasslands',row.name,row.source,row.kind,row.options);
  expect(blob.bytes.length).toBe(original.bytes);
  expect(createHash('sha256').update(blob.bytes).digest('hex')).toBe(original.hash);
  expect(blob.file).toMatchObject({critical:true,hash:original.hash});
  expect(blob.script).toMatchObject({abi:2,lane:'view',pages:original.pages,ioBytes:original.ioBytes});
  expect(()=>admitScriptV2(blob.bytes,{lane:'view',ioBytes:original.ioBytes})).not.toThrow();
  const sections=outputPlatformPayloads(output.platform,['view/modules']);
  expect(sections.get('view/modules')).toContainEqual(expect.objectContaining({id:`nalati.${original.slug}`,module:blob.file.path,abi:2,side:'view',ioBytes:original.ioBytes}));
});
