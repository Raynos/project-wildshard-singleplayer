import { expect, test } from 'vitest';
import * as THREE from 'three';
import * as v from 'valibot';
import { Scope } from '../src/engine/app/scope';
import { installDeclaredProps } from '../src/engine/world/declaredProps';
import { staticGlb } from '../src/sdk/bake/glb';
import { splatSurface, withSplatSurface } from '../src/game/shardfile/clientSplatTerrain';
import { SplatTerrainSchema, checkTileMaterialNames, splatTextureRefs, type SplatTerrain } from '@wildshard/format/splatTerrain';

// Tile streaming P1 (G227): a splat ground joins a shard's props tiles beside props that draw with the family (Pine's timber
// declares no named materials). The splat-named primitive draws with the splat material; every other name with the family.
const h = (n: number): string => n.toString(16).padStart(64, '0');
const SPLAT: SplatTerrain = v.parse(SplatTerrainSchema, {
  material: 'pine.ground',
  layers: { colour: [h(1), h(2), h(3), h(4)], normal: [h(5), h(6), h(7), h(8)], arm: [h(9), h(10), h(11), h(12)] },
  tints: [[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]], boreal: null,
});
function layer(): THREE.CompressedTexture {
  return new THREE.CompressedTexture([{ data: new Uint8Array(16), width: 4, height: 4 }], 4, 4, THREE.RGBA_ASTC_4x4_Format);
}
function primitive(name: string, channels: boolean): Parameters<typeof staticGlb>[0][number] {
  const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 0, 1], 3)).setIndex([0, 2, 1]);
  if (channels) { g.setAttribute('splat', new THREE.Float32BufferAttribute(Array.from({ length: 12 }, () => 0.25), 4)); g.setAttribute('canopy', new THREE.Float32BufferAttribute([0, 0, 0], 1)); }
  const material = new THREE.MeshStandardMaterial(); material.name = name;
  return { geometry: g, material, castShadow: false, ...(channels ? { customAttributes: { _SPLAT: 'splat', _CANOPY: 'canopy' } } : {}) };
}

test('the splat ground and family-drawn timber share one props tile', async () => {
  const glb = staticGlb([primitive('pine.ground', true), primitive('planks', false)], 'tile');
  expect(() => { checkTileMaterialNames(undefined, SPLAT, glb); }).not.toThrow();
  expect(() => { checkTileMaterialNames({}, SPLAT, glb); }).toThrow('planks');
  const scope = new Scope('test.splat-family'), scene = new THREE.Group(), family = new THREE.MeshStandardMaterial();
  try {
    const textures = new Map(splatTextureRefs(SPLAT).map(ref => [ref, layer()]));
    const surface = splatSurface(SPLAT, { scope, texture: ref => { const t = textures.get(ref); if (t === undefined) throw new Error('no layer'); return t; } });
    const installed = await installDeclaredProps({ family: 'pbr', tiles: [{ lod: 0, x: 0, z: 0, file: h(99) }], panels: [], models: [], far: null, textures: [] }, {
      scene, scope, assets: new Map([[h(99), glb]]), materials: new Map([['pbr', family]]),
      surfaces: withSplatSurface({ name: SPLAT.material, binding: surface.binding }, null),
    });
    const drawn: unknown[] = []; installed.tiles.get('0/0/0')?.traverse(o => { if (o instanceof THREE.Mesh) { const material: unknown = o.material; drawn.push(material); } });
    expect(drawn).toHaveLength(2);
    expect(drawn).toContain(surface.material);
    expect(drawn.filter(m => m !== surface.material)).toHaveLength(1);
  } finally { scope.dispose(); }
});
