import { describe, expect, it } from 'vitest';
import { needsTerrainCollider, resolveTierKnobs } from '@wildshard/engine';
import manifest from '../../src/shards/nine-dragon-stack/manifest';
import { toLevelSpec } from '../../src/game/shard/spec';

describe('level render and ground policy', () => {
  it('resolves engine, kit and level tier knobs in that order', () => {
    const tiers = { phone: { ao: false, warmTurns: 0 } };
    expect(resolveTierKnobs({ ao: true, msaa: 0 }, { msaa: 2, warmTurns: 4 }, tiers, 'phone')).toEqual({ ao: false, msaa: 2, warmTurns: 0 });
    expect(resolveTierKnobs({ ao: true }, {}, tiers, 'desktop')).toEqual({ ao: true });
  });
  it('never adds terrain collision to a structure-first world, even when terrain is provided', () => {
    const spec = toLevelSpec(manifest);
    expect(spec.ground.terrain).toBeDefined(); expect(spec.ground.structures).toBe(true);
    if (spec.ground.terrain === undefined) throw new Error('Fixture has no terrain');
    expect(needsTerrainCollider(spec)).toBe(false);
    expect(needsTerrainCollider({ ground: { terrain: spec.ground.terrain } })).toBe(true);
    expect(needsTerrainCollider({ ground: {} })).toBe(false);
  });
});
