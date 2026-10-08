// oxlint-disable-next-line import/no-nodejs-modules -- Execute the actual browser expression without starting a native session.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Isolate the browser-only diagnostic from the test global.
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';

it('the native end census never invokes released-array or Source accessors and still counts stored shared views once', () => {
  const source = readFileSync('scripts/sim-memory.mjs', 'utf8');
  const expression = /const SCENE_STATS = `([\s\S]+?)`;/u.exec(source)?.[1];
  if (expression === undefined) throw new Error('Missing actual native scene diagnostic');
  let reads = 0;
  const released = Object.defineProperty({}, 'array', { get: () => { reads++; return new Float32Array(1024); } });
  const releasedImage = Object.defineProperty({}, 'data', { get: () => { reads++; return { data: new Uint8Array(1024) }; } });
  const shared = new Float32Array(3), indices = new Uint16Array(3), pixels = new Uint8Array(8);
  const texture = { isTexture: true, source: { data: { data: pixels } }, mipmaps: [] };
  const objects = [{ geometry: { attributes: { position: { array: shared }, normal: released, uv: { data: { array: shared } } }, index: { array: indices } },
    instanceMatrix: released, instanceColor: released, material: { map: texture, uniforms: { same: { value: texture }, retired: { value: { isTexture: true, source: releasedImage, mipmaps: [] } } } } }];
  const serialized: unknown = runInNewContext(expression, { window: { __wildshard: { world: { game: { scene: { traverse: (visit: (object: object) => void) => { objects.forEach(visit); } } } } } } });
  if (typeof serialized !== 'string') throw new Error('Missing serialized census');
  expect(reads).toBe(0);
  expect(JSON.parse(serialized)).toMatchObject({ geometryBytes: 18, instancedBytes: 0, textureImageBytes: 8, skippedAccessors: 4, arrays: 2, textures: 2 });
});
