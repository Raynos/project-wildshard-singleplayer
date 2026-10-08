// oxlint-disable-next-line import/no-nodejs-modules -- The offline assembly consumes the committed native authority.
import { readFileSync } from 'node:fs';
import { BufferAttribute, BufferGeometry, Float32BufferAttribute, Material, Mesh, MeshStandardMaterial } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import { parseGlb } from '@wildshard/sdk/assets';
import { contentHash } from '@wildshard/sdk/project';
import { bakeNalatiWorldRows } from '../scripts/bake/nalatiWorldRows';
import { bakeNalatiGround, nalatiGroundSource } from '../scripts/bake/nalatiGroundSource';

const native = readFileSync(new URL('../public/assets/baked/nalati-grasslands/terrain.bin', import.meta.url));

describe('Nalati combined world rows', () => {
  it('packs native ground plus static props once per address, preserving channels and exact critical source bytes', async () => {
    const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([-249, 140, -249, -248, 140, -249, -249, 141, -248], 3)).setIndex([0, 1, 2]);
    const material = new MeshStandardMaterial(); material.name = 'nalati.static';
    try {
      const staticTiles = [{ lod: 0 as const, x: 0, z: 0, primitives: [{ geometry, material }] }];
      const first = bakeNalatiWorldRows(native, staticTiles, 'nalati.ground'), second = bakeNalatiWorldRows(native, staticTiles, 'nalati.ground');
      expect(first.files).toEqual(second.files); expect(first.tiles).toEqual(second.tiles); expect(first.props).toEqual(second.props);
      expect([...first.assets].map(([hash, bytes]) => [hash, contentHash(bytes)])).toEqual([...second.assets].map(([hash, bytes]) => [hash, contentHash(bytes)]));
      expect(first.tiles).toHaveLength(80); expect(first.props.tiles).toHaveLength(80);
      expect(new Set(first.props.tiles.map(row => `${row.lod}/${row.x}/${row.z}`)).size).toBe(80);
      expect(first.props.family).toBe('nalati.ground');
      const nativeHash = contentHash(native); expect(first.critical).toEqual([nativeHash]);
      expect(first.nativeGround).toEqual({ version: 1, file: nativeHash }); expect(second.nativeGround).toEqual(first.nativeGround);
      const retainedNative = first.assets.get(nativeHash); if (retainedNative === undefined) throw new Error('Missing native authority');
      expect(contentHash(retainedNative)).toBe(nativeHash); expect(retainedNative.length).toBe(native.length);
      expect(first.files.find(row => row.hash === nativeHash)).toEqual({ hash: nativeHash, kind: 'binary', compressed: native.length, decoded: native.length, gpu: 0, triangles: 0, draws: 0, dependencies: [], critical: true });
      const tile = first.tiles.find(row => row.lod === 0 && row.x === 0 && row.z === 0), model = first.props.tiles.find(row => row.lod === 0 && row.x === 0 && row.z === 0);
      if (tile === undefined || model === undefined) throw new Error('Missing combined tile');
      expect(tile.files).toEqual([model.file]); expect(tile.bounds.max[1]).toBe(141);
      expect(tile.draws).toBe(3); // Ground + prop colour draws and the prop's retained shadow draw.
      const bytes = first.assets.get(model.file); if (bytes === undefined) throw new Error('Missing combined bytes');
      expect(tile).toMatchObject({ compressed: bytes.length, ...parseGlb(bytes) });
      const loaded = await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, ''); let ground = 0, props = 0;
      loaded.scene.traverse(object => {
        if (!(object instanceof Mesh)) return;
        const loadedGeometry: unknown = object.geometry, loadedMaterial: unknown = object.material;
        if (!(loadedGeometry instanceof BufferGeometry) || !(loadedMaterial instanceof Material)) throw new Error('Malformed combined mesh');
        if (loadedMaterial.name === 'nalati.ground') {
          for (const channel of ['_surf', '_rdir', '_zone']) expect(loadedGeometry.getAttribute(channel)).toBeInstanceOf(BufferAttribute);
          ground++;
        } else {
          const position: unknown = loadedGeometry.getAttribute('position');
          if (!(position instanceof BufferAttribute)) throw new Error('Missing static positions');
          expect(loadedMaterial.name).toBe('nalati.static'); expect(position.count).toBe(3); props++;
        }
        loadedGeometry.dispose(); loadedMaterial.dispose();
      });
      expect({ ground, props }).toEqual({ ground: 1, props: 1 });
      expect(geometry.getAttribute('position').count).toBe(3); expect(material.name).toBe('nalati.static');
    } finally { geometry.dispose(); material.dispose(); }
  }, 120_000); // Complete offline world rows share CPU in the parallel gate; elapsed time is not a verdict.

  it('refuses competing addresses and unclipped props before emitting an ambiguous product', () => {
    const source = nalatiGroundSource(native), geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 1], 3)).setIndex([0, 1, 2]);
    const material = new MeshStandardMaterial(), entry = { lod: 0 as const, x: 0, z: 0, primitives: [{ geometry, material }] };
    try {
      expect(() => bakeNalatiGround(source, [entry, entry])).toThrow('unique');
      expect(() => bakeNalatiGround(source, [entry])).toThrow('clipped to their final tile address');
    } finally { geometry.dispose(); material.dispose(); }
  });
});
