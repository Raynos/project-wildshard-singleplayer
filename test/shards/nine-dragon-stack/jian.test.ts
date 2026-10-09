import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SWORD_WOOD } from '../../../src/game/weapons/starterMeleeProfile';
import type { ShardSword } from '../../../src/game/shard/manifest';
import { JIAN_ROW, jianViewmodel } from '../../../src/shards/nine-dragon-stack/vm/jianRow';

afterEach(() => { vi.restoreAllMocks(); });
describe('Nine Dragon authored Jian row', () => {
  it('uses the skinned rig when loading succeeds', async () => {
    const rig = { arms: { root: new THREE.Group(), play: () => undefined, update: () => undefined,
      blade: () => undefined, engineTrail: false } };
    // the loaders are passed in, not mocked modules (E422)
    const sword = vi.fn<() => Promise<ShardSword>>();
    expect(await jianViewmodel({ arms: () => Promise.resolve(rig), sword })).toBe(rig); expect(sword).not.toHaveBeenCalled();
  });
  it('uses the static jian when the rig load rejects', async () => {
    const fallback = { rig: { sword: new THREE.BufferGeometry(), arms: new THREE.BufferGeometry(),
      material: new THREE.MeshBasicMaterial(), tipY: 1, baseY: 0 } };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await jianViewmodel({ arms: () => Promise.reject(new Error('missing rig')), sword: () => Promise.resolve(fallback) })).toBe(fallback);
    expect(warn).toHaveBeenCalledOnce();
  });
  it('has explicit damage12 and inherits light/heavy clocks, lock-on and assets', () => {
    expect(JIAN_ROW.damage).toBe(12); expect(JIAN_ROW.parent).toBe(SWORD_WOOD.id);
    expect(JIAN_ROW.moves).toBe(SWORD_WOOD.moves); expect(JIAN_ROW.ui.lockOn).toBe(true);
    expect(JIAN_ROW.feel.portraitFov).toBe(78); expect(JIAN_ROW.assets).toHaveLength(9);
  });
});
