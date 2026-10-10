import { expect, it, vi } from 'vitest';
import { BoxGeometry, Group } from 'three';
import { farRingPorts, type FarPrepared, type FarProxyView } from '../src/game/grid/farView';

const tile = { instance: 'cell' };
function prepared(): FarPrepared {
  return { geometry: new BoxGeometry(), look: { family: 'pbr', haze: { colour: [0.4, 0.5, 0.6], near: 100, far: 200, max: 0.5 } } };
}

it('exposes the same admitted far view only after preparation, without another material or geometry', async () => {
  const root = new Group(), data = prepared();
  let release = (): void => undefined;
  const ready = new Promise<void>(resolve => { release = resolve; });
  let staged: FarProxyView | undefined;
  const ports = farRingPorts({ root: () => root, load: () => Promise.resolve(data), prepare: async view => {
    staged = view;
    expect(view.mesh.visible).toBe(false); expect(view.mesh.parent).toBe(root);
    expect(view.mesh.geometry).toBe(data.geometry);
    await ready;
  } });
  let finish = (): void => undefined;
  const completed = new Promise<void>(resolve => { finish = resolve; });
  const done = vi.fn((result: FarPrepared | Error) => { expect(result).toBe(data); finish(); });
  ports.fetch(tile, done); await Promise.resolve();
  expect(done).not.toHaveBeenCalled(); expect(root.children).toHaveLength(1);
  if (staged === undefined) throw new Error('Missing staged view');
  const material = staged.mesh.material;
  release(); await completed;
  const view = ports.upload(tile, data);
  expect(view).toBe(staged); expect(view.mesh.material).toBe(material);
  expect(view.mesh.visible).toBe(true); expect(root.children).toEqual([view.mesh]);
  view.dispose(); expect(root.children).toHaveLength(0);
});

it('retires a late prepared result on discard, exactly once, without exposing it', async () => {
  const root = new Group(), data = prepared(), dispose = vi.spyOn(data.geometry, 'dispose');
  let staged: FarProxyView | undefined;
  const ports = farRingPorts({ root: () => root, load: () => Promise.resolve(data), prepare: view => {
    staged = view; return Promise.resolve();
  } });
  await new Promise<void>((resolve, reject) => { ports.fetch(tile, result => {
    if (result instanceof Error) { reject(result); return; }
    expect(staged?.mesh.visible).toBe(false); ports.discard(tile, result); resolve();
  }); });
  expect(root.children).toHaveLength(0); expect(dispose).toHaveBeenCalledTimes(1);
  staged?.dispose(); expect(dispose).toHaveBeenCalledTimes(1);
});

it('returns the preparation failure and disposes its hidden resources instead of installing', async () => {
  const root = new Group(), data = prepared(), dispose = vi.spyOn(data.geometry, 'dispose');
  const fault = new Error('Owner left'); let materialDisposals = 0;
  const ports = farRingPorts({ root: () => root, load: () => Promise.resolve(data), prepare: view => {
    const materials = Array.isArray(view.mesh.material) ? view.mesh.material : [view.mesh.material];
    for (const material of materials) material.addEventListener('dispose', () => { materialDisposals++; });
    return Promise.reject(fault);
  } });
  const result = await new Promise<FarPrepared | Error>(resolve => { ports.fetch(tile, resolve); });
  expect(result).toBe(fault); expect(root.children).toHaveLength(0);
  expect(dispose).toHaveBeenCalledTimes(1); expect(materialDisposals).toBe(1);
});

it('keeps ordinary ring callers on their existing synchronous upload path', async () => {
  const root = new Group(), data = prepared();
  const ports = farRingPorts({ root: () => root, load: () => Promise.resolve(data) });
  const result = await new Promise<FarPrepared | Error>(resolve => { ports.fetch(tile, resolve); });
  expect(result).toBe(data); expect(root.children).toHaveLength(0);
  const view = ports.upload(tile, data);
  expect(view.mesh.visible).toBe(true); expect(view.mesh.geometry).toBe(data.geometry);
  view.dispose();
});
