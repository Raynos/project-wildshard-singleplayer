import { nineHeldPresentationBytes } from './fixtures/nine-held-presentation';
import * as v from 'valibot';
import { inputs } from './fixtures/nine-product-inputs';
import { expect, test } from 'vitest';
import { GraphArmsSchema, parseGraphArms } from '../src/format/graphArmsRows';
import { heldView, heldViewSchema } from '../src/shards/nine-dragon-stack/generators/heldView';
import arms from '../src/shards/nine-dragon-stack/data/arms.json' with { type: 'json' };

test('Nine held arms are one admitted GraphArms row', () => {
  const row = parseGraphArms(heldView(inputs.held));
  expect(row.blade).toEqual({ socket: 'R_weapon', base: arms.ARMS.bladeBase, tip: arms.ARMS.bladeTip });
  expect(row.rig.joints.flat()).toHaveLength(14);
  expect(new Set(row.meshes.map(mesh => mesh.look)).size).toBeGreaterThan(0);
  for (const entry of row.frame) if (entry.look !== undefined) expect(row.params[entry.look]).toContain(entry.param);
  expect(() => parseGraphArms({ ...row, frame: [{ param: 'uTime', source: 'clock' }] })).toThrow();
});

test('held view admission preserves rows and refuses malformed named payloads', async () => {
  const { namedJsonSchema, registeredJsonSchema } = await import('../src/sdk/formatJsonSchema');
  const { nameBlob } = await import('../src/sdk/blobs');
  const { createShardProduct } = await import('../src/game/shardfile/shardProduct');
  const { emptyShardfile } = await import('../src/sdk/author');
  const encode = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));
  const row = parseGraphArms(heldView(inputs.held)), schema = namedJsonSchema(GraphArmsSchema);
  const pool = row.pendants.geometry[0], file = pool?.files[0];
  if (pool === undefined || file === undefined) throw new Error('Missing original native pendant pool');
  const badPools = [
    { ...pool, files: [{ ...file, parts: ['duplicate', 'duplicate'] }] },
    { ...pool, files: [{ ...file, parts: Array.from({ length: 129 }, (_, i) => `part-${i}`) }] },
    { ...pool, files: Array.from({ length: 17 }, (_, i) => ({ file: `part-${i}.glb`, parts: [`part-${i}`] })) },
    { ...pool, files: [{ ...file, channels: [{ name: 'position', source: '_wind', width: 1 }] }] },
    { ...pool, files: [{ ...file, channels: [{ name: 'wind', source: '_wind', width: 5 }] }] },
    { ...pool, files: [{ ...file, channels: [{ name: 'wind', source: '_wind', width: 1, parts: ['missing'] }] }] },
    { ...pool, files: [{ ...file, channels: [{ name: 'wind', source: '_wind', width: 1 }, { name: 'other', source: '_wind', width: 1 }] }] },
    { ...pool, painted: [{ id: 'missing', file: 'missing.glb', geometry: 'missing' }] },
  ];
  for (const invalidPool of badPools) expect(() => parseGraphArms({ ...row, pendants: { ...row.pendants, geometry: [invalidPool] } })).toThrow();
  expect(heldViewSchema()).toEqual(schema);
  expect(JSON.stringify(heldViewSchema())).toBe(JSON.stringify(schema));
  const blob = nameBlob('weapons/held.json', 'json', encode(row), { jsonSchema: schema });
  expect(blob.bytes).toEqual(encode(row));
  let privateReads = 0;
  const privateIdentity = {slug:'private-held',name:'Private held',author:'Fixture',revision:1,seed:1};
  const privateProduct = createShardProduct({slug:privateIdentity.slug,revision:1,shardfile:emptyShardfile(privateIdentity),sections:new Map(),
    files:new Map([['weapons/held.json',{...blob.file,url:'https://example.test/private-held'}]]),
    read:()=>{privateReads++;return Promise.resolve(blob.bytes);}});
  await expect(privateProduct.json('weapons/held.json')).rejects.toThrow('unregistered named JSON is retired');
  expect(privateReads).toBe(0);
  // The leaf remains the native GraphArms oracle. Product ingestion uses the
  // complete shipped Jian document, with that same view and original guards.
  const presentation = v.parse(v.record(v.string(), v.unknown()),
    JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(nineHeldPresentationBytes())));
  const document = { ...presentation, view: row }, name = 'weapons/jian-row.json';
  const productSchema = registeredJsonSchema(name);
  const productBlob = nameBlob(name, 'json', encode(document), {jsonSchema:productSchema});
  expect(productBlob.bytes).toEqual(encode(document));
  let payload = productBlob.bytes;
  const identity = {slug:'held-schema',name:'Held schema',author:'Wildshard',revision:1,seed:1};
  const product = createShardProduct({slug:identity.slug,revision:1,shardfile:emptyShardfile(identity),sections:new Map(),
    files:new Map([[name,{...productBlob.file,url:'https://example.test/held'}]]),read:()=>Promise.resolve(payload)});
  expect(await product.json(name)).toEqual(document);
  expect(document.view).toEqual(row);
  for (const bad of [
    {...row, trail:{...row.trail, samples:0}},
    {...row, frame:[{param:'uTime',source:'clock'}]},
    {...row, rig:{...row.rig,sockets:['duplicate','duplicate']}},
    {...row, meshes:[{...row.meshes[0],hull:'yes'}]},
    {...row, pendants:{...row.pendants,geometry:[{file:'parts.json',field:'part'}]}},
    {...row, decal:{...row.decal,files:{phone:row.decal.files.phone}}},
    {...row, decal:{...row.decal,files:{...row.decal.files,desktop:''}}},
    { ...row, pendants: { ...row.pendants, geometry: [{ ...pool, files: [{ ...file, channels: [{ name: 'wind', source: '_wind', width: 5 }] }] }] } },
  ]) {
    expect(()=>parseGraphArms(bad)).toThrow();
    expect(()=>nameBlob('weapons/held.json','json',encode(bad),{jsonSchema:schema})).toThrow('refuses its schema');
    payload=encode({...document,view:bad});
    await expect(product.json(name)).rejects.toThrow('refuses its schema');
  }
});
