import * as THREE from 'three';
import type { LookStrategy, SkyBackdropFactory } from '#engine/render/look';
import { preloadBakedTextures } from '#engine/boot/bakedTextures';
import { loadLUT } from '#engine/world/lut';
import { activeGrade } from '#engine/world/lookFlags';
import { getActiveChunk } from '#game/shard/registry';
import { PineSkyBackdrop, registerPineBackdrop } from './skyBackdrop';
import { pineSunAt } from './dayKeys';

const backdrop: SkyBackdropFactory = async ({ sky, scene, renderer }) => {
  const [pine, , lut] = await Promise.all([PineSkyBackdrop.create(renderer, scene), preloadBakedTextures(), loadLUT(getActiveChunk().slug)]);
  registerPineBackdrop(sky, pine);
  const { look } = activeGrade(getActiveChunk());
  if (look) Object.assign(pine.look, { vol: look.vol, fogDist: look.fogDist, sat: look.sat, ambient: look.ambient, sky: look.sky });
  pineSunAt(pine.phase, sky.sunDir);
  scene.background = null;
  scene.add(pine.dome);
  return {
    clock: pine.clock, horizon: new THREE.Color(...getActiveChunk().sky.fogSunColor), lut,
    bind: (targets) => { pine.bind(targets); },
    update: (dt, camera) => { pine.update(dt, camera); },
    rebuild: () => { pine.rebuild(); },
    attachPost: (post) => { pine.attachPost(post); },
  };
};

export function shardRender(): LookStrategy { return { compose: () => ({}), backdrop }; }
