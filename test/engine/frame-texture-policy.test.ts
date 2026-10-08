import { afterEach, expect, it } from 'vitest';
import { App } from '../../src/engine/app/app';
import { Scope } from '../../src/engine/app/scope';
import { TexturePolicyBinding, registerGpuFiles, setTexturePolicy, texMode, gpuFile } from '../../src/engine/boot/gpuFiles';
import { initializeTier } from '../../src/engine/core/tier';
import { LevelFrameBinding } from '../../src/engine/level/frame';
import { saveSetting } from '../../src/engine/ui/Settings';
import { WaterBodies } from '../../src/engine/world/water/body';
import { toLevelSpec } from '../../src/game/shard/spec';
import { TEMPLATE } from '../../src/shards/_template/manifest';

afterEach(() => { saveSetting('tex', 'auto'); setTexturePolicy(undefined); });

it('routes destination overlays under its measured phone policy and restores the resolved home on leave', () => {
  initializeTier('phone'); saveSetting('tex', 'auto'); setTexturePolicy('img', 'home');
  registerGpuFiles({ phone: { '/assets/frame-fixture.webp': '/assets/frame-fixture.ktx2' }, desktop: {} });
  expect(texMode()).toBe('img');
  const app = new App(), resident = new Scope('region'), entered = new Scope('entered');
  const textures = new TexturePolicyBinding(undefined, 'region', 1_000_000_001);
  const frame = new LevelFrameBinding({ level: { ...toLevelSpec(TEMPLATE), id: 'region' }, scope: resident,
    navmesh: null, water: new WaterBodies(), textures });
  try {
    frame.run(app, () => { expect(texMode()).toBe('ktx2'); expect(gpuFile('/assets/frame-fixture.webp')).toBe('/assets/frame-fixture.ktx2'); });
    expect(texMode()).toBe('img');
    frame.enter(app, entered); expect(texMode()).toBe('ktx2');
    entered.dispose(); expect(texMode()).toBe('img'); expect(gpuFile('/assets/frame-fixture.webp')).toBeUndefined();
  } finally { entered.dispose(); resident.dispose(); }
});

it('keeps nested residents independent in either leave order and preserves each resolved choice on reentry', () => {
  initializeTier('phone'); saveSetting('tex', 'auto'); setTexturePolicy('img', 'home');
  const a = new TexturePolicyBinding(undefined, 'a', 1_000_000_001), b = new TexturePolicyBinding('img', 'b');
  const leaveA = a.enter(); expect(texMode()).toBe('ktx2');
  const leaveB = b.enter(); expect(texMode()).toBe('img');
  leaveA(); expect(texMode()).toBe('img'); leaveA();
  leaveB(); expect(texMode()).toBe('img');
  const again = a.enter(); expect(texMode()).toBe('ktx2'); again(); expect(texMode()).toBe('img');
});

it.each(['img', 'ktx2'] as const)('preserves the explicit %s Debug pick over a regional measured estimate', picked => {
  initializeTier('phone'); saveSetting('tex', picked); setTexturePolicy(undefined, 'home');
  const leave = new TexturePolicyBinding(undefined, 'region', 2_000_000_000).enter();
  try { expect(texMode()).toBe(picked); } finally { leave(); }
  expect(texMode()).toBe(picked);
});

it('keeps desktop Auto unchanged by a measured phone estimate', () => {
  initializeTier('desktop'); saveSetting('tex', 'auto'); setTexturePolicy('img', 'home');
  const leave = new TexturePolicyBinding('img', 'region', 2_000_000_000).enter();
  try { expect(texMode()).toBe('img'); } finally { leave(); }
});
