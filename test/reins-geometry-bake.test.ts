import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { bakeReinsGeometry, reinPresentationRows } from '../src/sdk/bake/riderArms';
import { buildReinsRibbon, fillRein } from '../src/game/riding/reins';
import { parse } from 'valibot';
import { ReinPresentationSchema } from '../src/format/riding';
import input from '../src/shards/nalati-grasslands/data/reins.json' with { type: 'json' };

const paths = () => [1, -1].map(side => [
  new Vector3(side * 0.2, 0.1, -0.4), new Vector3(side * 0.25, -0.1, -0.8),
  new Vector3(side * 0.1, -0.5, -1), new Vector3(side * 0.12, -0.55, -1.4),
  new Vector3(side * 0.08, -0.8, -1.7), new Vector3(side * 0.06, -0.9, -2),
]);

test('the geometry-only reins bake retains native channels and detached ownership', () => {
  const rows = reinPresentationRows(input), anchors = paths(), before = anchors.map(path => path.map(point => point.toArray()));
  expect(rows).toEqual(parse(ReinPresentationSchema, input));
  const native = buildReinsRibbon(rows), geometry = bakeReinsGeometry(rows, anchors), second = bakeReinsGeometry(rows, anchors);
  try {
    anchors.forEach((path, r) => fillRein(native.pos, r, path, rows));
    expect(geometry.index?.array).toEqual(native.mesh.geometry.index?.array);
    expect(Object.keys(geometry.attributes)).toEqual(Object.keys(native.mesh.geometry.attributes));
    for (const name of Object.keys(geometry.attributes)) {
      expect(geometry.getAttribute(name).array).toEqual(native.mesh.geometry.getAttribute(name).array);
      expect(geometry.getAttribute(name).array).not.toBe(second.getAttribute(name).array);
    }
    geometry.getAttribute('position').setX(0, 99);
    expect(second.getAttribute('position').getX(0)).not.toBe(99);
    expect(anchors.map(path => path.map(point => point.toArray()))).toEqual(before);
  } finally {
    geometry.dispose(); second.dispose(); native.mesh.geometry.dispose();
    for (const material of Array.isArray(native.mesh.material) ? native.mesh.material : [native.mesh.material]) material.dispose();
  }
});

test('rein policy and anchor admission retain the native finite and bounded refusals', () => {
  for (const invalid of [{ ...input, span: 0 }, { ...input, span: 65 }, { ...input, halfWidth: 0 }, { ...input, extra: true }]) {
    expect(() => reinPresentationRows(invalid)).toThrow();
    expect(() => parse(ReinPresentationSchema, invalid)).toThrow();
  }
  const rows = reinPresentationRows(input), missing = paths().slice(0, 1), nonfinite = paths();
  nonfinite[0]?.[0]?.setX(Number.NaN);
  expect(() => bakeReinsGeometry(rows, missing)).toThrow('two finite six-anchor paths');
  expect(() => bakeReinsGeometry(rows, nonfinite)).toThrow('two finite six-anchor paths');
});
