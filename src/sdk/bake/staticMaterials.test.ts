import { expect, test, vi } from 'vitest';
import type { GraphIr } from '@wildshard/format/materialGraph';
import { StaticMaterialCatalogue } from './staticMaterials';
import { bakeRawColourPixels } from './rawTexture';
import type { WorldMaterial } from './world';

const graph: GraphIr = { version: 1, kind: 'material', model: 'unlit', effectState: { fog: false },
  nodes: { picture: { op: 'meshMap', name: 'colourOrVertex' }, rgb: { op: 'swizzle', in: ['picture'], mask: 'xyz' } },
  stages: { surface: { colour: 'rgb' } } };
function poster(): WorldMaterial {
  return { name: 'Poster', id: 'poster', colour: [1, 1, 1, 1], metalness: 0, roughness: 1, emissive: [0, 0, 0],
    alpha: 'OPAQUE', alphaCutoff: 0, doubleSided: false, normalScale: 1, occlusion: 1,
    maps: { colour: { image: 'poster', wrapS: 33071, wrapT: 33071, minFilter: 9987, magFilter: 9729, width: 1, height: 1 },
      normal: null, metallicRoughness: null, occlusion: null, emissive: null } };
}
test('opaque graph pictures preserve the complete sRGB colour slot and sampler', () => {
  const bytes = bakeRawColourPixels({ width: 1, height: 1, pixels: new Uint8ClampedArray([18, 24, 43, 255]) });
  const resolve = vi.fn(() => bytes), source = poster();
  const catalogue = new StaticMaterialCatalogue([source], { poster: { family: 'graph', graph } }, resolve);
  try {
    const snapshot = catalogue.snapshot(), binding = snapshot.materials['Poster'];
    expect(resolve).toHaveBeenCalledExactlyOnceWith(source.maps.colour, 'srgb');
    expect(binding?.colour).toMatchObject({ wrapS: 33071, wrapT: 33071, minFilter: 9987, magFilter: 9729 });
    expect([...snapshot.textures.values()]).toEqual([bytes]);
    expect(snapshot.textures.values().next().value).not.toBe(bytes);
  } finally { catalogue.dispose(); }
});
test.each(['factor', 'normal', 'emissive', 'alpha', 'implicit-map'] as const)('graph transport refuses unbound %s semantics', kind => {
  const source = poster();
  if (kind === 'factor') source.colour[0] = 0.5;
  if (kind === 'normal') source.maps.normal = source.maps.colour;
  if (kind === 'emissive') source.emissive[0] = 0.5;
  if (kind === 'alpha') source.alpha = 'BLEND';
  const selected: GraphIr = kind === 'implicit-map' ? { ...graph, nodes: { picture: { op: 'meshMap' }, rgb: graph.nodes['rgb'] ?? { op: 'const', value: 1 } } } : graph;
  expect(() => new StaticMaterialCatalogue([source], { poster: { family: 'graph', graph: selected } }, () => { throw new Error('Must refuse before texture intake'); }))
    .toThrow('explicit factor-binding adapter');
});
