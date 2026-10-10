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
  expect(yields).toBe(7); // the chamber (two parts), the dromos, the grave goods, the finish, the bake in thirds
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
