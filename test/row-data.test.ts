// oxlint-disable-next-line import/no-nodejs-modules -- Reads the committed ratchet list.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STARTER_EFFECTS } from '@wildshard/sdk/runtime/effects';
import { compareRowFunctions, rowFunctions } from '../scripts/check-row-data.mjs';

// SHARD-PLATFORM SP3: content rows become data (MMO-REQUIREMENTS R1, S6). lint/row-functions.json lists the row fields
// that still hold a function or a class; it may only shrink.
const recorded = (JSON.parse(readFileSync('lint/row-functions.json', 'utf8')) as { fields: string[] }).fields;
const current = rowFunctions();
const dataModules = import.meta.glob<Record<string, unknown>>('../src/shards/*/data/**/*.{ts,tsx,json}', { eager: true });
function jsonRoundTrip(value: unknown): unknown {
  const encoded = JSON.stringify(value);
  return JSON.parse(encoded) as unknown;
}

describe('SP3 content rows are data', () => {
  it('inventories legacy manifest callbacks including compiled ground terrain', () => {
    expect(current).toContain('ShardManifest.load');
    expect(current).toContain('ShardManifest.ground.terrain.heightAt');
    expect(current).toContain('ShardManifest.ground.terrain.normalAt');
    const doc = JSON.parse(readFileSync('lint/row-functions.json', 'utf8')) as { provenance: Record<string, string> };
    expect(recorded.every((field) => doc.provenance[field] === 'legacy, pre-SF1')).toBe(true);
  });
  it('adds no function field to a row type, and keeps no stale entry', () => {
    expect(compareRowFunctions(recorded, current)).toEqual({ added: [], removed: [] });
  });
  it('keeps the rows that are already pure data free of functions', () => {
    const pure = ['AmmoRow', 'BossDef', 'DamageRuleDef', 'EffectDef', 'EliteDefinition', 'EncounterDefinition', 'InteractTable', 'QuestDef', 'StringTable'];
    expect(current.filter((path) => pure.some((type) => path === type || path.startsWith(`${type}.`) || path.startsWith(`${type}[`)))).toEqual([]);
  });
  it('round-trips a shipped pure-data row set through JSON unchanged', () => {
    // oxlint-disable-next-line unicorn/prefer-structured-clone -- The JSON round-trip is the property under test.
    expect(JSON.parse(JSON.stringify(STARTER_EFFECTS))).toEqual(STARTER_EFFECTS);
  });
  it('round-trips every export in every shard data folder as soon as files appear', () => {
    for (const [file, module] of Object.entries(dataModules)) {
      expect(Object.keys(module).length, file).toBeGreaterThan(0);
      for (const [name, value] of Object.entries(module)) expect(jsonRoundTrip(value), `${file}:${name}`).toStrictEqual(value);
    }
  });
  it('rejects data functions, class values and non-finite numbers instead of silently losing them', () => {
    const functional = { callback: () => 1 };
    expect(jsonRoundTrip(functional)).not.toEqual(functional);
    class NonData { value = 1; }
    const instance = new NonData();
    expect(jsonRoundTrip(instance)).not.toStrictEqual(instance);
    expect(jsonRoundTrip(new Date(0))).not.toEqual(new Date(0));
    expect(jsonRoundTrip({ value: Number.NaN })).not.toEqual({ value: Number.NaN });
    expect(() => jsonRoundTrip(undefined)).toThrow();
  });
  it('refuses a new field and asks to drop a field that became data', () => {
    expect(compareRowFunctions(['A.f'], ['A.f', 'B.g'])).toEqual({ added: ['B.g'], removed: [] });
    expect(compareRowFunctions(['A.f', 'B.g'], ['A.f'])).toEqual({ added: [], removed: ['B.g'] });
  });
});
