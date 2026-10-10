// oxlint-disable-next-line import/no-nodejs-modules -- Proves the published authoring module in a plain Node process.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- The focused compiler owns and removes its isolated stage.
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Compiled modules resolve the test checkout's installed dependencies.
import { join, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Imports the actual emitted ESM files.
import { pathToFileURL } from 'node:url';
// oxlint-disable-next-line import/no-nodejs-modules -- Runs the same Node executable without a page or runtime loader.
import process from 'node:process';
import { expect, it } from 'vitest';
import { build } from 'vite';
import { SDK_EXTERNALS } from '../scripts/sdk-externals.mjs';

it('the compiled SDK and its plain Node caller use the same real three.js constructors', async () => {
  const cache = resolve('node_modules/.cache'); mkdirSync(cache, { recursive: true });
  const stage = mkdtempSync(join(cache, 'sdk-scene-'));
  try {
    await build({ configFile: false, publicDir: false, logLevel: 'silent', build: {
      outDir: stage, emptyOutDir: true, minify: false,
      lib: { entry: Object.fromEntries(['scene', 'physics', 'entries', 'spawns'].map(name => [name, resolve(`src/sdk/${name}.ts`)])), formats: ['es'], fileName: (_format, name) => `${name}.mjs` },
      rolldownOptions: { platform: 'node', external: SDK_EXTERNALS },
    } });
    const source = `
      import { Scene, Mesh, BoxGeometry, MeshStandardMaterial, Object3D } from 'three';
      import { readScene } from ${JSON.stringify(pathToFileURL(join(stage, 'scene.mjs')).href)};
      import { BoxCollider } from ${JSON.stringify(pathToFileURL(join(stage, 'physics.mjs')).href)};
      const scene = new Scene(), collider = new BoxCollider(2,3,4,'stone'); collider.name='wall';
      scene.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()), collider);
      const rows=readScene(scene);
      console.log(JSON.stringify({sameConstructor:collider instanceof Object3D, meshes:rows.geometries.length, colliders:rows.colliders}));
    `;
    const result: unknown = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', source], { encoding: 'utf8', timeout: 5000 }));
    expect(result).toEqual({ sameConstructor: true, meshes: 1, colliders: [{ id: 'wall', shape: { kind: 'box', x: 0, y: 0, z: 0, surface: 'stone', hx: 1, hy: 1.5, hz: 2 } }] });
  } finally { rmSync(stage, { recursive: true, force: true }); }
});
