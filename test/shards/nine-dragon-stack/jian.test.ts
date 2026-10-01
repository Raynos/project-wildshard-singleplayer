import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SWORD_WOOD } from '#kit';
import { JIAN_ROW } from '#shards/nine-dragon-stack/vm/jianRow';
import { jianArms } from '#shards/nine-dragon-stack/vm/arms';
import { jianSword } from '#shards/nine-dragon-stack/world/jian';

vi.mock('#shards/nine-dragon-stack/vm/arms', () => ({ jianArms: vi.fn() }));
vi.mock('#shards/nine-dragon-stack/world/jian', () => ({ jianSword: vi.fn() }));
afterEach(() => { vi.restoreAllMocks(); });
describe('Nine Dragon authored Jian row', () => {
  it('uses the skinned rig when loading succeeds', async () => {
    const rig = { arms: { root: new THREE.Group(), play: () => undefined, update: () => undefined,
      blade: () => undefined, engineTrail: false } };
    vi.mocked(jianArms).mockResolvedValueOnce(rig);
    expect(await JIAN_ROW.viewmodel()).toBe(rig); expect(jianSword).not.toHaveBeenCalled();
  });
  it('uses the static jian when the rig load rejects', async () => {
    const fallback = { rig: { sword: new THREE.BufferGeometry(), arms: new THREE.BufferGeometry(),
      material: new THREE.MeshBasicMaterial(), tipY: 1, baseY: 0 } };
    vi.mocked(jianArms).mockRejectedValueOnce(new Error('missing rig'));
    vi.mocked(jianSword).mockResolvedValueOnce(fallback);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await JIAN_ROW.viewmodel()).toBe(fallback); expect(warn).toHaveBeenCalledOnce();
  });
  it('has explicit damage12 and inherits light/heavy clocks, lock-on and assets', () => {
    expect(JIAN_ROW.damage).toBe(12); expect(JIAN_ROW.parent).toBe(SWORD_WOOD.id);
    expect(JIAN_ROW.moves).toBe(SWORD_WOOD.moves); expect(JIAN_ROW.ui.lockOn).toBe(true);
    expect(JIAN_ROW.feel.portraitFov).toBe(78); expect(JIAN_ROW.assets).toHaveLength(9);
  });
});
