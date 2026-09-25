// PH-B4: the Blender species set (scripts/blender/trees/) and the game's placement agree, stay in budget, and plant by zone.
import { describe, expect, it } from 'vitest';
import { setActiveChunk, getActiveChunk } from '../src/chunks/registry';
import { placeForest, plantSpecs, treeSetOf, TREE_SPECS, TREE_SPECS_V2 } from '../src/world/placement';
import { KINGS_CLEARING, OLD_GROWTH } from '../src/chunks/pineHollowLayout';
import setJson from '../public/assets/models/pine-hollow-trees/trees.json?raw';

interface SetMeta { variants: { name: string; species: string; height: number; trunk: number; tris: Record<string, number> }[] }
const meta = JSON.parse(setJson) as SetMeta;

describe('the species set', () => {
  it('trees.json lists TREE_SPECS_V2, in order (the GLB meshes are found by these names)', () => {
    expect(meta.variants.map((v) => [v.name, v.species, v.height, v.trunk])).toEqual(TREE_SPECS_V2.map((s) => [s.name, s.species, s.height, s.trunk]));
  });

  it('every LOD part is in its triangle budget', () => {
    for (const v of meta.variants) {
      const t = v.tris;
      const hi = (t['trunk'] ?? 0) + (t['hi'] ?? 0), lo = (t['trunkLo'] ?? 0) + (t['lo'] ?? 0);
      expect(hi, v.name).toBeLessThanOrEqual(v.species === 'giant' ? 8000 : 4500);
      expect(lo, v.name).toBeLessThanOrEqual(v.species === 'giant' ? 2200 : 1200);
      expect(t['far'], v.name).toBe(4);
      expect(t['hi'] ?? 0, `${v.name} has cards`).toBeGreaterThan(0);
    }
  });

  it('the giants are 4–6× the pines’ girth', () => {
    const pine = TREE_SPECS_V2.filter((s) => s.species === 'pine').reduce((a, s) => Math.max(a, s.trunk), 0);
    for (const g of TREE_SPECS_V2.filter((s) => s.species === 'giant')) {
      expect(g.trunk / pine).toBeGreaterThanOrEqual(4);
      expect(g.trunk / pine).toBeLessThanOrEqual(6);
    }
  });
});

describe('planting by zone', () => {
  setActiveChunk('pine-hollow');
  const def = getActiveChunk();

  it('Pine Hollow plants the set by default; the runtime pines are the fallback', () => {
    expect(treeSetOf(def.trees)).toBe('pine-hollow-trees');
    expect(plantSpecs(def.trees)).toHaveLength(TREE_SPECS_V2.length);
    expect(plantSpecs({ factory: 'pine' })).toHaveLength(TREE_SPECS.length);
    expect(plantSpecs({ factory: 'none', set: 'x' })).toHaveLength(0);
  });

  it('every species grows; the giants only in the old-growth; no trunk inside another', () => {
    const { trees } = placeForest(plantSpecs(def.trees));
    const by = new Map<string, number>();
    for (const t of trees) by.set(t.species ?? '?', (by.get(t.species ?? '?') ?? 0) + 1);
    for (const s of ['pine', 'fir', 'giant', 'birch', 'snag', 'sapling']) expect(by.get(s) ?? 0, s).toBeGreaterThan(5);
    expect(by.get('pine') ?? 0).toBeGreaterThan(trees.length * 0.35);
    for (const t of trees.filter((x) => x.species === 'giant')) {
      const e = Math.hypot((t.x - OLD_GROWTH.x) / OLD_GROWTH.ax, (t.z - OLD_GROWTH.z) / OLD_GROWTH.az);
      const ring = Math.hypot(t.x - KINGS_CLEARING.x, t.z - KINGS_CLEARING.z);
      expect(e < 1.05 || ring < KINGS_CLEARING.clear + 45, `giant at ${t.x.toFixed(0)}, ${t.z.toFixed(0)}`).toBe(true);
    }
    for (let i = 0; i < trees.length; i++) {
      const a = trees[i];
      if (!a) continue;
      for (let j = i + 1; j < trees.length; j++) {
        const b = trees[j];
        if (!b || Math.abs(a.x - b.x) > 12 || Math.abs(a.z - b.z) > 12) continue;
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(a.r + b.r);
      }
    }
  });
});
