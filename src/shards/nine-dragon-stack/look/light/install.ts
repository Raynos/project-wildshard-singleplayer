// The light lab's glue, trimmed for the clean room (from the dev labs (deleted in E357 F7), round-9-lab-light): bake the
// light-pool volumes from every emitter and lit window, wire the window glow and the learned LUT, and apply the lab's
// HEAD tuning. No global of its own and no URL switches: `__nd.light({...})` sets a variant for A/B captures.
import type { Color, Data3DTexture, Vector3, Vector4 } from 'three';
import { SQUARE_BOX, WELL_BOX } from './lightvol';
import { type BakeStats, bakeLightVolume } from '@wildshard/sdk/looks/lightVolume';
import { type EmitterLike, type WindowLike, gatherPools, isLamp } from './pools';
import { loadLut } from './grade';
import { gpuOnlyTexture } from '@wildshard/engine/core/gpuOnly';
import { LIGHT_DEFAULTS, LP_MAX, LUT_URL, type LightSettings } from '../../data/light';
// SHARD-PLATFORM M3: the settings, the lab's tuning and the LUT's URL are data (data/light.ts).

interface LightUniforms {
  uLpVolA: { value: Data3DTexture }; uLpMinA: { value: Vector3 }; uLpInvA: { value: Vector3 };
  uLpVolB: { value: Data3DTexture }; uLpMinB: { value: Vector3 }; uLpInvB: { value: Vector3 };
  uLpGain: { value: Vector4 };
  uLpSky: { value: number };
  uLpAmb: { value: number };
}
interface LightPipe { glow: { uGlow: { value: Vector4 }; uGlow2: { value: Vector4 }; uGlowCol: { value: Color } }; grade: { uLut: { value: Data3DTexture }; uLutAmt: { value: number } } }

export interface Light {
  ready: Promise<void>;
  set: (s: Partial<LightSettings>) => void;
  get: () => LightSettings;
  stats: () => { square: BakeStats; well: BakeStats; lights: number; lut: boolean };
}

/** (render, E281) the last installed light's sources, lit windows aside: the phone's halos (halos.ts) are made from them */
let sources: { lanterns: readonly EmitterLike[]; shops: readonly EmitterLike[]; signs: readonly EmitterLike[] } | null = null;
export function lightSources(): typeof sources { return sources; }

export function installLight(opt: {
  u: LightUniforms; pipe: LightPipe;
  lanterns: readonly EmitterLike[]; ctxEmitters: readonly EmitterLike[]; signs: readonly EmitterLike[]; windows: readonly WindowLike[];
}): Light {
  const u = opt.u;
  sources = { lanterns: opt.lanterns, shops: opt.ctxEmitters, signs: opt.signs };
  const shops = opt.ctxEmitters.filter((e) => !isLamp(e));
  const lamps = opt.ctxEmitters.filter(isLamp).map((e) => e.at);
  const lights = gatherPools({ lanterns: opt.lanterns, shops, lamps, signs: opt.signs, windows: opt.windows });
  const a = bakeLightVolume(lights, SQUARE_BOX, LP_MAX, u.uLpMinA.value, u.uLpInvA.value);
  u.uLpVolA.value = a.tex;
  const b = bakeLightVolume(lights, WELL_BOX, LP_MAX, u.uLpMinB.value, u.uLpInvB.value);
  u.uLpVolB.value = b.tex;
  // (E264) the volumes are baked once: their texels are on the GPU after the first draw (6.3 MB of RGBA8 in JS)
  gpuOnlyTexture(a.tex, 'Nine Dragon light volumes (GPU only)');
  gpuOnlyTexture(b.tex, 'Nine Dragon light volumes (GPU only)');
  let cur: LightSettings = { ...LIGHT_DEFAULTS };
  let lutLoaded = false;
  const apply = (): void => {
    u.uLpGain.value.set(cur.poolGain, cur.sheen, u.uLpGain.value.z, cur.pools);
    opt.pipe.glow.uGlow2.value.set(cur.halo, cur.veil, opt.pipe.glow.uGlow2.value.z, cur.glow);
    opt.pipe.glow.uGlow.value.set(opt.pipe.glow.uGlow.value.x, cur.glowThr, cur.glowNear, cur.glowFar);
    u.uLpSky.value = cur.wetSky;
    u.uLpAmb.value = cur.ambient;
    opt.pipe.grade.uLutAmt.value = lutLoaded ? cur.grade : 0;
  };
  const ready = (async (): Promise<void> => {
    const t = await loadLut(LUT_URL);
    if (t !== null) { opt.pipe.grade.uLut.value = t; lutLoaded = true; }
    apply();
  })();
  apply();
  return {
    ready,
    set: (s) => { cur = { ...cur, ...s }; apply(); },
    get: () => ({ ...cur }),
    stats: () => ({ square: a.stats, well: b.stats, lights: lights.length, lut: lutLoaded }),
  };
}
