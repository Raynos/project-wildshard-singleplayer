import { expect, test, vi } from 'vitest';
import { preparationAdmission } from '../src/game/grid/preparationAdmission';
import type { LiveGridAdmission, LiveGridRegion } from '../src/game/grid/live';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { legacyDouble } from './fake/FakeGame';
import type { SimHost } from '@wildshard/engine/sim';

function region(dispose: () => void): LiveGridRegion { return { host: legacyDouble<SimHost>({}), dispose }; }

function claim() {
  const allocator = new ResidencyAllocator();
  const lease = allocator.reserve({ id: 'prepared-world', category: 'sim', owner: 'test', bytes: 1, distance: 0, needed: true });
  if (lease === null) throw new Error('Missing test claim');
  return lease;
}

test('prefetch releases its input lease and cached admission reacquires on every visit', async () => {
  const events: string[] = [];
  const metadata: boolean[] = [];
  let next = 0;
  const prepare = (keepMetadata: boolean): Promise<LiveGridAdmission> => {
    metadata.push(keepMetadata);
    const visit = ++next; let active = true;
    events.push(`acquire:${visit}`);
    const cancel = (): void => { if (active) { active = false; events.push(`release:${visit}`); } };
    return Promise.resolve({ bytes: 42, reloadsCheckpoint: true, exclusiveRuntime: true, prepareRuntime: () => { events.push('runtime'); return Promise.resolve(); }, cancel,
      create: saved => {
        expect(active).toBe(true); expect(saved).toBeUndefined(); events.push(`world:${visit}`);
        return Promise.resolve(region(cancel));
      } });
  };
  const admitted = await preparationAdmission(prepare), lease = claim();
  try {
    expect(events).toEqual(['acquire:1', 'release:1']);
    expect(admitted.bytes).toBe(42); expect(admitted.reloadsCheckpoint).toBe(true); expect(admitted.exclusiveRuntime).toBe(true);
    await admitted.prepareRuntime?.();
    const first = await admitted.create(undefined, lease); first.dispose();
    const second = await admitted.create(undefined, lease); second.dispose();
    expect(events).toEqual(['acquire:1', 'release:1', 'runtime', 'acquire:2', 'world:2', 'release:2', 'acquire:3', 'world:3', 'release:3']);
    expect(metadata).toEqual([true, false, false]);
  } finally { lease.release(); }
});

test('failed verified reacquisition never starts a world', async () => {
  const create = vi.fn<LiveGridAdmission['create']>(), cancel = vi.fn<() => void>(); let calls = 0;
  const admitted = await preparationAdmission(() => {
    if (++calls > 1) return Promise.reject(new Error('hash mismatch'));
    return Promise.resolve({ bytes: 1, cancel, create });
  });
  const lease = claim();
  try { await expect(admitted.create(undefined, lease)).rejects.toThrow('hash mismatch'); expect(create).not.toHaveBeenCalled(); expect(cancel).toHaveBeenCalledOnce(); }
  finally { lease.release(); }
});

test('cancellation during reacquisition releases the fresh lease without constructing', async () => {
  let resume: ((value: LiveGridAdmission) => void) | undefined;
  const cancel = vi.fn<() => void>(), create = vi.fn<LiveGridAdmission['create']>(); let calls = 0;
  const admitted = await preparationAdmission(() => ++calls === 1 ? Promise.resolve({ bytes: 1, create }) : new Promise<LiveGridAdmission>(resolve => { resume = resolve; }));
  const lease = claim();
  try {
    const pending = admitted.create(undefined, lease); admitted.cancel?.();
    if (resume === undefined) throw new Error('Missing reacquisition gate'); resume({ bytes: 1, cancel, create });
    await expect(pending).rejects.toThrow('cancelled'); expect(create).not.toHaveBeenCalled(); expect(cancel).toHaveBeenCalledOnce();
  } finally { lease.release(); }
});

test('cancellation keeps inputs pinned until a running build settles, then disposes the unpublished world', async () => {
  let finish: ((value: LiveGridRegion) => void) | undefined;
  const cancel = vi.fn<() => void>(), dispose = vi.fn<() => void>(); let calls = 0;
  const admitted = await preparationAdmission(() => Promise.resolve({ bytes: 1, cancel: ++calls === 1 ? () => undefined : cancel,
    create: () => new Promise<LiveGridRegion>(resolve => { finish = resolve; }) }));
  const lease = claim();
  try {
    const pending = admitted.create(undefined, lease); await Promise.resolve(); await Promise.resolve();
    admitted.cancel?.(); expect(cancel).not.toHaveBeenCalled();
    if (finish === undefined) throw new Error('Missing build gate'); finish(region(dispose));
    await expect(pending).rejects.toThrow('cancelled'); expect(dispose).toHaveBeenCalledOnce(); expect(cancel).toHaveBeenCalledOnce();
  } finally { lease.release(); }
});
