/** Opt-in real Blender export codec proof. No synthetic fallback and no production writes.
 * PUFFER_NATIVE_SOURCE=<actual v2 JSON> PUFFER_NATIVE_PACK=<scratch packed dir>
 * pnpm exec vitest run test/puffer-native-export.test.ts --maxWorkers=1
 */
// oxlint-disable-next-line import/no-nodejs-modules -- Read only the explicitly supplied Blender codec proof files.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the explicitly supplied scratch pack directory.
import { resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- An opt-in offline codec proof requires explicit input paths.
import { env } from 'node:process';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import { packedCreatureBodies } from '../src/game/plugin/geometry';

const sourcePath = env['PUFFER_NATIVE_SOURCE'];
const packedPath = env['PUFFER_NATIVE_PACK'];
const finite = v.pipe(v.number(), v.finite());
const sourceSchema = v.object({ schema: v.literal('wildshard.puffer.mesh.v2'),
  bones: v.array(v.object({ name: v.string(), parent: v.nullable(v.string()), pos: v.tuple([finite, finite, finite]) })),
  parts: v.array(v.object({ name: v.string(), positions: v.array(finite), colorsLinear: v.array(finite),
    skinIndices: v.array(v.pipe(finite, v.integer())), skinWeights: v.array(finite), furLen: v.array(finite) })) });

test.skipIf(sourcePath === undefined || packedPath === undefined)('real Puffer native export survives the existing packed-body consumer', async () => {
  if (sourcePath === undefined || packedPath === undefined) throw new Error('Explicit real native source and packed directory required');
  const rawSource: unknown = JSON.parse(readFileSync(sourcePath, 'utf8'));
  const source = v.parse(sourceSchema, rawSource);
  const metadata: unknown = JSON.parse(readFileSync(resolve(packedPath, 'metadata.json'), 'utf8'));
  const bytes = new Uint8Array(readFileSync(resolve(packedPath, 'payload.bin')));
  const bodies = packedCreatureBodies(metadata, undefined, () => Promise.resolve(bytes));
  await bodies.preload();
  const body = bodies.copy('brine-puffer', 'brine-puffer');
  const second = bodies.copy('brine-puffer', 'brine-puffer');
  expect(body.bones).toEqual(source.bones);
  expect(body.bones[0]?.name).toBe('body');
  expect(body.bones[0]?.parent).toBeNull();
  expect(body.bones.find(bone => bone.name === 'head')?.parent).toBe('belly');
  const seen = new Set<string>();
  for (const bone of body.bones) {
    if (bone.parent !== null) expect(seen.has(bone.parent)).toBe(true);
    expect(seen.has(bone.name)).toBe(false);
    seen.add(bone.name);
  }
  const dimensions = v.parse(v.object({ bodies: v.array(v.object({ dims: v.unknown() })) }), metadata);
  expect(body.dims).toEqual(dimensions.bodies[0]?.dims);
  expect(body.dims.bodyY).toBe(body.bones[0]?.pos[1]);
  expect(body.hardParts).toHaveLength(source.parts.length);
  expect(body.furParts).toHaveLength(0); expect(body.eyeParts).toHaveLength(0);
  let vertices = 0;
  source.parts.forEach((part, index) => {
    const geometry = body.hardParts[index];
    if (geometry === undefined) throw new Error('Missing exported part');
    expect(geometry).not.toBe(second.hardParts[index]);
    expect(geometry.index).toBeNull();
    const channels = [
      ['position', 3, part.positions], ['color', 3, part.colorsLinear],
      ['skinIndex', 4, part.skinIndices], ['skinWeight', 4, part.skinWeights], ['furLen', 1, part.furLen],
    ] as const;
    for (const [name, width, expected] of channels) {
      const attribute = geometry.getAttribute(name);
      expect(attribute.itemSize).toBe(width);
      expect(attribute.normalized).toBe(false);
      const array = name === 'skinIndex' ? Uint16Array.from(expected) : Float32Array.from(expected);
      expect(attribute.array.constructor).toBe(array.constructor);
      expect(Array.from(attribute.array)).toEqual(Array.from(array));
    }
    const weights = geometry.getAttribute('skinWeight');
    const indices = geometry.getAttribute('skinIndex');
    for (let i = 0; i < weights.count; i++) {
      const lanes = [weights.getX(i), weights.getY(i), weights.getZ(i), weights.getW(i)];
      expect(lanes.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 6);
      for (const joint of [indices.getX(i), indices.getY(i), indices.getZ(i), indices.getW(i)]) {
        expect(joint).toBeGreaterThanOrEqual(0); expect(joint).toBeLessThan(body.bones.length);
      }
    }
    vertices += geometry.getAttribute('position').count;
    geometry.dispose(); second.hardParts[index]?.dispose();
  });
  expect(vertices).toBeGreaterThan(3);
});
