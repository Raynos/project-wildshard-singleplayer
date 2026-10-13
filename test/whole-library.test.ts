import { expect, it } from 'vitest';
import { BufferGeometry, Float32BufferAttribute, MeshStandardMaterial } from 'three';
import { PropsSchema, validatePropsReferences } from '../src/format/props';
import * as v from 'valibot';
import { emptyShardfile } from '../src/sdk/author';
import { parseShardfile } from '../src/sdk/shardfile';
import { contentHash } from '../src/sdk/project';
import { parseGlb } from '../src/sdk/assets';
import { staticGlb } from '../src/sdk/bake/glb';
import { runtimeBoundWorldFiles, withoutRuntimeRows } from '../src/game/plugin/headless';

it('keeps absent whole-library declarations unchanged and strips only explicitly bound GLBs', () => {
  const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 0, 1], 3));
  const bytes = staticGlb([{ geometry, material: new MeshStandardMaterial() }]), hash = contentHash(bytes);
  const props = { version: 1 as const, family: 'toon', tiles: [], panels: [], models: [], far: null, textures: [], colliders: [] };
  expect(v.parse(PropsSchema, props)).toEqual(props);
  const base = emptyShardfile({ slug: 'whole-library', name: 'Whole Library', author: 'test', revision: 1, seed: 0 });
  const source = parseShardfile({ ...base, props: { ...props, wholeLibrary: [hash] }, files: [{ hash, kind: 'glb', compressed: bytes.length, ...parseGlb(bytes), dependencies: [], critical: false }], library: [hash], runtime: { entry: 'runtime/index.ts', binds: ['props'] } });
  if (source.props === null) throw new Error('Missing declared props');
  validatePropsReferences(source.props, source);
  expect(runtimeBoundWorldFiles(source)).toEqual(new Set([hash]));
  const stripped = withoutRuntimeRows(source);
  expect(stripped.files).toEqual([]); expect(stripped.library).toEqual([]);
  expect(stripped.props?.wholeLibrary).toBeUndefined();
  expect(() => validatePropsReferences(source.props ?? props, { ...source, library: [] })).toThrow('Whole geometry must belong to the library');
  expect(() => validatePropsReferences(source.props ?? props, { ...source, files: [{ hash, kind: 'json', dependencies: [] }] })).toThrow('admitted GLB');
  expect(() => v.parse(PropsSchema, { ...props, wholeLibrary: [hash, hash] })).toThrow('unique whole library');
});
