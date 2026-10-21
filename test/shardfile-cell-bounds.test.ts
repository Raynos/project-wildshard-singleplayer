import { expect, test } from 'vitest';
import { assertCellBounds } from '../src/format/cellBounds';
import { validateOutputSection } from '../src/format/outputIndex';
import { CellBoundsSchema } from '../src/format/shardSections';
import * as v from 'valibot';
import { BoxGeometry, MeshBasicMaterial } from 'three';
import { emptyShardfile } from '../src/sdk/author';
import { staticGlb } from '../src/sdk/bake/glb';
import { validatePropDrawBounds } from '../src/format/product';

const box = { min: [-250, -250, -250], max: [250, 250, 250] };
test('every section refuses a nested spatial extent outside the exact inclusive cell envelope', () => {
  expect(() => assertCellBounds({ nested: [{ bounds: box }] }, 'custom/view')).not.toThrow();
  for (const section of ['world/tiles', 'world/scenes', 'client/plan', 'custom/view']) {
    expect(() => validateOutputSection(section, { nested: [{ bounds: { ...box, max: [250.001, 1, 1] } }] })).toThrow('Out-of-cell bounds');
  }
  expect(() => assertCellBounds({ nested: { bounds: { x0: -250, x1: 251, z0: -1, z1: 1 } } })).toThrow('Out-of-cell bounds');
});

test('voxel grid padding and model-local culling spheres retain their distinct coordinate contracts', () => {
  expect(() => assertCellBounds({ navigation: { bounds: [-250, -1, -250, 262, 10, 262] }, steps: [{ bounds: [{ part: 'shore', sphere: { center: [0, 0, 0], radius: 277 } }] }] })).not.toThrow();
  expect(v.safeParse(CellBoundsSchema, { ...box, max: [250.001, 250, 250] }).success).toBe(false);
});

test('a bounds fence never invokes an authored accessor', () => {
  let calls = 0;
  const bad = Object.defineProperty({}, 'bounds', { enumerable: true, get() { calls++; return box; } });
  expect(() => assertCellBounds(bad)).toThrow('plain JSON'); expect(calls).toBe(0);
});

test('placed prop XZ bytes cannot escape through omitted or forged draw bounds', () => {
  const source = emptyShardfile({ slug: 'bounds-test', name: 'Bounds', author: 'Test', revision: 1, seed: 1 });
  const geometry = new BoxGeometry(2, 2, 2), material = new MeshBasicMaterial(), file = 'a'.repeat(64);
  source.props = { version: 1, family: 'bounds-test', tiles: [], panels: [{ id: 'edge', file, visible: true }], models: [], far: null, textures: [], colliders: [] };
  try {
    geometry.translate(249, 0, 0);
    expect(() => validatePropDrawBounds(source, new Map([[file, staticGlb([{ geometry, material }])]]))).not.toThrow();
    geometry.translate(0.01, 0, 0);
    expect(() => validatePropDrawBounds(source, new Map([[file, staticGlb([{ geometry, material }])]]))).toThrow('Prop exceeds cell draw bounds');
    geometry.translate(-0.01, 274, 0);
    expect(() => validatePropDrawBounds(source, new Map([[file, staticGlb([{ geometry, material }])]]))).not.toThrow();
    geometry.translate(0.01, 0, 0);
    source.props.overhang = 1;
    expect(() => validatePropDrawBounds(source, new Map([[file, staticGlb([{ geometry, material }])]]))).toThrow('Prop exceeds cell draw bounds');
  } finally { geometry.dispose(); material.dispose(); }
});
