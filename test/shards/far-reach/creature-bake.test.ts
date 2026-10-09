import { describe, expect, it } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- The stale gate reads the generated sources and the committed bake.
import { readdirSync, readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Byte comparison of the baked channels.
import { Buffer } from 'node:buffer';
import { skinnedModel } from '@wildshard/sdk/skinnedModel';
import { bakeSkyCreatures, skyCreatureBodies } from '../../../src/shards/far-reach/generators/creatures';
import { SKY_CREATURES, SKY_CREATURE_RIGS } from '../../../src/shards/far-reach/boot/files';

const read = (url: string): Uint8Array => new Uint8Array(readFileSync(`public${url}`));
const bytes = (array: ArrayLike<number> & { buffer: ArrayBufferLike; byteOffset: number; byteLength: number }): Buffer => Buffer.from(array.buffer, array.byteOffset, array.byteLength);

describe('Sky Reach creature bodies (SHARD-PLATFORM M3: the offline skinned-model bake)', () => {
  it('the committed rigs are the generator\'s bytes (stale gate: rerun scripts/bake-sky-rigs.mjs)', async () => {
    const bakes = await bakeSkyCreatures(read);
    expect(Object.keys(bakes).sort()).toEqual([...SKY_CREATURES].sort());
    expect(readdirSync('public/assets/far-reach/rigs').sort()).toEqual(SKY_CREATURES.map((creature) => `${creature}.glb`).sort());
    for (const creature of SKY_CREATURES) expect(bytes(bakes[creature].glb).equals(readFileSync(`public${SKY_CREATURE_RIGS[creature]}`)), creature).toBe(true);
  }, 60_000);

  it('the client loads each body bit-exact to the generator\'s processing: bones, every skin and colour channel, dims, look numbers', async () => {
    const bodies = await skyCreatureBodies(read);
    for (const creature of SKY_CREATURES) {
      const body = bodies[creature], model = skinnedModel(SKY_CREATURE_RIGS[creature]);
      // Node decodes no images: three's loader reaches for the browser's `self` before it gives up on the Roc's map (null here)
      Object.assign(globalThis, { self: globalThis });
      try { await model.load(read(SKY_CREATURE_RIGS[creature])); } finally { Reflect.deleteProperty(globalThis, 'self'); }
      const asset = model.copy(), [part] = asset.parts;
      if (part === undefined) throw new Error(`${creature}: no part`);
      expect(asset.parts).toHaveLength(1);
      expect(asset.bones).toEqual(body.bones);
      expect(asset.extras).toEqual({ dims: body.dims, ...(body.facetJitter === undefined ? {} : { facetJitter: body.facetJitter }), ...(body.selfLight === undefined ? {} : { selfLight: body.selfLight }) });
      expect(part.geometry.index).toBeNull();
      expect(Object.keys(part.geometry.attributes).sort()).toEqual(Object.keys(body.geometry.attributes).sort());
      for (const name of Object.keys(body.geometry.attributes)) {
        const a = part.geometry.getAttribute(name), b = body.geometry.getAttribute(name);
        expect([creature, name, a.array.constructor.name, a.itemSize]).toEqual([creature, name, b.array.constructor.name, b.itemSize]);
        expect(bytes(a.array).equals(bytes(b.array)), `${creature} ${name}`).toBe(true);
      }
      // the Roc's painted map is the source's exact image, embedded (the KTX2 bake makes its phone stand-in from it)
      expect(body.texture !== undefined).toBe(creature === 'storm-roc');
      part.geometry.dispose(); body.geometry.dispose();
    }
  }, 60_000);
});
