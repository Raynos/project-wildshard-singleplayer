import { expect, test } from 'vitest';
import * as v from 'valibot';
import { ResidencyAllocator, type ResidencyClaim } from '../src/game/grid/allocator';
import { ReferenceResidencyAllocator } from './fixtures/grid/allocator-before';
import { MemoryAdmission } from '../src/format/product';
import { CONTENT_CAPS } from '../src/engine/core/config';
import recorded from './fixtures/grid/pine-ledger-sequence.json' with { type: 'json' };

type Ledger = Pick<ReferenceResidencyAllocator, 'reserve' | 'reservePageComponent' | 'markMeasuredPage' | 'cost' | 'entries' | 'has'>;
type LedgerLease = NonNullable<ReturnType<Ledger['reserve']>>;
function pair(playing?: number, developer = true) {
  return [new ReferenceResidencyAllocator({ ...(playing === undefined ? {} : { playing }), memory: new MemoryAdmission(() => developer) }),
    new ResidencyAllocator({ ...(playing === undefined ? {} : { playing }), memory: new MemoryAdmission(() => developer) })];
}
function same(ledgers: Ledger[]) {
  expect(ledgers[1]?.cost()).toEqual(ledgers[0]?.cost());
  expect(ledgers[1]?.entries()).toEqual(ledgers[0]?.entries());
}
function result<T>(run: () => T): T | string { try { return run(); } catch (error) { return String(error); } }
/** Committed evictions, in order: an eviction that cannot make room is no longer prepared and aborted claim by claim. */
const committed = (events: readonly string[] | undefined): string[] => (events ?? []).filter(event => event.startsWith('commit'));
const Claim = v.object({ id: v.string(), category: v.picklist(['l0', 'l1', 'far', 'near', 'library', 'sim', 'commons', 'product', 'page']),
  bytes: v.number(), owner: v.string(), distance: v.number(), needed: v.boolean(), coveredBy: v.exactOptional(v.string()) });

test('diagnostic snapshots stay detached across lease and coverage changes', () => {
  const ledger = new ResidencyAllocator({ memory: new MemoryAdmission(() => true) });
  const claim = { category: 'sim' as const, owner: 'test', distance: 10, needed: true, bytes: 400, id: 'parent' };
  const parent = ledger.reserve(claim);
  const child = ledger.reserve({ ...claim, id: 'child', category: 'commons', bytes: 200, coveredBy: 'parent' });
  if (parent === null || child === null) throw new Error('Fixture admission failed');
  const initial = ledger.entries(), oldParent = initial.find(row => row.id === 'parent');
  expect(initial.map(row => row.id)).toEqual(['child', 'parent']);
  expect(ledger.entries()[0]).toBe(initial[0]);
  const shared = ledger.reserve(claim), unhold = parent.hold();
  parent.update({ needed: false, distance: 30 });
  expect(ledger.entries().find(row => row.id === 'parent')).toMatchObject({ refs: 2, holds: 1, needed: false, distance: 30 });
  expect(oldParent).toMatchObject({ refs: 1, holds: 0, needed: true, distance: 10 });
  expect(Object.isFrozen(oldParent)).toBe(true);
  unhold(); shared?.release(); parent.release();
  expect(ledger.entries()).toEqual([expect.objectContaining({ id: 'child', accountedBytes: 200 })]);
  expect(initial[0]).toMatchObject({ id: 'child', accountedBytes: 0 });
  const next = ledger.reserve(claim);
  expect(ledger.entries()[0]).toMatchObject({ id: 'child', accountedBytes: 0 });
  next?.release(); child.release();
  expect(ledger.entries()).toEqual([]);
});

test('recorded Pine retained allocations keep every admission and total identical', () => {
  const ledgers = pair(), parent = v.parse(Claim, recorded.parent), claims = v.parse(v.array(Claim), recorded.claims);
  const held = ledgers.map(ledger => {
    const lease = ledger.reserve(parent); ledger.markMeasuredPage(parent.id); return { lease, assets: [] as (LedgerLease | null)[] };
  });
  same(ledgers);
  for (const claim of claims) {
    const decisions = ledgers.map((ledger, i) => {
      const lease = ledger.reserve(claim); held[i]?.assets.push(lease); return lease !== null;
    });
    expect(decisions[1]).toBe(decisions[0]); same(ledgers);
  }
  // Retirement exposes still-retained covered allocations; the same parent id can later cover them again.
  for (const row of held) row.lease?.release(); same(ledgers);
  const again = ledgers.map(ledger => ledger.reserve(parent)); same(ledgers);
  for (const row of held) for (const lease of row.assets) lease?.release(); same(ledgers);
  for (const lease of again) lease?.release(); same(ledgers);
  expect(ledgers[1]?.memory.reports()).toEqual(ledgers[0]?.memory.reports());
}, 30_000);

