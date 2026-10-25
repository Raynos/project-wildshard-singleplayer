// oxlint-disable-next-line import/no-nodejs-modules -- Compare raw source geometry with the retained native codec boundary.
import { inflateSync } from 'node:zlib';
// oxlint-disable-next-line import/no-nodejs-modules -- Bundle the defining build-only module without invoking any publisher.
import { resolve } from 'node:path';
import { BufferGeometry, Float32BufferAttribute, Matrix4 } from 'three';
import { expect, test } from 'vitest';
import { build } from 'vite';
import { MapAssembly } from '../src/sdk/bake/mapAssembly';
import { MapAssembly as PublishedMapAssembly } from '../scripts/map-geometry.mjs';
import { assertConfigBoundary } from '../src/sdk/configBoundary';

test('raw map packing retains native scene bytes, placements and independent buffer ownership', () => {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([0, 4, 0, 0, 4, 20, 20, 4, 0], 3));
  geometry.setAttribute('color', new Float32BufferAttribute([.2, .3, .4, .5, .6, .7, .8, .9, 1], 3));
  geometry.setIndex([0, 1, 2]);
  const raw = new MapAssembly(), retained = new PublishedMapAssembly();
  try {
    const poses = [new Matrix4().makeTranslation(1 / 3, 2 / 3, -1 / 7), new Matrix4().makeTranslation(3, 4, 5)];
    for (const assembly of [raw, retained]) { assembly.add('floor', geometry, poses); assembly.add('floor', geometry); assembly.add('empty', geometry, []); }
    const direct = raw.pack(), original = retained.encode();
    expect(direct.json).toEqual(original.json);
    expect(direct.binary).toEqual(new Uint8Array(inflateSync(original.binary)));
    expect(raw.inventory).toEqual({ floor: 3 });
    expect(raw.nodes[0]?.matrices).toEqual(poses.flatMap(pose => Array.from(Float32Array.from(pose.elements))));
    const repeated = raw.pack();
    expect(direct.json === repeated.json).toBe(false); expect(direct.binary === repeated.binary).toBe(false);
    direct.json.fill(0); direct.binary.fill(0);
    expect(raw.pack()).toEqual(repeated);
    expect(geometry.getAttribute('position').getY(0)).toBe(4);
  } finally {
    for (const assembly of [raw, retained]) for (const shape of assembly.shapes) shape.material.dispose();
    geometry.dispose();
  }
});

test('the actual map assembly packer bundles without filesystem, module or compiler services', async () => {
  const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
    lib: { entry: resolve('src/sdk/bake/mapAssembly.ts'), formats: ['es'] },
    rolldownOptions: { external: [/^node:/u, 'assemblyscript/dist/asc.js'], output: { codeSplitting: false } } } });
  const output = Array.isArray(result) ? result[0] : result;
  if (output === undefined || !('output' in output)) throw new Error('Missing map assembly bundle');
  const chunks = output.output.filter(row => row.type === 'chunk'); expect(chunks).toHaveLength(1);
  for (const chunk of chunks) assertConfigBoundary([...chunk.imports, ...chunk.dynamicImports]);
});
