import globalFixture from '../fixtures/saves/v2-global.json';
import driftFixture from '../fixtures/saves/v2-driftwood-isle.json';
import { describe, expect, it, vi } from 'vitest';
import * as v from 'valibot';
import { SaveStore, type SchemaFailure } from '../../src/engine/saves/store';
import { LEGACY_GAME_KEYS } from '../../src/engine/saves/legacy';
import { MemoryStorage } from '../setup';

const fixture = (): { local: MemoryStorage; session: MemoryStorage; store: SaveStore; report: ReturnType<typeof vi.fn<(failure: SchemaFailure) => void>> } => {
  const local = new MemoryStorage(), session = new MemoryStorage(), report = vi.fn<(failure: SchemaFailure) => void>();
  let tick = 0;
  const store = new SaveStore({ local, session, report, build: 'test-build', now: () => new Date(1_800_000_000_000 + tick++).toISOString() });
  return { local, session, store, report };
};
describe('SaveStore in node', () => {
  it('round-trips hidden shard namespaces and rejects path-like or embedded underscores', () => {
    const first = fixture(), second = fixture();
    const definition = { scope: 'shard', key: 'template.progress', version: 1, schema: v.number(), initial: () => 0 } as const;
    const slot = first.store.define(definition);
    slot.write(17, '_template');
    expect(slot.read('_template')).toBe(17);
    expect(slot.read('template')).toBe(0);
    const imported = second.store.importAll(first.store.exportAll());
    const restored = second.store.define(definition);
    // Register before importing: unknown save keys must remain rejected.
    expect(imported.imported).toEqual([]);
    expect(second.store.importAll(first.store.exportAll()).imported).toEqual(['_template/template.progress']);
    expect(restored.read('_template')).toBe(17);
    for (const slug of ['__template', 'bad_slug', '_', '../_template']) expect(() => slot.write(1, slug)).toThrow('Shard saves need a slug');
    expect(second.store.importAll('{"format":"wildshard.save","version":2,"docs":{"bad_slug":{"keys":{}}}}').skipped).toEqual([{ key: 'bad_slug', reason: 'Invalid or private scope' }]);
  });

  it('round-trips all four scopes and preserves unrelated keys and other namespaces', () => {
    const { store, local, session } = fixture();
    for (const scope of ['global', 'shard', 'device', 'session'] as const) {
      const slot = store.define({ scope, key: 'test', version: 1, schema: v.number(), initial: () => 0 });
      slot.write(7, scope === 'shard' ? 'pine-hollow' : undefined);
      expect(slot.read(scope === 'shard' ? 'pine-hollow' : undefined)).toBe(7);
      if (scope === 'shard') expect(slot.read('nalati-grasslands')).toBe(0);
    }
    expect(session.getItem('wildshard.save.v2.session')).toContain('"data":7');
    const raw: unknown = JSON.parse(local.getItem('wildshard.save.v2.global') ?? '{}');
    expect(raw).toEqual({ keys: { test: { v: 1, data: 7 } } });
    local.setItem('wildshard.save.v2.global', '{"keys":{"foreign":{"v":9,"data":"keep"}}}');
    store.define({ scope: 'global', key: 'second', version: 1, schema: v.string(), initial: () => '' }).write('ok');
    expect(local.getItem('wildshard.save.v2.global')).toContain('"foreign":{"v":9,"data":"keep"}');
  });
  it('keeps the reserved profile scope in its own document, exported and imported like global (SHARD-PLATFORM SP2)', () => {
    const first = fixture(), second = fixture();
    const definition = { scope: 'profile', key: 'profile.title', version: 1, schema: v.string(), initial: () => '' } as const;
    first.store.define(definition).write('Wayfarer');
    expect(first.local.getItem('wildshard.save.v2.profile')).toContain('"data":"Wayfarer"');
    expect(first.local.getItem('wildshard.save.v2.global') ?? '').not.toContain('Wayfarer');
    const restored = second.store.define(definition);
    expect(second.store.importAll(first.store.exportAll()).imported).toEqual(['profile/profile.title']);
    expect(restored.read()).toBe('Wayfarer');
    const level = first.store.define({ scope: 'shard', key: 'test', version: 1, schema: v.number(), initial: () => 0 });
    for (const reserved of ['global', 'profile', 'device', 'session']) expect(() => level.write(1, reserved)).toThrow('Shard saves need a slug');
  });
  it('migrates 1 → 2 → 3 in order, and writes the validated version back', () => {
    const { store, local } = fixture();
    local.setItem('wildshard.save.v2.global', '{"keys":{"chain":{"v":1,"data":2}}}');
    const slot = store.define({ scope: 'global', key: 'chain', version: 3, schema: v.object({ total: v.number() }), initial: () => ({ total: 0 }), migrate: { 1: (old) => ({ count: old }), 2: (old) => ({ total: v.parse(v.object({ count: v.number() }), old).count * 2 }) } });
    expect(slot.read()).toEqual({ total: 4 });
    expect(local.getItem('wildshard.save.v2.global')).toContain('"v":3');
  });
  it('keeps a future save byte-for-byte and read-only even on write/reset/import', () => {
    const { store, local } = fixture();
    const raw = '{"keys":{"future":{"v":99,"data":42}}}';
    local.setItem('wildshard.save.v2.global', raw);
    const slot = store.define({ scope: 'global', key: 'future', version: 1, schema: v.number(), initial: () => 0 });
    expect(slot.read()).toBe(0); slot.write(3); slot.reset();
    const imported = store.importAll('{"format":"wildshard.save","version":2,"docs":{"global":{"keys":{"future":{"v":1,"data":4}}}}}');
    expect(imported.skipped[0]?.reason).toContain('Newer'); expect(local.getItem('wildshard.save.v2.global')).toBe(raw);
  });
  it('resets gameplay keys only once, carries local/tab data, and calls the native forget hook', () => {
    const local = new MemoryStorage(), session = new MemoryStorage(), forgetLegacy = vi.fn<(keys: readonly string[]) => void>();
    for (const key of LEGACY_GAME_KEYS) local.setItem(key, '{}');
    local.setItem('ws.dev', '1'); local.setItem('ws.perf.probe', 'diagnostic'); local.setItem('ws.ota.bundle', 'ota');
    local.setItem('ws.ktx2set.pine-hollow.phone', 'hash'); local.setItem('ws.fold.debug', 'open');
    session.setItem('wsResumeShot', 'data:image/jpeg;base64,abc'); session.setItem('wsResumeBrand', '{"name":"Pine","hero":"x"}');
    const store = new SaveStore({ local, session, forgetLegacy }); store.exportAll();
    for (const key of LEGACY_GAME_KEYS) expect(local.getItem(key)).toBeNull();
    for (const key of ['ws.dev', 'ws.perf.probe', 'ws.ota.bundle']) expect(local.getItem(key)).not.toBeNull();
    expect(session.getItem('wsResumeShot')).toBe('data:image/jpeg;base64,abc');
    expect(JSON.parse(local.getItem('wildshard.save.v2.device') ?? '{}')).toMatchObject({ keys: { devMode: { data: true }, 'perf.probe': { data: 'diagnostic' }, ktx2set: { data: { 'pine-hollow.phone': 'hash' } } } });
    expect(forgetLegacy).toHaveBeenCalledWith(expect.arrayContaining(['ws.settings.v1']));
    local.setItem('ws.purse.v1', 'new'); new SaveStore({ local, session }).exportAll(); expect(local.getItem('ws.purse.v1')).toBe('new');
  });
  it('sets schema failures aside, defaults and reports once, retaining the newest three', () => {
    const { store, local, report } = fixture();
    local.setItem('wildshard.save.v2.global', '{"keys":{}}');
    const slot = store.define({ scope: 'global', key: 'coins', version: 1, schema: v.number(), initial: () => 0 });
    for (let i = 0; i < 4; i++) {
      const raw = JSON.parse(local.getItem('wildshard.save.v2.global') ?? '{}') as { keys: Record<string, unknown> };
      raw.keys['coins'] = { v: 1, data: `bad${i}` }; local.setItem('wildshard.save.v2.global', JSON.stringify(raw));
      expect(slot.read()).toBe(0); expect(slot.read()).toBe(0);
    }
    expect(report).toHaveBeenCalledTimes(4); expect(report.mock.lastCall?.[0]).toMatchObject({ kind: 'save-schema', scope: 'global', key: 'coins', version: 1 }); expect(report.mock.lastCall?.[0].issue).toContain('number');
    expect(store.corrupt()).toHaveLength(3); expect(store.exportCorrupt(store.corrupt()[0] ?? { scope: 'global', key: '*', at: '', bytes: 0 })).not.toContain('bad0');
  });
  it('backs up malformed whole documents, handles private-scope failures, and hides them from exports', () => {
    const { store, local, session, report } = fixture();
    local.setItem('wildshard.save.v2.global', 'garbage');
    const global = store.define({ scope: 'global', key: 'x', version: 1, schema: v.number(), initial: () => 0 });
    expect(global.read()).toBe(0); expect(store.corrupt()).toHaveLength(1);
    expect(store.exportCorrupt(store.corrupt()[0] ?? { scope: 'global', key: '*', at: '', bytes: 0 })).toBe('garbage');
    for (const scope of ['device', 'session'] as const) {
      const storage = scope === 'device' ? local : session;
      storage.setItem(`wildshard.save.v2.${scope}`, '{"keys":{"x":{"v":1,"data":"bad"}}}');
      expect(store.define({ scope, key: 'x', version: 1, schema: v.number(), initial: () => 0 }).read()).toBe(0);
    }
    expect(report).toHaveBeenCalledTimes(3); expect(store.corrupt()).toHaveLength(1);
    const exported = store.exportAll(); expect(exported).not.toContain('device'); expect(exported).not.toContain('session');
  });
  it('validates import keys, migrates old versions, and round-trips an export into a fresh store', () => {
    const first = fixture(), second = fixture();
    const definition = { scope: 'shard', key: 'purse', version: 2, schema: v.number(), initial: () => 0, migrate: { 1: (data: unknown) => v.parse(v.number(), data) + 1 } } as const;
    first.store.define(definition).write(37, 'driftwood-isle');
    const restored = second.store.define(definition);
    expect(second.store.importAll(first.store.exportAll())).toEqual({ imported: ['driftwood-isle/purse'], skipped: [] }); expect(restored.read('driftwood-isle')).toBe(37);
    const older = second.store.importAll('{"format":"wildshard.save","version":2,"docs":{"driftwood-isle":{"keys":{"purse":{"v":1,"data":4},"unknown":{"v":1,"data":2}}},"device":{"keys":{}}}}');
    expect(restored.read('driftwood-isle')).toBe(5); expect(older.skipped).toHaveLength(2);
    expect(second.store.importAll('bad').skipped).toHaveLength(1);
  });
  it('requests persistence once and records the result only on the device', async () => {
    const local = new MemoryStorage(), persist = vi.fn(() => Promise.resolve(true));
    const store = new SaveStore({ local, session: null, persist });
    expect(await store.persist()).toBe(true); expect(await store.persist()).toBe(true); expect(persist).toHaveBeenCalledTimes(1);
    expect(local.getItem('wildshard.save.v2.device')).toContain('"storage.persisted":{"v":1,"data":true}');
    expect(store.exportAll()).not.toContain('storage.persisted');
  });
});

