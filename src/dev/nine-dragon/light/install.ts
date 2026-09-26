// The light lab's glue, trimmed for the clean room (from src/dev/nd-lab/light/lab.ts, round-9-lab-light): bake the
// light-pool volumes from every emitter and lit window, wire the window glow and the learned LUT, and apply the lab's
// HEAD tuning. No global of its own and no URL switches: `__nd.light({...})` sets a variant for A/B captures.
import type { Color, Data3DTexture, Vector3, Vector4 } from 'three';
import { SQUARE_BOX, WELL_BOX, bakeVolume, type BakeStats } from './lightvol';
import { type EmitterLike, type WindowLike, gatherPools, isLamp } from './pools';
import { loadLut } from './grade';

export interface LightSettings {
  /** the light volume on / off, its diffuse gain on the wash, the wet stone's glossy sheen of it */
  pools: number;
  poolGain: number;
  sheen: number;
  /** the window glow in the fog (bloom alpha) on / off, its halo / veil gains, threshold and distance ramp (m) */
  glow: number;
  halo: number;
  veil: number;
  glowThr: number;
  glowNear: number;
  glowFar: number;
  /** the learned LUT's strength (0 = off) */
  grade: number;
  /** the wet film's sky reflection on top of the fresnel term (0 = off) */
  wetSky: number;
  /** the blue-hour ambient on every non-emissive wash (1 = none) */
  ambient: number;
}

/** the lab's tuning on the clean room at 3c39b36f (round-9-lab-light/README.md §What won) */
export const LIGHT_DEFAULTS: LightSettings = { pools: 1, poolGain: 1, sheen: 1.0, glow: 1, halo: 0.6, veil: 0.15, glowThr: 0.22, glowNear: 6, glowFar: 40, grade: 1, wetSky: 0.1, ambient: 1 };

// refitted on the clean room's own frames after the merge (round 11; LOOK-LOOP.md step 6), not the lab's 3c39b36f fit
export const LUT_URL = '/assets/nine-dragon/grade-lut-cleanroom.bin';

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

export function installLight(opt: {
  u: LightUniforms; pipe: LightPipe;
  lanterns: readonly EmitterLike[]; ctxEmitters: readonly EmitterLike[]; signs: readonly EmitterLike[]; windows: readonly WindowLike[];
}): Light {
  const u = opt.u;
  const shops = opt.ctxEmitters.filter((e) => !isLamp(e));
  const lamps = opt.ctxEmitters.filter(isLamp).map((e) => e.at);
  const lights = gatherPools({ lanterns: opt.lanterns, shops, lamps, signs: opt.signs, windows: opt.windows });
  const a = bakeVolume(lights, SQUARE_BOX, u.uLpMinA.value, u.uLpInvA.value);
  u.uLpVolA.value = a.tex;
  const b = bakeVolume(lights, WELL_BOX, u.uLpMinB.value, u.uLpInvB.value);
  u.uLpVolB.value = b.tex;
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
