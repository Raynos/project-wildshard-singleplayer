import { describe, expect, it } from 'vitest';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { PageResidency } from '../src/game/grid/pageResidency';

describe('early page residency', () => {
  it('refuses home admission before the bootstrap can allocate a world', () => {
    const owner = new PageResidency(new ResidencyAllocator({ playing: 400_000_000 }));
    let worlds = 0;
    const bootstrap = (): void => { owner.admitHome('home', 100_000_000); worlds++; };
    expect(bootstrap).toThrow('Home residency admission deferred');
    expect(worlds).toBe(0);
    expect(owner.allocator.entries()).toEqual([]);
    expect(() => owner.home()).toThrow('not been admitted');
    owner.dispose();
  });

  it('charges home and loader dependencies through the same envelope before the registry starts', () => {
    const owner = new PageResidency(new ResidencyAllocator({ playing: 500_000_000 }));
    const home = owner.admitHome('home', 60_000_000);
    const library = home.allocator.reserve({ id: 'library:shared', category: 'library', owner: 'home', bytes: 40_000_000, distance: 0, needed: true });
    expect(library).not.toBeNull();
    expect(owner.allocator.reserve({ id: 'far:next', category: 'far', owner: 'next', bytes: 10_000_000, distance: 10, needed: true })).toBeNull();
    const before = owner.allocator.cost();
    const registry = home.retain();
    expect(owner.allocator.cost()).toEqual(before);
    expect(owner.allocator.entries().find((row) => row.id === 'sim:home')?.refs).toBe(2);
    registry.release(); library?.release(); owner.dispose();
    expect(owner.allocator.entries()).toEqual([]);
  });

  it('keeps the early lease when the later registry fails, and rejects changed home metadata', () => {
    const owner = new PageResidency();
    const home = owner.admitHome('home', 20_000_000), registry = home.retain();
    registry.release(); registry.release();
    expect(owner.admitHome('home', home.bytes)).toBe(home);
    expect(owner.allocator.entries()).toMatchObject([{ id: 'sim:home', refs: 1, bytes: 20_000_000 }]);
    expect(() => owner.admitHome('other', home.bytes)).toThrow('identity or cost');
    expect(() => owner.admitHome('home', home.bytes + 1)).toThrow('identity or cost');
    owner.dispose();
    expect(owner.allocator.entries()).toEqual([]);
  });

  it('accounts a still-live registry after aborting boot, and refuses stale admission or handoff', () => {
    const owner = new PageResidency(), home = owner.admitHome('home', 20_000_000), registry = home.retain();
    owner.dispose(); owner.dispose();
    expect(owner.allocator.entries()).toMatchObject([{ id: 'sim:home', refs: 1 }]);
    expect(() => home.retain()).toThrow('disposed');
    expect(() => owner.admitHome('home', home.bytes)).toThrow('disposed');
    expect(() => owner.home()).toThrow('disposed');
    registry.release(); registry.release();
    expect(owner.allocator.entries()).toEqual([]);
  });

  it('refuses unmeasured homes and claims created outside the page owner', () => {
    const owner = new PageResidency();
    for (const bytes of [0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) expect(() => owner.admitHome('home', bytes)).toThrow(RangeError);
    const foreign = owner.allocator.reserve({ id: 'sim:home', category: 'sim', owner: 'home', bytes: 20_000_000, distance: 0, needed: true });
    expect(() => owner.admitHome('home', 20_000_000)).toThrow('page owner');
    foreign?.release(); owner.dispose();
  });

  it('hands the exact sole boot claim to an owned runtime without a release or cost change', () => {
    const owner = new PageResidency(), home = owner.admitHome('home', 20_000_000);
    const before = owner.allocator.cost(), runtime = home.handoff(home.bytes);
    expect(runtime.id).toBe('sim:home');
    expect(owner.allocator.cost()).toEqual(before);
    expect(owner.allocator.entries()).toMatchObject([{ id: 'sim:home', refs: 1, bytes: home.bytes }]);
    expect(owner.home()).toBe(home);
    expect(() => home.handoff(home.bytes)).toThrow('already been handed off');
    expect(() => home.retain()).toThrow('handed off');
    owner.dispose();
    expect(owner.allocator.cost()).toEqual(before);
    runtime.release();
    expect(owner.allocator.entries()).toEqual([]);
    expect(() => home.retain()).toThrow();
    expect(() => home.handoff(home.bytes)).toThrow('disposed');
  });

  it('refuses handoff while an allocated borrowed consumer still owns a reference', () => {
    const owner = new PageResidency(), home = owner.admitHome('home', 20_000_000), borrowed = home.retain();
    expect(() => home.handoff(home.bytes)).toThrow('sole boot reference');
    expect(owner.allocator.entries()).toMatchObject([{ id: 'sim:home', refs: 2 }]);
    borrowed.release();
    const runtime = home.handoff(home.bytes);
    runtime.release();
    expect(() => home.retain()).toThrow('handed off');
    expect(owner.admitHome('home', home.bytes)).toBe(home);
    expect(owner.allocator.entries()).toEqual([]);
    owner.dispose();
  });

  it('refuses a different whole-runtime cost before transferring the boot reference', () => {
    const owner = new PageResidency(), home = owner.admitHome('home', 20_000_000), before = owner.allocator.cost();
    for (const bytes of [0, home.bytes - 1, home.bytes + 1, Number.NaN]) expect(() => home.handoff(bytes)).toThrow('whole-runtime cost');
    expect(owner.allocator.cost()).toEqual(before);
    expect(owner.allocator.entries()).toMatchObject([{ id: 'sim:home', bytes: home.bytes, refs: 1 }]);
    const borrowed = home.retain(); borrowed.release(); // Refusal has not consumed the boot reference.
    const runtime = home.handoff(home.bytes); runtime.release(); owner.dispose();
    expect(owner.allocator.entries()).toEqual([]);
  });

  it('abandons an unused road-start preclaim without releasing a retained or handed-off runtime', () => {
    const owner = new PageResidency(), home = owner.admitHome('home', 20_000_000), retained = home.retain();
    expect(() => home.releasePending()).toThrow('sole boot reference'); retained.release();
    home.releasePending(); home.releasePending();
    expect(owner.allocator.entries()).toEqual([]);
    expect(() => home.retain()).toThrow('preclaim has been released');
    expect(() => home.handoff(home.bytes)).toThrow('preclaim has been released'); owner.dispose();
    const activeOwner = new PageResidency(), active = activeOwner.admitHome('home', 20_000_000), runtime = active.handoff(active.bytes);
    expect(() => active.releasePending()).toThrow('handed-off home runtime');
    expect(activeOwner.allocator.entries()).toMatchObject([{ id: 'sim:home', bytes: active.bytes, refs: 1 }]);
    runtime.release(); activeOwner.dispose();
  });
});
