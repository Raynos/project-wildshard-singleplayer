import { expect, test, vi } from 'vitest';
import { Scope } from '@wildshard/engine/app/scope';
import { initialHomeMetadataRequired, prepareHomeMetadata } from './homeMetadata';

test('metadata starts before the barrier and keeps one page-owned lease', async () => {
  const owner = new Scope('initial home'), release = vi.fn<() => void>();
  const read = vi.fn(() => Promise.resolve({ release }));
  const ready = prepareHomeMetadata(owner, read);
  await ready;
  expect(read).toHaveBeenCalledOnce(); expect(release).not.toHaveBeenCalled();
  await ready; expect(read).toHaveBeenCalledOnce();
  owner.dispose(); owner.dispose(); expect(release).toHaveBeenCalledOnce();
});

test('an early rejection remains the exact barrier error without a retry', async () => {
  const owner = new Scope('refused home'), error = new Error('Exact metadata refusal');
  const read = vi.fn(() => Promise.reject(error)), ready = prepareHomeMetadata(owner, read);
  await expect(ready).rejects.toBe(error); await expect(ready).rejects.toBe(error);
  expect(read).toHaveBeenCalledOnce(); owner.dispose();
});

test('closed pages start no read and late results release before refusing', async () => {
  const closed = new Scope('already closed'); closed.dispose();
  const read = vi.fn(() => Promise.resolve(null));
  await expect(prepareHomeMetadata(closed, read)).rejects.toThrow('owner left');
  expect(read).not.toHaveBeenCalled();
  const owner = new Scope('late home'), release = vi.fn<() => void>();
  let finish = (_value: { release: () => void }): void => { throw new Error('Missing resolver'); };
  const pending = new Promise<{ release: () => void }>(resolve => { finish = resolve; });
  const ready = prepareHomeMetadata(owner, () => pending);
  await Promise.resolve(); owner.dispose(); finish({ release });
  await expect(ready).rejects.toThrow('owner left'); expect(release).toHaveBeenCalledOnce();
});

test('an unavailable descriptor adds no metadata work or new refusal', async () => {
  const owner = new Scope('unavailable');
  await expect(prepareHomeMetadata(owner, () => null)).resolves.toBeUndefined(); owner.dispose();
});

test('only actual initial homes prefetch, never standalone or road recovery', () => {
  const common = { instance: 'cell-0-0', slug: 'driftwood-isle', catalogue: 'catalogue', at: 1, road: { x: 0, z: 0, yaw: 0 } };
  const recovery = { ...common, reason: 'reload' as const };
  expect(initialHomeMetadataRequired({})).toBe(false);
  expect(initialHomeMetadataRequired({ ownedGridHome: true })).toBe(true);
  expect(initialHomeMetadataRequired({ ownedGridHome: true, recovery })).toBe(false);
  expect(initialHomeMetadataRequired({ ownedGridHome: true, recovery: { ...recovery, saved: { ...common, location: { kind: 'road' } } } })).toBe(false);
  expect(initialHomeMetadataRequired({ ownedGridHome: true, recovery: { ...recovery, saved: { ...common, location: { kind: 'cell', x: 0, y: 0, z: 0, yaw: 0 } } } })).toBe(true);
});