it('loads the v2 fixture corpus and round-trips purse, owned and progress', () => {
  const first = fixture(), second = fixture();
  for (const f of [first, second]) {
    f.store.define({ scope: 'global', key: 'settings', version: 1, schema: v.record(v.string(), v.string()), initial: () => ({}) });
  }
  first.local.setItem('wildshard.save.v2.global', JSON.stringify(globalFixture));
  first.local.setItem('wildshard.save.v2.driftwood-isle', JSON.stringify(driftFixture));
  for (const key of ['purse', 'owned', 'progress']) {
    const schema = key === 'purse' ? v.number() : v.record(v.string(), v.unknown());
    first.store.define({ scope: 'shard', key, version: 1, schema, initial: () => key === 'purse' ? 0 : {} });
    second.store.define({ scope: 'shard', key, version: 1, schema, initial: () => key === 'purse' ? 0 : {} });
  }
  const report = second.store.importAll(first.store.exportAll());
  expect(report.imported).toEqual(expect.arrayContaining(['driftwood-isle/purse', 'driftwood-isle/owned', 'driftwood-isle/progress']));
  expect(second.local.getItem('wildshard.save.v2.driftwood-isle')).toBe(first.local.getItem('wildshard.save.v2.driftwood-isle')?.trim());
});

it('keeps distinct aside copies even when corrupt reads happen within one millisecond', () => {
  const local = new MemoryStorage(); local.setItem('wildshard.save.v2.global', '{"keys":{}}');
  const store = new SaveStore({ local, session: null, now: () => '2026-10-01T00:00:00.000Z' });
  const slot = store.define({ scope: 'global', key: 'x', version: 1, schema: v.number(), initial: () => 0 });
  for (let n = 0; n < 4; n++) {
    const doc = JSON.parse(local.getItem('wildshard.save.v2.global') ?? '{}') as { keys: Record<string, unknown> };
    doc.keys['x'] = { v: 1, data: `bad${n}` }; local.setItem('wildshard.save.v2.global', JSON.stringify(doc)); slot.read();
  }
  expect(store.corrupt()).toHaveLength(3);
  expect(new Set(store.corrupt().map((copy) => copy.at)).size).toBe(3);
});
it('reports an import quota failure instead of offering a reload that would lose it', () => {
  const local = new MemoryStorage(); local.setItem('wildshard.save.v2.global', '{"keys":{}}');
  const store = new SaveStore({ local, session: null });
  const slot = store.define({ scope: 'global', key: 'x', version: 1, schema: v.number(), initial: () => 0 });
  vi.spyOn(local, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
  const report = store.importAll('{"format":"wildshard.save","version":2,"docs":{"global":{"keys":{"x":{"v":1,"data":7}}}}}');
  expect(report.imported).toEqual([]); expect(report.skipped[0]?.reason).toContain('Storage unavailable'); expect(slot.read()).toBe(7);
});
