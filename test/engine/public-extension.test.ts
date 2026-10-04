import { describe, expect, it } from 'vitest';
import { blocks } from '../../src/engine/blocks';
import { melee } from '../../src/engine/combat/blocks/melee';
import type { WeaponId } from '../../src/engine/combat/Equipment';
import type { Action } from '../../src/engine/input/InputService';
import { resolveTierKnobs, type TierKnobs } from '../../src/engine/level/spec';
import { viewmodel } from '../../src/engine/render/viewmodelFeel';
import { WorldRegistry } from '../../src/engine/world/registry';

declare module '../../src/engine/level/spec' {
  interface TierKnobMap { 'contract.propCount': number }
}
declare module '../../src/engine/input/InputService' {
  interface ActionMap { 'contract.lantern.toggle': true }
}
declare module '../../src/engine/combat/Equipment' {
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
