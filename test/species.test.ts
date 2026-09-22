// src/entities/species/* — the registry contract every huntable species file must satisfy, and the seeded variant roll.
import { describe, expect, it } from 'vitest';
import { loadSpecies } from './species';
import { RARITY_ORDER, hasSpecies, rollVariant, speciesDef, speciesKinds, variantDef, variantMods, type SpeciesDef } from '../src/entities/species/registry';
import { Rng } from '../src/core/rng';

loadSpecies();
const ALL = (): SpeciesDef[] => speciesKinds().map(speciesDef);

describe('species registry', () => {
  it('registers every species file in the folder', () => {
    for (const k of ['deer', 'boar', 'elk', 'bear', 'crab', 'monkey', 'sailor']) expect(hasSpecies(k), k).toBe(true);
    expect(() => speciesDef('dragon')).toThrow(/unknown animal kind/);
  });

  it('every variant table is well-formed: unique ids, positive weights, a known rarity, a sane scale range and hp', () => {
    for (const s of ALL()) {
      expect(s.variants.length, s.kind).toBeGreaterThan(0);
      expect(new Set(s.variants.map((v) => v.id)).size, s.kind).toBe(s.variants.length);
      for (const v of s.variants) {
        const at = `${s.kind}/${v.id}`;
        expect(v.label.length, at).toBeGreaterThan(0);
        expect(v.weight, at).toBeGreaterThan(0);
        expect(RARITY_ORDER, at).toContain(v.rarity);
        expect(v.scale[0], at).toBeGreaterThan(0);
        expect(v.scale[0], at).toBeLessThanOrEqual(v.scale[1]);
        if (v.hp !== undefined) expect(v.hp, at).toBeGreaterThan(0);
        for (const m of [v.mods?.speed, v.mods?.chargeDist, v.mods?.damageTaken]) if (m !== undefined) expect(m, at).toBeGreaterThan(0);
      }
    }
  });

  it('the first variant (the fallback) is a common-or-uncommon one, and legendaries are the rarest roll', () => {
    for (const s of ALL()) {
      const first = s.variants[0];
      expect(first?.rarity === 'common' || first?.rarity === 'uncommon', s.kind).toBe(true);
      const legend = s.variants.filter((v) => v.rarity === 'legendary');
      const minOther = Math.min(...s.variants.filter((v) => v.rarity !== 'legendary').map((v) => v.weight));
      for (const l of legend) expect(l.weight, `${s.kind}/${l.id}`).toBeLessThanOrEqual(minOther);
    }
  });

  it('custom rigs supply their own animate()', () => {
    for (const s of ALL()) if (s.rig === 'custom') expect(typeof s.animate, s.kind).toBe('function');
  });

  it('variantDef falls back to the first variant for unknown / empty ids', () => {
    expect(variantDef('boar', 'ironhide').id).toBe('ironhide');
    expect(variantDef('boar', 'nope').id).toBe(speciesDef('boar').variants[0]?.id);
    expect(variantDef('deer', '').id).toBe(speciesDef('deer').variants[0]?.id);
    expect(variantDef('deer', undefined).id).toBe(speciesDef('deer').variants[0]?.id);
  });

  it('variantMods fills the defaults (1s, species charge damage or 25)', () => {
    const deer = speciesDef('deer');
    const hind = variantDef('deer', 'hind');
    expect(variantMods(deer, hind)).toEqual({ speed: 1, chargeDist: 1, damageTaken: 1, chargeDamage: deer.chargeDamage ?? 25, relentless: false });
    const ghost = variantDef('deer', 'ghost');
    expect(variantMods(deer, ghost).speed).toBe(1.25);
  });
});

describe('rollVariant', () => {
  it('is deterministic for a seed', () => {
    const boar = speciesDef('boar');
    const roll = (seed: number) => { const r = new Rng(seed); return Array.from({ length: 50 }, () => rollVariant(boar, r).id); };
    expect(roll(77)).toEqual(roll(77));
  });

  it('follows the weight table', () => {
    const deer = speciesDef('deer');
    const r = new Rng(2024);
    const n = 40_000;
    const hits = new Map<string, number>();
    for (let i = 0; i < n; i++) { const id = rollVariant(deer, r).id; hits.set(id, (hits.get(id) ?? 0) + 1); }
    const total = deer.variants.reduce((s, v) => s + v.weight, 0);
    for (const v of deer.variants) expect((hits.get(v.id) ?? 0) / n, v.id).toBeCloseTo(v.weight / total, 1);
  });

  it('respects an allowed list, and ignores one that matches nothing', () => {
    const bear = speciesDef('bear');
    const r = new Rng(5);
    for (let i = 0; i < 200; i++) expect(['brown', 'brown-old']).toContain(rollVariant(bear, r, ['brown', 'brown-old']).id);
    const ids = new Set(Array.from({ length: 400 }, () => rollVariant(bear, r, ['polar']).id));
    expect(ids.size).toBeGreaterThan(1);
  });

  it('excludeLegendary never yields a legendary', () => {
    for (const s of ALL()) {
      const r = new Rng(13);
      for (let i = 0; i < 500; i++) expect(rollVariant(s, r, undefined, true).rarity, s.kind).not.toBe('legendary');
    }
  });

  it('excludeLegendary with only a legendary allowed still returns it (nothing else to give)', () => {
    const boar = speciesDef('boar');
    expect(rollVariant(boar, new Rng(1), ['ironhide'], true).id).toBe('ironhide');
  });
});
