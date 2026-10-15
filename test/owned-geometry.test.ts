import { expect, it, vi } from 'vitest';
import { BoxGeometry } from 'three';
import { createOwnedGeometry, createOwnedGeometryBatch } from '../src/engine/models/ownedGeometry';

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