test.each([false, true])('indexed coverage, holds, ordering and refusal match the original (Developer %s)', developer => {
  const ledgers = pair(CONTENT_CAPS.engineBase + CONTENT_CAPS.overlap + 1000, developer);
  const leases = ledgers.map(() => new Map<string, LedgerLease | null>()), unholds = ledgers.map(() => new Map<string, () => void>());
  const events = ledgers.map(() => [] as string[]);
  const run = (action: (ledger: Ledger, i: number) => unknown) => {
    const outcomes = ledgers.map((ledger, i) => result(() => action(ledger, i)));
    expect(outcomes[1]).toEqual(outcomes[0]); same(ledgers); expect(committed(events[1])).toEqual(committed(events[0]));
    expect(ledgers[1]?.memory.reports()).toEqual(ledgers[0]?.memory.reports());
  };
  const reserve = (key: string, claim: ResidencyClaim, evict = false, refuses = false) => run((ledger, i) => {
    const lease = ledger.reserve({ ...claim, ...(evict ? { prepareEvict: () => {
      events[i]?.push(`prepare:${key}`);
      return refuses ? null : { commit: () => { events[i]?.push(`commit:${key}`); }, abort: () => { events[i]?.push(`abort:${key}`); } };
    } } : {}) }); leases[i]?.set(key, lease); return lease !== null;
  });
  const base = { category: 'far' as const, owner: 'test', distance: 10, needed: false, bytes: 100 };
  reserve('a', { ...base, id: 'a' }, true); reserve('b', { ...base, id: 'b' }, true, true);
  reserve('c', { ...base, id: 'c' }, true); reserve('near', { ...base, id: 'near', category: 'near', bytes: 0 });
  run((_ledger, i) => { unholds[i]?.set('a', leases[i]?.get('a')?.hold() ?? (() => undefined)); });
  run((_ledger, i) => { leases[i]?.get('c')?.update({ distance: 50, needed: true }); });
  reserve('pressure', { ...base, id: 'pressure', bytes: 900, needed: true });
  run((_ledger, i) => { unholds[i]?.get('a')?.(); leases[i]?.get('c')?.update({ needed: false }); });
  reserve('pressure2', { ...base, id: 'pressure2', bytes: 600, needed: true });
  run((_ledger, i) => { leases[i]?.get('pressure')?.release(); leases[i]?.get('pressure2')?.release(); });
  reserve('parent', { ...base, id: 'parent', category: 'sim', bytes: 400, needed: true });
  run(ledger => { if (ledger.has('parent')) ledger.markMeasuredPage('parent'); });
  reserve('child', { ...base, id: 'child', category: 'commons', bytes: 200, coveredBy: 'parent' });
  reserve('overflow', { ...base, id: 'overflow', category: 'commons', bytes: 500, coveredBy: 'parent' });
  run((ledger, i) => { const lease = ledger.reservePageComponent('page', 100, 50, 'parent'); leases[i]?.set('page', lease); return lease !== null; });
  run((_ledger, i) => { leases[i]?.get('child')?.update({ coveredBy: null }); });
  run((_ledger, i) => { leases[i]?.get('child')?.update({ coveredBy: 'parent' }); });
  run((ledger, i) => { const lease = ledger.reservePageComponent('page', 120, 60); leases[i]?.set('page2', lease); return lease !== null; });
  run((_ledger, i) => { leases[i]?.get('parent')?.release(); });
  reserve('parent2', { ...base, id: 'parent', category: 'sim', bytes: 400, needed: true });
  run((_ledger, i) => { for (const lease of leases[i]?.values() ?? []) lease?.release(); });
});


