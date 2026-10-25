import { expect, test } from 'vitest';
import { bakeSandSourceFiles } from '../src/shards/sunscar-dunes/generators/sandProgram';
import { signalSandMetadata } from '../src/shards/sunscar-dunes/generators/sandMetadata';

const files = bakeSandSourceFiles();
const json = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));

test('sand metadata decoding owns means and each map row on every call', () => {
  const first = signalSandMetadata(files), second = signalSandMetadata(files);
  first.maps.grain.dependencies.push('changed');
  expect(second.maps.grain.dependencies).toEqual([]);
  expect(first.means === second.means).toBe(false);
  expect(first.maps.grain === second.maps.grain).toBe(false);
});

test('sand metadata refuses missing, oversized, malformed and invalid UTF-8 documents', () => {
  for (const bytes of [new Uint8Array(), new Uint8Array(4097), new Uint8Array([0xff]), json(null), json([])]) {
    for (const name of ['sand.json', 'sandMaps.json']) {
      const changed = new Map(files); changed.set(name, bytes);
      expect(() => signalSandMetadata(changed)).toThrow();
    }
  }
  const changed = new Map(files); changed.delete('sand.json');
  expect(() => signalSandMetadata(changed)).toThrow('Missing or oversized sand metadata');
});

test('sand means refuse unknown fields, missing numbers and out-of-range grain values', () => {
  for (const means of [{ meanR: 0.5 }, { meanR: 0.5, meanGlint: 0, other: 1 },
    { meanR: '0.5', meanGlint: 0 }, { meanR: -0.1, meanGlint: 0 },
    { meanR: 1.1, meanGlint: 0 }, { meanR: 0.5, meanGlint: 1.1 }]) {
    const changed = new Map(files); changed.set('sand.json', json(means));
    expect(() => signalSandMetadata(changed)).toThrow('Invalid sand metadata');
  }
});

test('sand map costs cannot differ from the actual owned texture', () => {
  for (const field of ['compressed', 'decoded', 'gpu', 'triangles', 'draws', 'critical', 'dependencies']) {
    const maps = signalSandMetadata(files).maps;
    const grain: Record<string, unknown> = Object.fromEntries(Object.entries(maps.grain));
    grain[field] = field === 'critical' ? true : field === 'dependencies' ? ['other'] : -1;
    const changed = new Map(files); changed.set('sandMaps.json', json({ ...maps, grain }));
    expect(() => signalSandMetadata(changed)).toThrow('Sand map costs differ');
  }
});

test('sand maps refuse missing, changed and reused texture references', () => {
  const maps = signalSandMetadata(files).maps, hash = maps.grain.hash;
  const missing = new Map(files); missing.delete(`assets/${hash}`);
  expect(() => signalSandMetadata(missing)).toThrow('Sand map bytes differ');
  const changed = new Map(files); changed.set(`assets/${hash}`, new Uint8Array([1]));
  expect(() => signalSandMetadata(changed)).toThrow('Sand map bytes differ');
  const alias = new Map(files); alias.set('sandMaps.json', json({ ...maps, trail: maps.grain }));
  expect(() => signalSandMetadata(alias)).toThrow('Sand map bytes differ');
  for (const value of [{ grain: maps.grain }, { ...maps, other: maps.grain }, { ...maps, grain: { hash: '../escape' } }]) {
    const invalid = new Map(files); invalid.set('sandMaps.json', json(value));
    expect(() => signalSandMetadata(invalid)).toThrow();
  }
});
