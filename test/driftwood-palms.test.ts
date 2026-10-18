// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { foliageTransport } from '../src/shards/driftwood-isle/generators/hibiscusTransport';
import { decodePalmWorld } from '../src/shards/driftwood-isle/generators/foliageGeometry';
import { palm } from '../src/shards/driftwood-isle/generators/foliageModels';
import { palmGeometry } from '../src/shards/driftwood-isle/generators/palm';
import { Rng } from '../src/engine/core/rng';
import { seedOf } from '../src/engine/models/model';


it('owns compacted palm channels independently while retaining full picking bounds and refusing corrupt data', () => {
  const shape = palmGeometry(palm.defaults, new Rng(seedOf(palm))), vertices = shape.getAttribute('position').count;
  const transport = foliageTransport(shape, [shape], {vertices, indices: 0, output: 3, runs: [{start: 0, count: 3}]}, 0x314d4c50, ['position', 'color', 'sway']);
  const {geometry, boxes} = decodePalmWorld(transport, 1);
  try {
    const position = geometry.getAttribute('position'), colour = geometry.getAttribute('color');
    expect(position.count).toBeLessThan(vertices);
    expect(geometry.getAttribute('aSway').count).toBe(position.count);
    expect(position.array.buffer).not.toBe(transport.buffer);
    expect(colour.array.buffer).not.toBe(position.array.buffer);
    expect(boxes.buffer).not.toBe(position.array.buffer);
    const bounds = shape.boundingBox;
    if (bounds === null) throw new Error('Original bounds missing');
    expect([...boxes]).toEqual([...bounds.min, ...bounds.max].map(Math.fround));
    expect(() => decodePalmWorld(transport, 2)).toThrow('topology');
    expect(() => decodePalmWorld(transport.subarray(0, -4), 1)).toThrow('topology');
    new DataView(transport.buffer).setFloat32(16 + 24, Number.NaN, true);
    expect(() => decodePalmWorld(transport, 1)).toThrow('Nonfinite');
  } finally { geometry.dispose(); shape.dispose(); }
});

