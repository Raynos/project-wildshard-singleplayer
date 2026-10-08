// oxlint-disable-next-line import/no-nodejs-modules -- Reuse shipped compressed texture bytes; no encode or texture-size change in this proof.
import { readFileSync } from 'node:fs';
import { BufferGeometry, Float32BufferAttribute, MeshStandardMaterial } from 'three';
import * as v from 'valibot';
import { expect, it } from 'vitest';
import { emptyShardfile } from '../src/sdk/author';
import { WorldBakeRows } from '../src/sdk/bake/worldRows';
import { staticGlb } from '../src/sdk/bake/glb';
import { contentHash } from '../src/sdk/project';
import { PropsSchema, validatePropsReferences } from '../src/game/shardfile/props';
import { SplatTerrainSchema } from '../src/game/shardfile/splatTerrain';
import { PropMaterialsSchema } from '../src/game/shardfile/propMaterials';
import { validateShardfileAssets } from '../src/game/shardfile/validate';

const colour = Uint8Array.from(readFileSync(new URL('../public/assets/gpu/tex/forrest_ground_03/diffuse_1k.phone-90ff16b6.ktx2', import.meta.url)));
const numeric = Uint8Array.from(readFileSync(new URL('../public/assets/gpu/tex/forrest_ground_03/arm_1k.phone-87e2215f.ktx2', import.meta.url)));
function fixture() {
  const rows = new WorldBakeRows(), c = rows.asset(colour, 'ktx2'), n = rows.asset(numeric, 'ktx2');
  const splat = v.parse(SplatTerrainSchema, { material: 'pine.ground', layers: {
    colour: Array.from({ length: 4 }, () => c.hash), normal: Array.from({ length: 4 }, () => n.hash), arm: Array.from({ length: 4 }, () => n.hash),
  }, tints: Array.from({ length: 4 }, () => [1, 1, 1]), boreal: null });
  for (const x of [4, 5]) {
    const px = (x - 4) * 62.5, geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([px, 0, 0, px + 1, 0, 0, px, 0, 1], 3))
      .setAttribute('splat', new Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4)).setAttribute('canopy', new Float32BufferAttribute([0, 0, 0], 1)).setIndex([0, 2, 1]);
    const material = new MeshStandardMaterial(); material.name = splat.material;
    const prop = new MeshStandardMaterial(); prop.name = 'Cabin stone';
    try {
      const bytes = staticGlb([{ geometry, material, castShadow: false, customAttributes: { _SPLAT: 'splat', _CANOPY: 'canopy' } }, { geometry, material: prop }], `pine.tile.${x}`);
      rows.tile({ lod: 0, x, z: 4, bounds: { min: [px, 0, 0], max: [px + 62.5, 0, 62.5] }, bytes, dependencies: [c.hash, n.hash] });
    } finally { geometry.dispose(); material.dispose(); prop.dispose(); }
  }
  const materials = v.parse(PropMaterialsSchema, { 'Cabin stone': { id: 'pbr' } });
  const packed = rows.finish('pbr', { materials, splat }), source = emptyShardfile({ slug: 'splat-test', name: 'Splat test', author: 'Fixture', revision: 1, seed: 1 });
  source.props = packed.props; source.tiles = packed.tiles; source.files = packed.files;
  return { source, rows, packed, materials, splat, c, n };
}
it('packs and admits splat ground beside named prop slots with byte-identical shipped compressed textures and deduplicated dependencies', () => {
  const { source, rows, packed, materials, splat, c, n } = fixture();
  expect(rows.finish('pbr', { materials, splat })).toEqual(packed);
  expect(validateShardfileAssets(source, packed.assets, contentHash).props?.splat).toEqual(splat);
  expect(packed.assets.get(c.hash)).toEqual(colour); expect(packed.assets.get(n.hash)).toEqual(numeric);
  expect(packed.files.filter(file => file.kind === 'ktx2')).toHaveLength(2);
  for (const tile of packed.tiles) expect(tile.compressed).toBe(packed.files.filter(file => tile.files.includes(file.hash) || file.kind === 'ktx2').reduce((sum, file) => sum + file.compressed, 0));
  const plain = { ...packed.props }; delete plain.splat;
  expect(Object.hasOwn(v.parse(PropsSchema, plain), 'splat')).toBe(false);
});
it('refuses a splat material also mapped as an ordinary prop and cross-role texture reuse before immutable reads', () => {
  const { source, packed, splat, c } = fixture(), props = packed.props;
  props.materials = v.parse(PropMaterialsSchema, { [splat.material]: { id: 'pbr' } });
  expect(() => validatePropsReferences(props, source)).toThrow('cannot also name');
  delete props.materials; if (props.splat === undefined) throw new Error('Missing splat');
  props.splat.layers.normal[0] = c.hash;
  expect(() => validatePropsReferences(props, source)).toThrow('cannot mix colour');
});
it('refuses a tile borrowing another tile layer dependency even when the full product still roots that texture', () => {
  const { source, packed, n } = fixture(), tile = source.props?.tiles[0];
  const file = source.files.find(row => row.hash === tile?.file); if (file === undefined) throw new Error('Missing terrain file');
  file.dependencies = file.dependencies.filter(ref => ref !== n.hash);
  expect(() => validatePropsReferences(packed.props, source)).not.toThrow();
  expect(() => validateShardfileAssets(source, packed.assets, contentHash)).toThrow('directly declare every layer');
});
it('refuses the same missing own-layer dependency in the row packer before a product can be emitted', () => {
  const { packed, splat, materials, c } = fixture(), rows = new WorldBakeRows();
  rows.asset(colour, 'ktx2'); rows.asset(numeric, 'ktx2');
  const first = packed.tiles[0], bytes = first === undefined ? undefined : packed.assets.get(first.files[0] ?? '');
  if (first === undefined || bytes === undefined) throw new Error('Missing packed tile');
  rows.tile({ lod: first.lod, x: first.x, z: first.z, bounds: first.bounds, bytes, dependencies: [c.hash] });
  expect(() => rows.finish('pbr', { materials, splat })).toThrow('directly declare every layer');
});
