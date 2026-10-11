import { describe, expect, it } from 'vitest';
import { parseGroupBrain, nativeGroupBrain, groupBrainRules } from '@wildshard/format/groupBrains';
import { groupBrain } from '../src/sdk/groupBrains';
import { NALATI_PACK_BRAIN, NALATI_HERD_BRAIN } from '../src/shards/nalati-grasslands/data/brains';

const pack = { ...NALATI_PACK_BRAIN, members: ['actor.alpha', 'actor.flank'], home: [0, 0] };
const herd = { ...NALATI_HERD_BRAIN, members: ['actor.mare', 'actor.foal', 'actor.stallion'] };
const spawns = [...pack.members.map(id => ({ id, brain: pack.id })), ...herd.members.map(id => ({ id, brain: herd.id }))];
describe('group brain declarations', () => {
  it('admits the shipping policy and stable ordered rosters through the SDK', () => {
    expect(groupBrain(pack)).toEqual(pack); expect(parseGroupBrain(herd)).toEqual(herd);
    expect(groupBrainRules([pack, herd], spawns, ['brain.other'])).toEqual([]);
  });
  it('admits parametric group presets and preserves native tuning/continuation field order exactly', () => {
    const stalker = { ...pack, kind: 'stalker', pattern: 'pack' }, grazer = { ...herd, kind: 'grazer', pattern: 'herd' };
    expect(groupBrain(stalker)).toEqual(stalker); expect(groupBrain(grazer)).toEqual(grazer);
    expect(JSON.stringify(nativeGroupBrain(stalker))).toBe(JSON.stringify(parseGroupBrain(pack)));
    expect(JSON.stringify(nativeGroupBrain(grazer))).toBe(JSON.stringify(parseGroupBrain(herd)));
    for (const invalid of [{ ...stalker, pattern: 'herd' }, { ...grazer, pattern: 'pack' }, { ...stalker, pattern: undefined },
      { ...grazer, gallopSpeed: Infinity }, { ...stalker, members: [] }]) expect(() => groupBrain(invalid)).toThrow();
  });
  it.each([
    { ...pack, members: [] }, { ...pack, members: ['actor.alpha', 'actor.alpha'] },
    { ...pack, runSpeed: Number.NaN }, { ...pack, runSpeed: 16 }, { ...pack, thinkDivisor: 3 },
    { ...pack, hearing: [30, 16, 8, 4] }, { ...pack, home: [251, 0] },
    { ...herd, alertThreshold: 0 }, { ...herd, flightMaxDistance: 50 }, { ...herd, unsupported: 1 },
  ])('refuses incompatible tuning or roster before world allocation', row => {
    expect(() => parseGroupBrain(row)).toThrow();
  });
  it('refuses missing, overlapping, individual-controlled or encounter members', () => {
    expect(groupBrainRules([pack], spawns, [pack.id])).toContain('unique controller ids');
    expect(groupBrainRules([{ ...pack, members: ['missing'] }], spawns)).toContain('exclusive declared group members');
    expect(groupBrainRules([pack, { ...herd, members: pack.members }], spawns)).toContain('exclusive declared group members');
    expect(groupBrainRules([pack], spawns, [], ['actor.alpha'])).toContain('exclusive declared group members');
    expect(groupBrainRules([{ ...pack, members: [...pack.members].reverse() }], spawns)).toContain('exact ordered group roster');
    expect(groupBrainRules([pack], spawns.map(row => row.id === 'actor.alpha' ? { id: row.id, brain: 'brain.individual' } : row))).toContain('exact ordered group roster');
  });
});
