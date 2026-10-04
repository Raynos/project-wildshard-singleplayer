import { describe, expect, it } from 'vitest';
import { ACCENTS, ACCENT_IDS, ROAD_ACCENT, accentVars, parseAccent } from '../src/game/shardfile/accent';

describe('G104 HUD accents', () => {
  it('has the 20 palette accents and keeps the road cyan out of them', () => {
    expect(ACCENT_IDS).toHaveLength(20);
    expect(Object.values(ACCENTS)).not.toContain(ROAD_ACCENT);
    expect(ACCENTS.marigold).toBe('#fbbb2d');
    expect(ACCENTS.sand).toBe('#beaf91');
  });
  it('validates a declared accent and refuses the reserved road cyan', () => {
    expect(parseAccent('moss')).toBe('moss');
    expect(() => parseAccent('cyan')).toThrow(/reserved/u);
    expect(() => parseAccent('#8fe3ff')).toThrow(/reserved/u);
    expect(() => parseAccent('sky')).toThrow(/20 HUD accents/u);
    expect(() => parseAccent(5)).toThrow();
  });
  it('derives the HUD accent variables', () => {
    expect(accentVars('#fbbb2d')).toEqual({ '--ws-cyan': '#fbbb2d', '--ws-cyan-dim': 'rgba(251, 187, 45, 0.55)', '--ws-cyan-line': 'rgba(251, 187, 45, 0.35)', '--ws-cyan-faint': 'rgba(251, 187, 45, 0.14)' });
  });
});