test.each([false, true])('pressure projection preserves covered bytes when the parent is selected first: %s', parentFirst => {
  const playing = CONTENT_CAPS.engineBase + CONTENT_CAPS.overlap + 1000;
  const ledgers = pair(playing, false), events = ledgers.map(() => [] as string[]);
  for (const [i, ledger] of ledgers.entries()) {
    const prepare = (id: string) => () => ({ commit: () => { events[i]?.push(id); }, abort: () => undefined });
    const parent = ledger.reserve({ id: 'parent', owner: 'test', category: 'sim', bytes: 400, needed: true,
      distance: parentFirst ? 40 : 10, prepareEvict: prepare('parent') });
    if (parent === null) throw new Error('Missing parent fixture');
    ledger.markMeasuredPage('parent');
    ledger.reserve({ id: 'child', owner: 'test', category: 'commons', bytes: 200, needed: false,
      distance: 30, coveredBy: 'parent', prepareEvict: prepare('child') });
    const page = ledger.reservePageComponent('page', 100, 50, 'parent');
    page?.update({ needed: false, distance: 20 });
    // Keep the page component after the parent: its calibration and charge become independent.
    parent.update({ needed: false });
    ledger.reserve({ id: 'pressure', owner: 'test', category: 'far', bytes: 600, needed: true, distance: 0 });
  }
  same(ledgers); expect(events[1]).toEqual(events[0]);
});

test('thousands of idle cache claims are not even prepared when pressure cannot fit', () => {
  const ledger = new ResidencyAllocator({ memory: new MemoryAdmission(() => true) });
  let prepares = 0, aborts = 0, commits = 0;
  const leases: LedgerLease[] = [];
  for (let index = 0; index < 4000; index++) {
    const lease = ledger.reserve({ id: `cache:${String(index)}`, owner: 'cache', category: 'commons', bytes: 1, needed: true, distance: index,
      prepareEvict: () => { prepares++; return { commit: () => { commits++; }, abort: () => { aborts++; } }; } });
    if (lease === null) throw new Error('Missing cache fixture');
    leases.push(lease);
  }
  for (const lease of leases) lease.update({ needed: false });
  const before = ledger.entries(), cost = ledger.cost();
  const pressure = ledger.reserve({ id: 'pressure', owner: 'other', category: 'sim', bytes: CONTENT_CAPS.playing, needed: true, distance: 0 });
  expect(pressure).not.toBeNull(); expect(prepares).toBe(0); expect(aborts).toBe(0); expect(commits).toBe(0);
  pressure?.release(); expect(ledger.entries()).toEqual(before); expect(ledger.cost()).toEqual(cost);
});

test('pressure planning rebases when an eviction preparation changes a live allocation', () => {
  const ledgers = pair(CONTENT_CAPS.engineBase + CONTENT_CAPS.overlap + 1000, false);
  const events = ledgers.map(() => [] as string[]);
  for (const [i, ledger] of ledgers.entries()) {
    const peer = ledger.reserve({ id: 'peer', owner: 'test', category: 'far', bytes: 200, needed: true, distance: 0 });
    ledger.reserve({ id: 'first', owner: 'test', category: 'far', bytes: 200, needed: false, distance: 2,
      prepareEvict: () => { peer?.release(); return { commit: () => { events[i]?.push('first'); }, abort: () => { events[i]?.push('abort'); } }; } });
    ledger.reserve({ id: 'pressure', owner: 'test', category: 'sim', bytes: 600, needed: true, distance: 0 });
  }
  same(ledgers); expect(events[1]).toEqual(events[0]);
});


test('evicting a parent also exposes the pending covered allocation', () => {
  const ledgers = pair(CONTENT_CAPS.engineBase + CONTENT_CAPS.overlap + Math.ceil(800 * CONTENT_CAPS.residentFactor));
  const events = ledgers.map(() => [] as string[]);
  for (const [i, ledger] of ledgers.entries()) {
    const parent = ledger.reserve({ id: 'parent', owner: 'parent', category: 'sim', bytes: 400, needed: true, distance: 1,
      prepareEvict: () => ({ commit: () => { events[i]?.push('commit'); }, abort: () => { events[i]?.push('abort'); } }) });
    ledger.reserve({ id: 'anchor', owner: 'other', category: 'far', bytes: 600, needed: true, distance: 0 });
    parent?.update({ needed: false });
    ledger.reserve({ id: 'pending', owner: 'parent', category: 'commons', bytes: 300, needed: true, distance: 0, coveredBy: 'parent' });
  }
  same(ledgers); expect(events[1]).toEqual(['abort']); expect(events[1]).toEqual(events[0]);
});
