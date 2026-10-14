import { expect, it } from 'vitest';
import * as THREE from 'three';
import puffs from '../src/shards/driftwood-isle/data/cumulusPuffs.json' with { type: 'json' };
import { cumulusPuffs } from '../src/shards/driftwood-isle/generators/cumulus';
import { FacetedSky } from '../src/shards/driftwood-isle/runtime/looks/facetedSky';
import { MIDDAY_SKY } from '../src/shards/driftwood-isle/look/stylizedSky';

it('keeps the baked cumulus rows in step with their generator', () => {
  expect(puffs).toEqual(cumulusPuffs());
});

it('instances one icosahedron per puff row and refuses malformed rows', () => {
  const material = new THREE.MeshBasicMaterial();
  const looks = { dome: material, clouds: material, setParam: (): void => undefined };
  const geo = new FacetedSky(new THREE.Vector3(0, 1, 0), MIDDAY_SKY, puffs).build(looks).clouds.geometry;
  if (!(geo instanceof THREE.InstancedBufferGeometry)) throw new Error('the cumulus is not instanced');
  expect(geo.instanceCount).toBe(puffs.length);
  expect(geo.getAttribute('aPuff').count).toBe(puffs.length);
  expect(geo.getAttribute('aLump').count).toBe(puffs.length);
  expect(geo.getAttribute('position').count).toBe(240);
  expect(() => new FacetedSky(new THREE.Vector3(0, 1, 0), MIDDAY_SKY, [[1, 2, 3]]).build(looks)).toThrow('cumulus rows');
});
