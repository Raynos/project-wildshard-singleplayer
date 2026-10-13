import { BoxGeometry, MeshStandardMaterial } from 'three';
import { expect, it } from 'vitest';
import { CONTENT_CAPS } from '@wildshard/format/contentBounds';
import { assetCost, performanceTargetIssues } from '@wildshard/format/product';
import { emptyShardfile } from '../src/sdk/author';
import { contentHash, validateProject } from '../src/sdk/project';
import { staticGlb } from '../src/sdk/bake/glb';

function product(lod: 0 | 1) {
  const source = emptyShardfile({ slug: 'tile-caps', name: 'Tile caps', author: 'Fixture', revision: 1, seed: 1 });
  const geometry = new BoxGeometry(1, 1, 1), material = new MeshStandardMaterial();
  const bytes = staticGlb([{ geometry, material }]), hash = contentHash(bytes), cost = assetCost('glb', bytes);
  geometry.dispose(); material.dispose();
  source.files.push({ hash, kind: 'glb', compressed: bytes.length, ...cost, dependencies: [], critical: false });
  const caps = lod === 0 ? CONTENT_CAPS.l0 : CONTENT_CAPS.l1;
  source.tiles.push({ lod, x: 0, z: 0, bounds: { min: [-250, 0, -250], max: [-250 + caps.size, 1, -250 + caps.size] }, geometricError: 0,
    files: [hash], ...cost, compressed: caps.compressed + 1, triangles: caps.triangles + 1, draws: caps.draws + 1 });
  return { source, assets: new Map([[hash, bytes]]) };
}

it.each([0, 1] as const)('admits provisional L%s targets with every exact byte and cost still checked', lod => {
  const { source, assets } = product(lod);
  expect(validateProject(source, assets)).toEqual(source);
  const issues = performanceTargetIssues(source);
  expect(issues.map(issue => issue.metric)).toEqual([`tile ${lod}/0/0 download bytes`, `tile ${lod}/0/0 draws`, `tile ${lod}/0/0 triangles`]);
  expect(issues.every(issue => issue.severity === 'warning')).toBe(true);
});

it('keeps the hard total-memory refusal and immutable-byte admission', () => {
  const { source, assets } = product(0);
  source.budgets.library.resident = 1_000_000_000;
  expect(() => validateProject(source, assets)).toThrow('total exceeds envelope');
  source.budgets.library.resident = 0;
  const file = source.files[0]; if (file === undefined) throw new Error('Missing real GLB');
  const bytes = assets.get(file.hash); if (bytes === undefined) throw new Error('Missing real bytes');
  const corrupt = bytes.slice(); corrupt[0] = 0;
  expect(() => validateProject(source, new Map([[file.hash, corrupt]]))).toThrow('file hash or wire size mismatch');
  file.decoded = 0; file.gpu = 0;
  expect(() => validateProject(source, assets)).toThrow('asset cost declaration understated');
});
