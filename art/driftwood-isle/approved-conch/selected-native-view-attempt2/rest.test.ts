import { expect, test } from 'vitest';
import { Bone } from 'three';
import { readFileSync } from 'node:fs';
import { installChannelPrograms, numericCreaturePose } from '../../../../src/game/plugin/channelPrograms';
import { createConchSelectedViewPreviewOutput, createConchSelectedViewPreviewSource } from './conchSelectedViewPreview';
import poses from './poses.json' with { type: 'json' };
import metadata from '../selected-native-normals/native/metadata.json' with { type: 'json' };

test('rest diagnostic admits through unchanged numeric pose schema and changes rotations only', () => {
  expect(() => numericCreaturePose(poses)).not.toThrow();
  const body = metadata.bodies[0];
  if (body === undefined) throw new Error('Missing body');
  const bones = body.bones.map(def => { const bone = new Bone(); bone.name = def.name;
    const parent = body.bones.find(row => row.name === def.parent);
    bone.position.set((def.pos[0] ?? 0) - (parent?.pos[0] ?? 0), (def.pos[1] ?? 0) - (parent?.pos[1] ?? 0), (def.pos[2] ?? 0) - (parent?.pos[2] ?? 0)); return bone; });
  const positions = bones.map(b => b.position.toArray());
  const lane = installChannelPrograms(poses.programs, 'creature.pose', new Map(bones.map(b => [`joint.${b.name}`, b])));
  for (const time of [0, 1, 9, 100]) { bones.forEach(b => b.rotation.set(.3, -.2, .8)); lane.evaluate({ time, delta: .016, values: {} });
    expect(bones.map(b => b.rotation.toArray().slice(0, 3))).toEqual(bones.map(() => [0, 0, 0]));
    expect(bones.map(b => b.position.toArray())).toEqual(positions); expect(bones.map(b => b.scale.toArray())).toEqual(bones.map(() => [1, 1, 1])); }
  expect(poses.programs).toHaveLength(45); expect(poses.programs.every(p => p.reads.length === 0)).toBe(true);
});

test('isolated product preserves exact normal-bearing body and uses only constant rest pose', () => {
  const source = createConchSelectedViewPreviewSource();
  expect(source.runtime?.spawns?.actors?.map(row => row.kind)).toEqual(['conch-duelist']);
  const output = createConchSelectedViewPreviewOutput(metadata);
  const pose = output.namedFiles?.find(row => row.name === 'poses/conch-duelist.json');
  expect(pose).toBeDefined();
  expect(readFileSync('art/driftwood-isle/approved-conch/selected-native-view/conchSelectedViewPreview.ts', 'utf8')).not.toContain('conchMotion5Clips');
  expect(source.encounters).toEqual([]); expect(source.ledger).toEqual([]);
});

test('unchanged real facet stage demonstrably rewrites normals and colors but preserves positions and skin', async () => {
  const { packedCreatureBodies } = await import('../../../../src/game/plugin/geometry');
  const { mergeAnimalGeometry } = await import('../../../../src/engine/models/animalGeometry');
  const { facetGeometry } = await import('../../../../src/engine/entities/lowpoly');
  const payload = new Uint8Array(readFileSync('art/driftwood-isle/approved-conch/selected-native-normals/native/payload.bin'));
  const library = packedCreatureBodies(metadata, undefined, () => Promise.resolve(payload));
  await library.preload(); const body = library.copy('conch-duelist', 'conch-duelist');
  const merged = mergeAnimalGeometry(body.furParts, body.hardParts, body.eyeParts);
  const snapshot = Object.fromEntries(['position', 'normal', 'color', 'skinIndex', 'skinWeight', 'furLen'].map(name => [name, Array.from(merged.getAttribute(name).array)]));
  const faceted = facetGeometry(merged);
  for (const name of ['position', 'skinIndex', 'skinWeight', 'furLen']) expect(Array.from(faceted.getAttribute(name).array)).toEqual(snapshot[name]);
  expect(Array.from(faceted.getAttribute('normal').array)).not.toEqual(snapshot['normal']);
  expect(Array.from(faceted.getAttribute('color').array)).not.toEqual(snapshot['color']);
  faceted.dispose();
});
