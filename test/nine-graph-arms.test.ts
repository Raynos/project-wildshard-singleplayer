import { expect, test } from 'vitest';
import { GraphArmsSchema, parseGraphArms } from '../src/format/graphArmsRows';
import { heldView } from '../src/shards/nine-dragon-stack/generators/heldView';
import arms from '../src/shards/nine-dragon-stack/data/arms.json' with { type: 'json' };

test('Nine held arms are one admitted GraphArms row', () => {
  const row = parseGraphArms(heldView());
  expect(row.blade).toEqual({ socket: 'R_weapon', base: arms.ARMS.bladeBase, tip: arms.ARMS.bladeTip });
  expect(row.rig.joints.flat()).toHaveLength(14);
  expect(new Set(row.meshes.map(mesh => mesh.look)).size).toBeGreaterThan(0);
  for (const entry of row.frame) if (entry.look !== undefined) expect(row.params[entry.look]).toContain(entry.param);
  expect(() => parseGraphArms({ ...row, frame: [{ param: 'uTime', source: 'clock' }] })).toThrow();
});

test('held view admission preserves rows and refuses malformed named payloads', async () => {
  const { namedJsonSchema } = await import('../src/sdk/formatJsonSchema');
  const { nameBlob } = await import('../src/sdk/blobs');
  const { createShardProduct } = await import('../src/game/shardfile/shardProduct');
  const { emptyShardfile } = await import('../src/sdk/author');
  const encode = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));
  const row = parseGraphArms(heldView()), schema = namedJsonSchema(GraphArmsSchema);
  const blob = nameBlob('weapons/held.json', 'json', encode(row), { jsonSchema: schema });
  let payload = blob.bytes;
  const identity = {slug:'held-schema',name:'Held schema',author:'Wildshard',revision:1,seed:1};
  const product = createShardProduct({slug:identity.slug,revision:1,shardfile:emptyShardfile(identity),sections:new Map(),
    files:new Map([['weapons/held.json',{...blob.file,url:'https://example.test/held'}]]),read:()=>Promise.resolve(payload)});
  expect(await product.json('weapons/held.json')).toEqual(row);
  for (const bad of [
    {...row, trail:{...row.trail, samples:0}},
    {...row, frame:[{param:'uTime',source:'clock'}]},
    {...row, rig:{...row.rig,sockets:['duplicate','duplicate']}},
    {...row, meshes:[{...row.meshes[0],hull:'yes'}]},
    {...row, pendants:{...row.pendants,geometry:[{file:'parts.json',field:'part'}]}},
  ]) {
    expect(()=>parseGraphArms(bad)).toThrow();
    expect(()=>nameBlob('weapons/held.json','json',encode(bad),{jsonSchema:schema})).toThrow('refuses its schema');
    payload=encode(bad);
    await expect(product.json('weapons/held.json')).rejects.toThrow('refuses its schema');
  }
});
