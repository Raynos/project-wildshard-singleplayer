import { BufferAttribute, BufferGeometry, Mesh } from 'three';
import { expect, it } from 'vitest';
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
  expect(yields).toBe(3);
  expect(shape(sliced)).toEqual(shape(eager));
  expect(sliced.tris).toBe(eager.tris);
  expect(sliced.colliders).toEqual(eager.colliders);
});
