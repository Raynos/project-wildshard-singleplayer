import { expect, test } from 'vitest';
import { BoxGeometry, BufferAttribute, MeshBasicMaterial, type BufferGeometry } from 'three';
import baseline from './fixtures/nine-jian-fallback.json' with { type: 'json' };
import { output } from '../src/shards/nine-dragon-stack/generators/output';
import { jianSword } from '../src/shards/nine-dragon-stack/world/jian';

const sources = {
  file: (): Promise<Uint8Array> => {
    const row = output.namedFiles.find(file => file.name === 'weapons/jian-fallback.json');
    const bytes = row === undefined ? undefined : output.assets.get(row.hash);
    if (bytes === undefined) throw new Error('Missing named Jian fallback');
    return Promise.resolve(bytes);
  },
  material: () => new MeshBasicMaterial(),
  guard: (): Promise<BufferGeometry> => Promise.reject(new Error('No guard file')),
};

async function channels(geometry: BufferGeometry): Promise<unknown> {
  const hash = async (array: BufferAttribute['array']): Promise<string> => {
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes)));
    return Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
  };
  return { attributes: Object.fromEntries(await Promise.all(Object.entries(geometry.attributes).map(async ([name, attr]) => {
    if (!(attr instanceof BufferAttribute)) throw new Error('Expected ordinary geometry buffers');
    return [name, { type: attr.array.constructor.name, size: attr.itemSize, normalized: attr.normalized, count: attr.count, hash: await hash(attr.array) }] as const;
  }))), index: geometry.index === null ? null : { type: geometry.index.array.constructor.name, count: geometry.index.count, hash: await hash(geometry.index.array) } };
}

// Captured from world/jian.ts at 5c6e5ff49 before deleting the live geometry author.
test('static Jian fallback preserves its original geometry and solved pose', async () => {
  const sword = await jianSword(sources), rig = sword.rig;
  if (rig?.left === undefined || rig.extras?.[0] === undefined || sword.moves === undefined) throw new Error('Incomplete static Jian');
  const result = {
    sword: await channels(rig.sword), arms: await channels(rig.arms), guard: await channels(rig.extras[0].geometry), gauntlet: await channels(rig.left.geometry),
    tipY: rig.tipY, baseY: rig.baseY, rest: { t: sword.moves.rest.t, pos: { x: sword.moves.rest.pos.x, y: sword.moves.rest.pos.y, z: sword.moves.rest.pos.z }, q: sword.moves.rest.q.toArray() }, wrist: { x: rig.left.pos.x, y: rig.left.pos.y, z: rig.left.pos.z }, armQ: rig.left.q.toArray(), framing: sword.framing, portraitPullX: sword.portraitPullX,
  };
  expect(result).toEqual(baseline);
});

test('an available TRELLIS guard retains its original lift', async () => {
  const source = new BoxGeometry(1, 2, 3), expected = source.clone().translate(0, 0.2, 0);
  const sword = await jianSword({ ...sources, guard: () => Promise.resolve(source) }), guard = sword.rig?.extras?.[0];
  if (guard === undefined) throw new Error('Missing loaded TRELLIS guard');
  expect(await channels(guard.geometry)).toEqual(await channels(expected));
});
