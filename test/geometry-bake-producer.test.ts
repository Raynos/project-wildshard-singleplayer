import { expect, test } from 'vitest';
import { BufferAttribute, BufferGeometry } from 'three';
import { Rng } from '../src/engine/core/rng';
import { addGeometryBake, bakedGeometry, encodeGeometryBake, recordGeometryBake } from '../src/engine/world/geometryBake';

test('an authored recorder replaces a retired builder and releases its borrowed table', () => {
  const rng = new Rng(7), recorder = recordGeometryBake((id, _inputs, stream) => {
    if (id !== 'fixture/required' || stream === null) return null;
    return new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array([stream.next(), 0, 0]), 3));
  });
  const missing = (): never => { throw new Error('Required geometry missing'); };
  try {
    bakedGeometry('fixture/required', [1], rng, missing).dispose();
    let delegated = false;
    bakedGeometry('fixture/ordinary', [], null, () => { delegated = true; return new BufferGeometry(); }).dispose();
    expect(delegated).toBe(true);
  } finally { recorder.stop(); }
  const bytes = encodeGeometryBake(recorder.entries), release = addGeometryBake(Uint8Array.from(bytes).buffer), restored = new Rng(7);
  try {
    const geometry = bakedGeometry('fixture/required', [1], restored, missing);
    expect(geometry.getAttribute('position').getX(0)).toBeGreaterThan(0);
    expect(restored.snapshot()).toEqual(rng.snapshot());
    geometry.dispose();
  } finally { release(); }
  expect(() => bakedGeometry('fixture/required', [1], new Rng(7), missing)).toThrow('Required geometry missing');
  const ordinary = recordGeometryBake();
  try { bakedGeometry('fixture/default', [], null, () => new BufferGeometry()).dispose(); expect(ordinary.entries.size).toBeGreaterThan(0); }
  finally { ordinary.stop(); }
});
