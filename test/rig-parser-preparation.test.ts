// @vitest-environment happy-dom
import { afterEach, expect, test, vi } from 'vitest';
import { BoxGeometry, DefaultLoadingManager, Mesh, MeshStandardMaterial } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { prepareRigLoader, loadRigFile } from '../src/engine/anim/rig';
import { DownloadAccounting, installDownloadAccounting } from '../src/engine/boot/download';
import { loadGLTF } from '../src/engine/core/assets';
import { loadGlbPart } from '../src/engine/models/glb';

let inventory: HTMLScriptElement | undefined;
afterEach(() => { inventory?.remove(); inventory = undefined; vi.restoreAllMocks(); });

function bank(groups: unknown): void {
  inventory = document.createElement('script'); inventory.id = 'boot-module-files';
  inventory.textContent = JSON.stringify({optional:{files:[['/assets/parser.js',17]],groups}});
  document.body.append(inventory);
}

const empty = JSON.stringify({asset:{version:'2.0'},scene:0,scenes:[{nodes:[]}],nodes:[]});

test('missing parser admission refuses before importing its code or publishing bytes', () => {
  bank({'models.gltf':[1]});
  const accounting = new DownloadAccounting('https://fixture.invalid/'), dispose = installDownloadAccounting(accounting);
  try {
    expect(() => prepareRigLoader()).toThrow('Missing selected client module file');
    expect(accounting.snapshot()).toMatchObject({declaredFiles:0,declaredBytes:0});
  } finally { dispose(); }
});

test('parser requests publish selected bytes synchronously before awaiting the original module', async () => {
  bank({'models.gltf':[0]});
  const accounting = new DownloadAccounting('https://fixture.invalid/'), dispose = installDownloadAccounting(accounting);
  try {
    const requested = prepareRigLoader();
    expect(prepareRigLoader()).toBe(requested);
    expect(accounting.snapshot()).toMatchObject({declaredFiles:1,declaredBytes:17,networkBytes:0,cachedBytes:0});
    const first = await requested, second = await prepareRigLoader();
    expect(first).toBe(second); // Native module identity; no replacement loader or memo book.
    expect(first.createRigLoader()).not.toBe(first.createRigLoader());
    expect(accounting.snapshot()).toMatchObject({declaredFiles:1,declaredBytes:17,networkBytes:0,cachedBytes:0});
  } finally { dispose(); }
});

test('a new loading ledger receives module facts after the parser is warm', async () => {
  bank({'models.gltf':[0]});
  const module = await prepareRigLoader();
  const accounting = new DownloadAccounting('https://fixture.invalid/'), dispose = installDownloadAccounting(accounting);
  try {
    expect(await prepareRigLoader()).toBe(module);
    expect(accounting.snapshot()).toMatchObject({declaredFiles:1,declaredBytes:17,networkBytes:0,cachedBytes:0});
    inventory?.remove(); inventory = undefined;
    bank({'models.gltf':[1]});
    expect(() => prepareRigLoader()).toThrow('Missing selected client module file');
    expect(accounting.snapshot()).toMatchObject({declaredFiles:1,declaredBytes:17,networkBytes:0,cachedBytes:0});
  } finally { dispose(); }
});

test('concurrent file reads keep the original shared loader and isolated alias manager', async () => {
  const file = await new GLTFLoader().parseAsync(empty, ''), receivers: GLTFLoader[] = [];
  const releases: (() => void)[] = [];
  let blocked = true;
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(function readOriginalFile(this: GLTFLoader) {
    receivers.push(this);
    return blocked ? new Promise(resolve => { releases.push(() => { resolve(file); }); }) : Promise.resolve(file);
  });
  const pending = Promise.all([loadRigFile('/one.glb'),loadRigFile('/two.glb'),loadRigFile('/three.glb')]);
  try { await expect.poll(() => receivers.length).toBe(3); }
  finally { blocked = false; for (const release of releases) release(); }
  const reads = await pending;
  expect(reads).toEqual([file,file,file]);
  expect(new Set(receivers).size).toBe(1);
  expect(receivers[0]?.manager).toBe(DefaultLoadingManager);
  await loadRigFile('/alias.glb',{'/image.png':'/replacement.png'});
  expect(receivers[3]).not.toBe(receivers[0]);
  expect(receivers[3]?.manager).not.toBe(DefaultLoadingManager);
});

test('the asset and prop owners each retain one original loader across concurrent first reads', async () => {
  const file = await new GLTFLoader().parseAsync(empty, ''), assets: GLTFLoader[] = [], props: GLTFLoader[] = [];
  vi.spyOn(GLTFLoader.prototype, 'load').mockImplementation(function readOriginalAsset(this: GLTFLoader, _url, onLoad) { assets.push(this); onLoad(file); return undefined; });
  expect(await Promise.all([loadGLTF('first'),loadGLTF('second')])).toEqual([file,file]);
  expect(new Set(assets).size).toBe(1);
  const geometry = new BoxGeometry(), material = new MeshStandardMaterial(); file.scene.add(new Mesh(geometry,material));
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(function readOriginalProp(this: GLTFLoader) { props.push(this); return Promise.resolve(file); });
  const results = await Promise.all([loadGlbPart('/first.glb',()=>undefined),loadGlbPart('/second.glb',()=>undefined)]);
  try {
    expect(new Set(props).size).toBe(1);
    expect(props[0]).not.toBe(assets[0]);
    expect(results.every(result => result !== null && result.material === material)).toBe(true);
    expect(results[0]?.geometry).not.toBe(results[1]?.geometry);
  } finally { for (const result of results) result?.geometry.dispose(); geometry.dispose(); material.dispose(); }
});
