import { expect, it, vi } from 'vitest';
import { BoxGeometry, BufferAttribute, BufferGeometry, Float16BufferAttribute, MeshStandardMaterial } from 'three';
import { createOwnedGeometry, createOwnedGeometryBatch } from '../src/engine/models/ownedGeometry';
import { staticGlb } from '../src/sdk/bake/glb';

it('copies borrowed input and transfers adopted geometry without retaining it', async () => {
  const source = new BoxGeometry(), intake = createOwnedGeometry('/owned.glb');
  try {
    expect(() => intake.copy()).toThrow('not loaded');
    await intake.load(source);
    const copy = intake.copy(), taken = intake.take();
    expect(taken).not.toBe(source);
    expect(copy.getAttribute('position').array.buffer).not.toBe(taken.getAttribute('position').array.buffer);
    expect(() => intake.take()).toThrow('not loaded');
    intake.adopt(taken);
    expect(() => intake.adopt(copy)).toThrow('already loaded');
    expect(intake.take()).toBe(taken);
    expect(() => intake.copy()).toThrow('not loaded');
    intake.adopt(copy);
    expect(intake.take()).toBe(copy);
    copy.dispose(); taken.dispose();
  } finally { source.dispose(); }
});

it('loads the declared batch while retaining each handle ownership and retry', async () => {
  const batch = createOwnedGeometryBatch(), a = batch.geometry('a'), b = batch.geometry('b');
  const source = new BoxGeometry();
  const requests: string[] = [];
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(input => { requests.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url); return Promise.reject(new Error('missing source')); });
  try {
    await expect(batch.load(new Map([['a', source]]))).rejects.toThrow('missing source');
    expect(requests).toEqual(['b']);
    await batch.load(new Map([['a', source], ['b', source]]));
    const first = a.take(), second = b.take();
    expect(first).not.toBe(second); expect(first).not.toBe(source);
    expect(() => a.copy()).toThrow('not loaded');
    a.adopt(first); expect(a.take()).toBe(first);
    first.dispose(); second.dispose();
    expect(() => batch.geometry('a')).toThrow('declaration');
    const bounded = createOwnedGeometryBatch();
    for (let i = 0; i < 128; i++) bounded.geometry(String(i));
    expect(() => bounded.geometry('overflow')).toThrow('declaration');
  } finally { fetch.mockRestore(); source.dispose(); }
});

it('restores native half-float bits, packed vec4 normals and explicit identity indices', async () => {
  const geometry = new BufferGeometry(), material = new MeshStandardMaterial();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Int16Array([0, 0, 32767, 1, 0, 0, 32767, 2, 0, 0, 32767, 3]), 4, true));
  geometry.setAttribute('uv', new Float16BufferAttribute(new Uint16Array([0, 0, 15360, 0, 0, 15360]), 2));
  geometry.setIndex(new BufferAttribute(new Uint16Array([0, 1, 2]), 1));
  const intake = createOwnedGeometry('/typed-shape.glb');
  try {
    await intake.load(staticGlb([{ geometry, material, nativeAttributes: true, compactIndex: true }]));
    const restored = intake.take();
    try {
      expect(restored.getAttribute('normal').itemSize).toBe(4);
      expect(restored.getAttribute('normal').normalized).toBe(true);
      expect(restored.getAttribute('normal').array).toEqual(geometry.getAttribute('normal').array);
      expect(restored.getAttribute('uv')).toBeInstanceOf(Float16BufferAttribute);
      expect(restored.getAttribute('uv').array).toEqual(geometry.getAttribute('uv').array);
      expect(restored.getIndex()?.array).toEqual(new Uint16Array([0, 1, 2]));
    } finally { restored.dispose(); }
  } finally { geometry.dispose(); material.dispose(); }
});
