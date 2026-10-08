import type { ShardRuntime } from '../../../src/game/shard/runtime';
import type { ShardWorld as World } from '../../../src/game/shard/world';
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { driftwoodLoadoutRows, ironSwordDrop } from '../../../src/shards/driftwood-isle/loadout/rows';
import { ironSwordSite } from '../../../src/shards/driftwood-isle/weapons/IronSword';
import { SWORD_WOOD, SWORD_IRON } from '../../../src/game/weapons/starterMeleeProfile';

describe('Driftwood authored loadout (E357 S4.1 step 5)', () => {
  it('retains both profiles and the original pickup strings and saved key; no wreck means no pickup', () => {
    const shell: ShardRuntime = { world: null, step: null, play: null, interactables: [], overhead: [], hooks: {}, objects: {}, viewer: () => new Vector3(), horizonVeil: null };
    const rows = driftwoodLoadoutRows({} as World, shell), [wood, iron] = rows;
    expect(rows.map((r) => [r.id, r.legacySlot, r.damage, r.reach])).toEqual([
      ['weapon.sword', 'sword', 12, 2.2], ['weapon.sword-iron', 'sword-iron', 28, 2.2],
    ]);
    expect(wood.pickup).toBeUndefined();
    expect(wood).toEqual(SWORD_WOOD);
    const { pickup, ...profile } = iron;
    expect(profile).toEqual(SWORD_IRON); expect(pickup).toBeDefined();
    expect(iron.pickup).toMatchObject({ owned: 'iron-sword', prompt: 'Take iron sword', toast: 'Iron sword acquired · 1/2 to switch, Q to swap' });
    expect(iron.pickup?.create('wreck.deck', 'Take iron sword')).toBeNull();
    expect(ironSwordDrop(shell)).toBeNull();
    expect(() => iron.pickup?.create('absent.site', 'Take iron sword')).toThrow('Unknown iron sword pickup site');
  });

  it('keeps the original rack anchor and its 0.55 m offset into the hold', () => {
    const wreck = { anchors: { swordRack: { x: 12, y: 3, z: 4, yaw: Math.PI / 2 } }, floorHeightAt: () => undefined };
    const at = ironSwordSite(wreck, () => -999);
    expect(at.x).toBeCloseTo(12.55, 12); expect(at.y).toBe(3); expect(at.z).toBeCloseTo(4, 12);
  });

  it('keeps the original heeled-deck and sand fallback points', () => {
    const deck = ironSwordSite({ floorHeightAt: () => 1.45 }, () => -999);
    expect(deck.x).toBeCloseTo(155.427845996, 6);
    expect(deck.z).toBeCloseTo(-1.497937080, 6);
    expect(deck.y).toBe(1.45);
    const sand = ironSwordSite({ floorHeightAt: () => undefined }, () => 0.8);
    expect(sand.x).toBeCloseTo(149.202896997, 6);
    expect(sand.y).toBe(0.8);
    expect(sand.z).toBeCloseTo(0.205004503, 6);
  });
});
