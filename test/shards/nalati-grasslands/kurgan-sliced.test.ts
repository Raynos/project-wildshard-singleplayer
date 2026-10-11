import { BufferAttribute, BufferGeometry, Mesh } from 'three';
import { expect, it, vi } from 'vitest';
import { KurganDungeon } from '../../../src/shards/nalati-grasslands/world/KurganDungeon';

/** every attribute's bytes of the interior mesh, and the group's child order (SF67) */
function shape(dungeon: KurganDungeon): { children: string[]; interior: Record<string, number[]> } {
  const interior = dungeon.group.getObjectByName('kurgan-interior');
  const geometry: unknown = interior instanceof Mesh ? interior.geometry : null;
  if (!(geometry instanceof BufferGeometry)) throw new Error('Missing static interior');
  const attributes: Record<string, number[]> = {};
  for (const name of ['position', 'normal', 'color']) {
    const attribute: unknown = geometry.getAttribute(name);
    if (!(attribute instanceof BufferAttribute)) throw new Error(`Missing ${name}`);
    attributes[name] = Array.from(attribute.array);
  }
  return { children: dungeon.group.children.map((child) => `${child.type}:${child.name}`), interior: attributes };
}

it('builds the same static interior a task apart per part as the eager build (SF67)', async () => {
  const eager = new KurganDungeon().build();
  const sliced = new KurganDungeon().build(true);
  let yields = 0;
  await sliced.buildStaticSliced(() => { yields++; return Promise.resolve(); });
  expect(yields).toBeGreaterThan(7); // finishing now also pauses within the vertex shading and bounds scans
  expect(shape(sliced)).toEqual(shape(eager));
  expect(sliced.tris).toBe(eager.tris);
  expect(sliced.colliders).toEqual(eager.colliders);
});

it('builds the same lazy boot a task apart per movable piece as the one-task lazy build (SF67)', async () => {
  const eager = new KurganDungeon().build(true);
  let yields = 0;
  const sliced = await new KurganDungeon().buildSliced(true, () => { yields++; return Promise.resolve(); });
  expect(yields).toBe(6);
  const kids = (d: KurganDungeon): string[] => d.group.children.map((child) => `${child.type}:${child.name}:${child.visible}`);
  expect(kids(sliced)).toEqual(kids(eager));
  const bytes = (d: KurganDungeon): number[][] => d.group.children.flatMap((child) => {
    const geometry: unknown = child instanceof Mesh ? child.geometry : null;
    if (!(geometry instanceof BufferGeometry)) return [];
    return ['position', 'normal', 'color'].flatMap((name) => { const a: unknown = geometry.getAttribute(name); return a instanceof BufferAttribute ? [Array.from(a.array)] : []; });
  });
  expect(bytes(sliced)).toEqual(bytes(eager));
  expect(sliced.colliders).toEqual(eager.colliders);
  expect(sliced.tris).toBe(eager.tris);
  await sliced.buildStaticSliced(() => Promise.resolve());
  expect(shape(sliced)).toEqual(shape(new KurganDungeon().build()));
});

it('does not rescan the large static mesh synchronously before AO reads its sliced bounds', async () => {
  const dungeon = new KurganDungeon().build(true);
  const boxes = vi.spyOn(BufferGeometry.prototype, 'computeBoundingBox');
  const spheres = vi.spyOn(BufferGeometry.prototype, 'computeBoundingSphere');
  try {
    await dungeon.buildStaticSliced(() => Promise.resolve());
    const large = (geometry: unknown): boolean => {
      const position: unknown = geometry instanceof BufferGeometry ? geometry.getAttribute('position') : null;
      return position instanceof BufferAttribute && position.count >= 32768;
    };
    expect(boxes.mock.contexts.filter(large)).toEqual([]);
    expect(spheres.mock.contexts.filter(large)).toEqual([]);
    const interior = dungeon.group.getObjectByName('kurgan-interior');
    if (!(interior instanceof Mesh) || !(interior.geometry instanceof BufferGeometry)) throw new Error('Missing static interior');
    const shipping = interior.geometry.clone();
    boxes.mockRestore(); spheres.mockRestore();
    shipping.computeBoundingBox(); shipping.computeBoundingSphere();
    expect(interior.geometry.boundingBox).toEqual(shipping.boundingBox);
    expect(interior.geometry.boundingSphere).toEqual(shipping.boundingSphere);
    shipping.dispose();
  } finally { boxes.mockRestore(); spheres.mockRestore(); }
});
