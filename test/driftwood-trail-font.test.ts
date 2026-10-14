import { expect, it } from 'vitest';
import { type BufferGeometry, MeshStandardMaterial } from 'three';
import { Rng } from '../src/engine/core/rng';
import { modelContext, type ModelBuild, type ModelPart } from '../src/engine/models/model';
import { trailFontFacts } from '../src/shards/driftwood-isle/generators/trailFont';
import { signpost } from '../src/shards/driftwood-isle/models/trailside';

it('composes readable trail signs from quad runs while leaving unsupported characters blank', () => {
  const font = trailFontFacts();
  expect(font['H']).toBeDefined();
  expect(font[' ']).toBeUndefined();
  const ctx = modelContext(null);
  const material = new MeshStandardMaterial();
  ctx.once('driftwood-isle/trail:material', () => material);
  const isParts = (parts: ModelBuild): parts is readonly ModelPart[] => Array.isArray(parts);
  const geometry = (label: string): BufferGeometry => {
    const parts = signpost.build(ctx, { arrows: [0], labels: [label] }, new Rng(31));
    if (!isParts(parts) || parts[0] === undefined) throw new Error('Sign geometry absent');
    return parts[0].geometry;
  };
  const blank = geometry('   '), word = geometry('HUT'), mixed = geometry('h?t');
  try {
    expect(word.getAttribute('position').count).toBeGreaterThan(blank.getAttribute('position').count);
    expect(mixed.getAttribute('position').count).toBeGreaterThan(blank.getAttribute('position').count);
    expect(mixed.getAttribute('position').count).toBeLessThan(word.getAttribute('position').count);
    for (const g of [blank, word, mixed]) for (const value of g.getAttribute('position').array) expect(Number.isFinite(value)).toBe(true);
  } finally { blank.dispose(); word.dispose(); mixed.dispose(); material.dispose(); }
});
