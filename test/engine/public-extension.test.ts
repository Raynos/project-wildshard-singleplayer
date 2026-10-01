import { describe, expect, it } from 'vitest';
import { blocks, melee, viewmodel, resolveTierKnobs, WorldRegistry, type Action, type TierKnobs, type WeaponId } from '#engine';

declare module '#engine' {
  interface TierKnobMap { 'contract.propCount': number }
  interface ActionMap { 'contract.lantern.toggle': true }
  interface EquipmentSlotMap { 'contract-whip': true }
}

describe('public shard extension contracts', () => {
  it('preserves typed custom knobs across the engine, kit and level override layers', () => {
    const defaults: TierKnobs = { 'contract.propCount': 5 };
    const resolved = resolveTierKnobs(defaults, { 'contract.propCount': 10 }, { desktop: { 'contract.propCount': 20 } }, 'desktop');
    const count: number | undefined = resolved['contract.propCount'];
    expect(count).toBe(20);
    const action: Action = 'contract.lantern.toggle';
    const slot: WeaponId = 'contract-whip';
    expect(action).toBe('contract.lantern.toggle'); expect(slot).toBe('contract-whip');
  });
  it('exposes existing combat blocks and a node-safe world registry constructor', () => {
    expect(blocks.melee).toBe(melee); expect(blocks.viewmodel).toBe(viewmodel);
    expect(new WorldRegistry()).toBeInstanceOf(WorldRegistry);
  });
});
