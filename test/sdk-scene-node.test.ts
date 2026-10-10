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

it('loads the authoring classes directly with Node type stripping and preserves constructors and clones', () => {
  const source = `
    import { Scene, BoxGeometry, TetrahedronGeometry } from 'three';
    import { readScene } from './src/sdk/scene.ts';
    import { BoxCollider, CapsuleCollider, HullCollider, MeshCollider } from './src/sdk/physics.ts';
    import { Entry } from './src/sdk/entries.ts';
    import { PlayerStart, Spawn } from './src/sdk/spawns.ts';
    const scene = new Scene(), spawn = new Spawn('goat'); spawn.name='goat.1';
    const objects = [new BoxCollider(2,3,4,'stone').clone(), new CapsuleCollider(.5,1,'grass').clone(),
      new HullCollider(new TetrahedronGeometry(),'rock').clone(), new MeshCollider(new BoxGeometry(),'wood').clone()];
    for (let i=0;i<objects.length;i++) objects[i].name='collider.'+i;
    scene.add(...objects, new Entry('east','ground').clone(), new PlayerStart(), spawn.clone());
    const rows=readScene(scene);
    console.log(JSON.stringify({kinds:rows.colliders.map(row=>row.shape.kind),box:rows.colliders[0].shape,
      spawn:rows.spawns[0].kind,entry:rows.entries[0].edge}));
  `;
  const actual: unknown = JSON.parse(execFileSync(process.execPath, ['--import', './scripts/sim-node-loader.mjs', '--input-type=module', '-e', source], {encoding:'utf8',timeout:5000}));
  expect(actual).toEqual({ kinds:['box','capsule','hull','trimesh'],
    box:{kind:'box',x:0,y:0,z:0,surface:'stone',hx:1,hy:1.5,hz:2},spawn:'goat',entry:'east' });
});
