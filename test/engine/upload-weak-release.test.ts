// SF57 leak5 (E435): a weakly held upload really is collectable (the level's end-of-life capture no longer shares a closure
// context with the resource's dispose listener), and a render target's dispose releases its attachments with it.
// oxlint-disable-next-line import/no-nodejs-modules -- the collection witness needs V8's own collector
import { setFlagsFromString } from 'node:v8';
// oxlint-disable-next-line import/no-nodejs-modules -- the collection witness needs V8's own collector
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';
import { MeshBasicMaterial, WebGLRenderTarget, type WebGLRenderer } from 'three';
import { AssetService } from '../../src/engine/app/assets';
import { Scope } from '../../src/engine/app/scope';
import { legacyDouble } from '../fake/FakeGame';
import { UploadOwnership } from '../../src/engine/render/uploadOwnership';

setFlagsFromString('--expose_gc');
const collect: unknown = runInNewContext('gc');
const gc = (): void => { if (typeof collect === 'function') Reflect.apply(collect, undefined, []); };
const tick = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0); });

function rig(): { page: Scope; uploads: UploadOwnership; renderer: WebGLRenderer } {
  const page = new Scope('page'), uploads = new UploadOwnership(page, new AssetService());
  const renderer = legacyDouble<WebGLRenderer>({
    properties: legacyDouble<WebGLRenderer['properties']>({ get: () => ({}) }),
    renderBufferDirect: () => undefined,
  });
  uploads.attach(renderer);
  return { page, uploads, renderer };
}

it('an unowned upload nobody references is garbage collected, not kept by the level capture or the finalizer', async () => {
  const { page, uploads, renderer } = rig();
  // uploaded with no owner, then dropped by its code without a dispose
  ((): void => { renderer.properties.get(new MeshBasicMaterial()); })();
  expect(uploads.orphanCensus()).toEqual({ live: 1, collected: 0 });
  // a WeakRef read (the census) keeps its target alive to the end of its job: collect in the next one
  for (let i = 0; i < 20; i++) { await tick(); gc(); await tick(); if (uploads.orphanCensus().collected > 0) break; }
  expect(uploads.orphanCensus()).toEqual({ live: 0, collected: 1 });
  expect(page.census.resources).toBe(0); // its level capture went with it
  page.dispose();
});

it('a render target\'s dispose releases its attachment textures, which three frees without their own dispose event', () => {
  const { page, uploads, renderer } = rig();
  const target = new WebGLRenderTarget(4, 4), texture = target.texture;
  renderer.properties.get(target); renderer.properties.get(texture); // setRenderTarget's lookups
  expect(uploads.has(target)).toBe(true); expect(uploads.has(texture)).toBe(true);
  target.dispose();
  renderer.properties.get(texture); // three's deallocateRenderTarget reads the attachment while freeing it
  expect(uploads.has(target)).toBe(false); expect(uploads.has(texture)).toBe(false);
  expect(uploads.resources().size).toBe(0);
  page.dispose();
});

it('retiring a target dispatches attachment disposal so generated environment targets retire too', () => {
  const { page, uploads, renderer } = rig();
  const source = new WebGLRenderTarget(4, 4), environment = new WebGLRenderTarget(8, 8);
  const dispose = vi.spyOn(environment, 'dispose');
  // WebGLEnvironments owns its converted target through a listener on the source texture.
  // Merely dropping that texture from the upload census leaves the converted GPU allocation alive.
  const releaseEnvironment = (): void => {
    source.texture.removeEventListener('dispose', releaseEnvironment);
    environment.dispose();
  };
  source.texture.addEventListener('dispose', releaseEnvironment);
  for (const target of [source, environment]) {
    renderer.properties.get(target); renderer.properties.get(target.texture);
  }
  source.dispose();
  expect(dispose).toHaveBeenCalledOnce();
  expect(uploads.resources().size).toBe(0);
  expect(uploads.orphanCensus()).toEqual({ live: 0, collected: 0 });
  page.dispose();
  expect(dispose).toHaveBeenCalledOnce();
});
