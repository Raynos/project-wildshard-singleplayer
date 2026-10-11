// oxlint-disable-next-line import/no-nodejs-modules -- Audit the retained authoring closure from this isolated source tree.
import process from 'node:process';
import { expect, it } from 'vitest';
import { bakeNavigation } from '@wildshard/sdk/bake/navigation';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { parseNavmesh } from '@wildshard/engine/physics/navmesh';
import { auditAuthoringInputs } from '../scripts/authoring-inputs.mjs';
import { navigationSoup, NAVIGATION_LAYERS, NAVIGATION_SETTINGS } from './fixtures/navigation-soup';

// Original scripts/bake-navmesh.mjs at 92603cc43, independently executed before extraction.
const ORIGINAL_HASHES = {"flat":"66ce3601aff30b6a9bf13a59177a3aa45c862f96e71b4010c284cf0f003da38a","hole":"049f91b2af138b8e1906289a1678f8ffdceb292a7300d4b00c255b25233ad25d","hill":"90ddb86f030ea2a10e27a9b6dcb0241cb843d86625b198510a459c29c7f270aa"};

it.each(['flat', 'hole', 'hill'] as const)('preserves original WSNM bytes and layer counts for %s terrain', kind => {
  const product = bakeNavigation(navigationSoup(kind), NAVIGATION_LAYERS, NAVIGATION_SETTINGS);
  expect(hashImmutableBytes(product.bytes)).toBe(ORIGINAL_HASHES[kind]);
  const buffer = new ArrayBuffer(product.bytes.byteLength); new Uint8Array(buffer).set(product.bytes);
  const native = parseNavmesh(buffer);
  if (native === null) throw new Error('Compiled native navigation refused');
  expect(native.layers.map(layer => layer.radius)).toEqual([expect.closeTo(0.3), expect.closeTo(0.5)]);
  expect(product.layers.every(layer => layer.polys > 0)).toBe(true);
  if (kind === 'hill') expect(product.layers.every(layer => layer.tiles > 1)).toBe(true);
});

it('routes around the authored ground hole through the real runtime reader', () => {
  const { bytes } = bakeNavigation(navigationSoup('hole'), NAVIGATION_LAYERS, NAVIGATION_SETTINGS);
  const buffer = new ArrayBuffer(bytes.byteLength); new Uint8Array(buffer).set(bytes);
  const native = parseNavmesh(buffer);
  if (native === null) throw new Error('Compiled native navigation refused');
  const from = native.closestWalkable({ x: 5, y: 0, z: 12 }, 0.3);
  const to = native.closestWalkable({ x: 19, y: 0, z: 12 }, 0.3);
  if (from === null || to === null) throw new Error('Authored route missing endpoints');
  const path = native.findPath(from, to, 0.3);
  expect(path).not.toBeNull();
  expect(path?.length).toBeGreaterThan(2);
  expect(path?.some(point => point.z < 9 || point.z > 15)).toBe(true);
});

it('keeps the CPU compiler inside the authoring-only closure without game or renderer services', () => {
  const audit = auditAuthoringInputs(process.cwd(), 'driftwood-isle', 'src/sdk/bake/navigation.ts');
  expect(audit.issues).toEqual([]);
  expect(audit.files).toEqual(['src/sdk/bake/navigation.ts']);
});
