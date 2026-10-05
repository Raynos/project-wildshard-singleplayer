import { preloadBakedTextures, loadLUT } from '@wildshard/engine/boot/bakedApi';
import type { LookStrategy, SkyBackdropFactory } from '@wildshard/engine/render/look';
import * as THREE from 'three';
import { PineSkyBackdrop, registerPineBackdrop } from './skyBackdrop';
import { pineSunAt } from './dayKeys';
import { pineMemoryTrim } from '../debug/options';

const backdrop: SkyBackdropFactory = async ({ sky, scene, renderer, level, tier, look }) => {
  const [pine, , lut] = await Promise.all([PineSkyBackdrop.create(renderer, scene, level.tiers?.[tier]?.envSteps === true, pineMemoryTrim(), tier === 'phone' && pineMemoryTrim()), preloadBakedTextures(), loadLUT(level.id)]);
  registerPineBackdrop(sky, pine);
  if (look) Object.assign(pine.look, { vol: look.vol, fogDist: look.fogDist, sat: look.sat, ambient: look.ambient, sky: look.sky });
  pineSunAt(pine.phase, sky.sunDir);
  scene.background = null;
  scene.add(pine.dome);
  return {
    clock: pine.clock, horizon: new THREE.Color(...level.sky.fogSunColor), lut,
    bind: (targets) => { pine.bind(targets); },
    update: (dt, camera) => { pine.update(dt, camera); },
    rebuild: () => { pine.rebuild(); },
    attachPost: (post) => { pine.attachPost(post); },
  };
};

export function shardRender(): LookStrategy { return { compose: () => ({}), backdrop }; }
