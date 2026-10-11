import { describe, expect, it } from 'vitest';
import { strike } from '@wildshard/sdk/species';
import { NALATI_STRIKE_ROWS } from '../../../src/shards/nalati-grasslands/data/strikeProfiles';
import { NALATI_STRIKES } from '../../../src/shards/nalati-grasslands/combat/strikes';

describe('Nalati authored contact profiles', () => {
  it('admits every finite contact while preserving clock, damage, shape and motion fields', () => {
    for (const [key, value] of Object.entries(NALATI_STRIKE_ROWS)) {
      const rows = Array.isArray(value) ? value : [value];
      for (const row of rows) {
        expect(strike(row)).toEqual(row);
        expect(row.range).toBeNull(); expect(row.weight).toEqual({ kind: 'constant', value: 1 });
      }
      expect(key).not.toBe('fire'); expect(key).not.toBe('wall');
    }
    expect(NALATI_STRIKES.balbal.windup).toBe(2.9 * 0.55);
    expect(NALATI_STRIKES.balbal.recover).toBe(2.9 * 0.45);
    expect(NALATI_STRIKES.bite.windup).toBe(0.9 * 0.7);
    expect(NALATI_STRIKES.cuts.map(r => [r.id, r.damage, r.windup, r.shape])).toEqual([
      ['strike.golden-king.cut0', 14, 0.95 * 0.62, { kind: 'arc', radius: 3, halfAngle: 0.95 }],
      ['strike.golden-king.cut1', 14, 0.95 * 0.62, { kind: 'arc', radius: 3, halfAngle: 0.95 }],
      ['strike.golden-king.cut2', 22, 0.95 * 0.62, { kind: 'arc', radius: 3.3, halfAngle: 1.35 }],
      ['strike.golden-king.cut3', 22, 0.95 * 0.62, { kind: 'arc', radius: 3.3, halfAngle: 1.35 }],
    ]);
    expect(NALATI_STRIKES.arrow.motion).toEqual({ speed: 34 });
    expect(NALATI_STRIKES.sunburst.tags).toEqual(['cover.exempt']);
  });
  it('keeps the existing unbounded Titan arena contacts outside the finite schema', () => {
    expect(NALATI_STRIKES.fire.shape).toEqual({ kind: 'point', radius: Infinity, exclusive: true });
    expect(NALATI_STRIKES.wall.shape).toEqual({ kind: 'point', radius: Infinity, exclusive: true });
    expect(NALATI_STRIKES.fire.cooldown).toBe(0.5); expect(NALATI_STRIKES.wall.cooldown).toBe(1.2);
  });
});
