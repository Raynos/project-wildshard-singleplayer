import { expect, test } from 'vitest';

test('overlapping schema imports initialize their exports before explicit codec preparation', async () => {
  // Safari <27 can finish a second import of a TLA dependency prematurely.
  // Module evaluation must be synchronous; Wasm readiness belongs to admission.
  const [buffers, product, schema] = await Promise.all([import('./glbBuffers'), import('./product'), import('./shardSchema')]);
  expect(schema.ShardfileSchema['~run']).toBeTypeOf('function');
  expect(product.preflightAssetGraph).toBeTypeOf('function');
  const physical = new Uint8Array([9, 8, 7, 6]);
  expect(buffers.glbBuffers({ buffers: [{ byteLength: 4 }], bufferViews: [{ byteLength: 4 }] }, physical).bytes).toBe(physical);
  await Promise.all([product.prepareAssetDecoders(), product.prepareAssetDecoders()]);
  expect(() => buffers.glbBuffers({ buffers: [{ byteLength: 4 }], bufferViews: [{ byteLength: 5 }] }, physical)).toThrow('outside buffer');
});
