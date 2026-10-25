// oxlint-disable-next-line import/no-nodejs-modules -- Own and remove the isolated painter fixture.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine the fixture beneath the repository's tmp directory.
import { resolve } from 'node:path';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { expect, test } from 'vitest';
import { MapAssembly } from '../scripts/map-geometry.mjs';
import { paintDataMap } from '../scripts/bake-data-maps.mjs';

// No scene or pack file is published. The normal painter must read both from
// this invocation's owned values, and keep file admission strict otherwise.
test('owned scene/pack bytes paint without files while undeclared fallback refuses', async () => {
  mkdirSync('tmp', { recursive: true });
  const root = mkdtempSync(resolve('tmp', 'map-owned-')), dir = resolve(root, 'src/shards/fixture');
  const assembly = new MapAssembly(), geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([0, 4, 0, 0, 4, 20, 20, 4, 0], 3));
  assembly.add('floor', geometry);
  try {
    mkdirSync(resolve(dir, 'look'), { recursive: true });
    writeFileSync(resolve(dir, 'look/map.json'), JSON.stringify({ why: 'owned scene fixture', inputs: [],
      style: { kind: 'ground', void: 'transparent', classes: [{ match: '#737373', fill: '#cccccc' }] },
      painter: { version: 1, scenes: {
        packs: [{ file: 'scene.bin', rows: { file: 'scene.json', path: ['pack'] }, names: ['names'], deflated: true }],
        recipes: [{ file: 'scene.json', path: ['scene'] }],
      } } }));
    const encoded = assembly.encode(), sources = new Map([['scene.json', encoded.json], ['scene.bin', encoded.binary]]);
    const result = await paintDataMap(root, 'fixture', { sources });
    expect(result.raster.triangles).toBe(1);
    expect(result.raster.height.some(height => height === 4 * 65536)).toBe(true);
    const image = readFileSync(resolve(root, 'public/assets/fixture/map/top.webp'));
    const repeated = await paintDataMap(root, 'fixture', { sources });
    expect(readFileSync(resolve(root, 'public/assets/fixture/map/top.webp'))).toEqual(image);
    expect(repeated.stamp.pixelHash).toBe(result.stamp.pixelHash);
    await expect(paintDataMap(root, 'fixture', { sources: new Map([['scene.json', encoded.json]]) }))
      .rejects.toThrow('undeclared map input scene.bin');
    await expect(paintDataMap(root, 'fixture')).rejects.toThrow('undeclared map input scene.json');
  } finally { geometry.dispose(); rmSync(root, { recursive: true, force: true }); }
});
