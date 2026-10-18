import { BufferAttribute, BufferGeometry } from 'three';

/** Fixed ribbon topology; only its three position streams change in play. */
export function filamentGeometry(n: number): unknown {
  const g = new BufferGeometry(), side = new Float32Array(n * 4), index: number[] = [];
  for (let i = 0; i < n; i++) {
    side.set([-1, i / (n - 1), 1, i / (n - 1)], i * 4);
    if (i < n - 1) { const a = i * 2; index.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  }
  for (const name of ['position', 'aPrev', 'aNext']) g.setAttribute(name, new BufferAttribute(new Float32Array(n * 6), 3));
  g.setAttribute('aSide', new BufferAttribute(side, 2)); g.setIndex(index);
  const row = { ...g.toJSON(), uuid: '96d3a000-0000-4000-8000-000000000030' }; g.dispose(); return row;
}
