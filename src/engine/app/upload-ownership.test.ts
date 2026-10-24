import { expect, test, vi } from 'vitest';
import { BufferGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Scene, Texture } from 'three';
// oxlint-disable-next-line import/no-nodejs-modules -- The collection proof owns a tiny isolated real-GC Vitest child.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Confine the child configuration to owned repository scratch.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the real fixture and installed runner without shell commands.
import { resolve as resolvePath } from 'node:path';
import { Scope } from './scope';
import { AssetService } from './assets';
import { ownSceneResource, ownSceneTree } from './sceneOwnership';
import { UploadOwnership } from '../render/uploadOwnership';
import type { Renderer } from '../render/renderer';

function rendererFor(texture: Texture): { properties: Renderer['properties']; renderBufferDirect: Renderer['renderBufferDirect']; render: Renderer['render'] } {
  const properties = { has: () => false, get: (object: unknown) => object, remove: () => undefined, update: () => undefined, dispose: () => undefined };
  return { properties, render: () => undefined, renderBufferDirect: () => { properties.get(texture); properties.get(texture); } };
}

test('upload observations dedupe only the same resource, render and owner identity', () => {
  const page = new Scope('page'), first = page.child('same name'), second = page.child('same name'), assets = new AssetService();
  const texture = new Texture(), renderer = rendererFor(texture);assets.register('shared', texture, { retain: true, cache: true });
  const observer = new UploadOwnership(page, assets), observed = vi.spyOn(assets, 'observeResidency');observer.attach(renderer);
  const geometry = new BufferGeometry(), material = new MeshBasicMaterial(), camera = new PerspectiveCamera(), scene = new Scene();
  const firstMesh = new Mesh(geometry, material), secondMesh = new Mesh(geometry, material), unowned = new Mesh(geometry, material);
  ownSceneTree(new Group().add(firstMesh), first, assets);ownSceneTree(new Group().add(secondMesh), second, assets);
  const draw = (mesh: Mesh): void => { renderer.renderBufferDirect(camera, scene, geometry, material, mesh, { start: 0, count: 0, materialIndex: 0 }); };
  try {
    draw(firstMesh);draw(firstMesh);draw(secondMesh);draw(secondMesh);draw(unowned);draw(unowned);draw(firstMesh);
    expect(observed.mock.calls.filter(([resource]) => resource === texture).map(([, owner]) => owner)).toEqual([first, second, page, first]);
    renderer.render(scene, camera);draw(firstMesh);draw(firstMesh);
    expect(observed.mock.calls.filter(([resource]) => resource === texture)).toHaveLength(5);
    texture.dispose();draw(firstMesh);
    expect(observed.mock.calls.filter(([resource]) => resource === texture)).toHaveLength(6);
  } finally { page.dispose();assets.evictCached('shared');geometry.dispose();material.dispose(); }
});

function drawRetiredOwner(page: Scope, assets: AssetService, renderer: ReturnType<typeof rendererFor>): WeakRef<Scope> {
  const owner = page.child('retired resident'), root = new Group(), geometry = new BufferGeometry(), material = new MeshBasicMaterial();
  const mesh = new Mesh(geometry, material);root.add(mesh);ownSceneTree(root, owner, assets);
  renderer.renderBufferDirect(new PerspectiveCamera(), new Scene(), geometry, material, mesh, { start: 0, count: 0, materialIndex: 0 });
  const ref = new WeakRef(owner);owner.dispose();return ref;
}

test('a retained sampler and renderer do not keep their last retired draw Scope alive', async () => {
  const gc: unknown = Reflect.get(globalThis, 'gc');
  if (typeof gc !== 'function') {
    const { WS_UPLOAD_OWNER_GC: child } = process.env;
    if (child === '1') throw new Error('Collection fixture requires --expose-gc');
    mkdirSync('tmp', { recursive: true });const directory = mkdtempSync(resolvePath('tmp/upload-owner-gc-'));
    try {
      const config = resolvePath(directory, 'vitest.config.mjs');
      writeFileSync(config, `export default {root:${JSON.stringify(resolvePath('.'))},test:{include:['src/engine/app/upload-ownership.test.ts'],setupFiles:[],pool:'forks',maxWorkers:1,execArgv:['--expose-gc']}};`);
      const output = execFileSync(process.execPath, ['--expose-gc', resolvePath('node_modules/vitest/vitest.mjs'), 'run', '--config', config], {
        env: { ...process.env, WS_UPLOAD_OWNER_GC: '1', NO_COLOR: '1' }, encoding: 'utf8', stdio: 'pipe', timeout: 20_000,
      });
      expect(output).toContain('2 passed');
    } finally { rmSync(directory, { recursive: true, force: true }); }
    return;
  }
  const page = new Scope('live page'), assets = new AssetService(), texture = new Texture(), renderer = rendererFor(texture);
  ownSceneResource(texture, page);const observer = new UploadOwnership(page, assets);observer.attach(renderer);
  const retired = drawRetiredOwner(page, assets, renderer);
  try {
    for (let turn = 0; turn < 40; turn++) {
      await new Promise<void>(resolve => { setTimeout(resolve, 0); });Reflect.apply(gc, globalThis, []);
      if (retired.deref() === undefined) break;
    }
    expect(retired.deref()).toBeUndefined();
    expect(page.disposed).toBe(false);expect(observer.has(texture)).toBe(true);expect(observer.resources().has(texture)).toBe(true);
    // The observer, renderer and long-lived resource remain usable after collection.
    renderer.properties.get(texture);expect(observer.has(texture)).toBe(true);
  } finally { page.dispose(); }
});
