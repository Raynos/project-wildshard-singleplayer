// Lab P6 "light" (E169): the glue between the frozen clean-room copy (./room, the lab page's scene) and the light +
// grade modules, and the lab's own API for the capture script: window.__light = { ready, set, get, stats }.
// No URL switches (AGENTS.md): every variant is a `set()` field.
import type { Color, Data3DTexture, IUniform, Scene, Vector3, Vector4 } from 'three';
import { buildCards } from './cards';
import { SQUARE_BOX, WELL_BOX, bakeVolume, type BakeStats } from './lightvol';
import { type EmitterLike, type WindowLike, gatherPools, isLamp } from './pools';
import { BLUE_HOUR, type SkyTargets, applyRamp, loadLut } from './grade';

export interface LightSettings {
  /** the light volume on / off */
  pools: number;
  /** diffuse gain of the pools on the wash */
  poolGain: number;
  /** the wet stone's glossy sheen of the pools */
  sheen: number;
  /** the window glow in the fog (bloom alpha) on / off, and its halo / veil gains */
  glow: number;
  halo: number;
  veil: number;
  /** the learned LUT's strength (0 = off) */
  grade: number;
  /** the blue-hour sky + fog ramp on / off */
  sky: number;
  /** the wet film's sky reflection, on top of the clean room's fresnel term (0 = off) */
  wetSky: number;
  /** the window glow's source threshold (brightest channel, HDR) */
  glowThr: number;
  /** the base fog's density (/m past the first 16 m of clear air); the clean room has 0.0065 */
  fogDensity: number;
  /** the base fog's colour (hex) */
  fogColor: number;
  /** the blue-hour ambient on every non-emissive wash (1 = the clean room) */
  ambient: number;
  /** method B, for the A/B: ground light cards (additive, one draw) instead of / on top of the volume's sheen */
  cards: number;
  cardGain: number;
  /** the window glow's distance ramp: start / full (m) */
  glowNear: number;
  glowFar: number;
  /** measurement only: the screen-space drizzle's strength (the clean room's 0.55); not a light lever */
  rain: number;
}

/** tuned on the clean room at HEAD 3c39b36f (round-8 loop 7 state): its own sky / fog / wash already sit near the
 *  targets, so the ramp and the ambient stay off; the loop-2 tuning (sky 1, fog 0.009 #7585a0, ambient 0.8, wet sky
 *  0.45, window halo 2.5) is in round-9-lab-light/README.md */
export const DEFAULTS: LightSettings = { pools: 1, poolGain: 1, sheen: 1.0, glow: 1, halo: 0.6, veil: 0.15, grade: 1, sky: 0, wetSky: 0.1, glowThr: 0.22, fogDensity: 0.0052, fogColor: BLUE_HOUR.fog, ambient: 1, cards: 0, cardGain: 1, glowNear: 6, glowFar: 40, rain: 0.55 };

interface LabUniforms extends SkyTargets {
  uLpVolA: { value: Data3DTexture }; uLpMinA: { value: Vector3 }; uLpInvA: { value: Vector3 };
  uLpVolB: { value: Data3DTexture }; uLpMinB: { value: Vector3 }; uLpInvB: { value: Vector3 };
  uLpGain: { value: Vector4 };
  uLpSky: { value: number };
  uLpAmb: { value: number };
}
interface LabShared { u: LabUniforms; look: string; setLook: (name: 'jiehua' | 'silk' | 'sutra') => void }
interface LabPipe { uComp: { uRain: { value: Vector4 } }; glow: { uGlow: { value: Vector4 }; uGlow2: { value: Vector4 }; uGlowCol: { value: Color } }; grade: { uLut: { value: Data3DTexture }; uLutAmt: { value: number } } }

export interface LightApi {
  ready: Promise<void>;
  set: (s: Partial<LightSettings>) => void;
  get: () => LightSettings;
  stats: () => { square: BakeStats; well: BakeStats; lights: number; lut: boolean };
}
declare global { interface Window { __light?: LightApi } }

export const LUT_URL = '/assets/nine-dragon/lab/grade-lut.bin';

export function installLightLab(opt: {
  shared: LabShared; pipe: LabPipe;
  lanterns: readonly EmitterLike[]; ctxEmitters: readonly EmitterLike[]; signs: readonly EmitterLike[]; windows: readonly WindowLike[];
  /** for method B only: the scene, the fog GLSL (noise + fog), the ground's altitude */
  cards?: { scene: Scene; fogGlsl: string; groundY: number; uniforms: Record<string, IUniform> };
}): LightApi {
  const u = opt.shared.u;
  const shops = opt.ctxEmitters.filter((e) => !isLamp(e));
  const lamps = opt.ctxEmitters.filter(isLamp).map((e) => e.at);
  const lights = gatherPools({ lanterns: opt.lanterns, shops, lamps, signs: opt.signs, windows: opt.windows });
  const a = bakeVolume(lights, SQUARE_BOX, u.uLpMinA.value, u.uLpInvA.value);
  u.uLpVolA.value = a.tex;
  const b = bakeVolume(lights, WELL_BOX, u.uLpMinB.value, u.uLpInvB.value);
  u.uLpVolB.value = b.tex;
  console.info(`[light] ${lights.length} pool lights (${opt.lanterns.length} lanterns, ${shops.length} shops, ${lamps.length} lamps, ${opt.signs.length} signs, ${opt.windows.filter((w) => w.win.y > 0).length} lit windows); square ${JSON.stringify(a.stats)}, well ${JSON.stringify(b.stats)}`);
  const cards = opt.cards === undefined ? null : buildCards(lights, opt.cards.uniforms, opt.cards.fogGlsl, opt.cards.groundY,
    (l) => l.at.x > -2 && l.at.x < 40 && l.at.z > -170 && l.at.z < 30);
  if (cards !== null && opt.cards !== undefined) { cards.mesh.visible = false; opt.cards.scene.add(cards.mesh); }
  const fog0 = u.uFogBase.value;
  let cur: LightSettings = { ...DEFAULTS };
  let lutLoaded = false;
  const apply = (): void => {
    u.uLpGain.value.set(cur.poolGain, cur.sheen, u.uLpGain.value.z, cur.pools);
    opt.pipe.glow.uGlow2.value.set(cur.halo, cur.veil, opt.pipe.glow.uGlow2.value.z, cur.glow);
    opt.pipe.glow.uGlow.value.set(opt.pipe.glow.uGlow.value.x, cur.glowThr, cur.glowNear, cur.glowFar);
    if (cards !== null) { cards.mesh.visible = cur.cards > 0.5; cards.gain.value = cur.cardGain; }
    u.uLpSky.value = cur.wetSky;
    u.uLpAmb.value = cur.ambient;
    opt.pipe.uComp.uRain.value.x = cur.rain;
    opt.pipe.grade.uLutAmt.value = lutLoaded ? cur.grade : 0;
    if (cur.sky > 0.5 && opt.shared.look === 'jiehua') applyRamp(u, { ...BLUE_HOUR, fogDensity: cur.fogDensity, fog: cur.fogColor });
    else { opt.shared.setLook(opt.shared.look === 'silk' || opt.shared.look === 'sutra' ? opt.shared.look : 'jiehua'); u.uFogBase.value = fog0; }
  };
  const ready = (async (): Promise<void> => {
    const t = await loadLut(LUT_URL);
    if (t !== null) { opt.pipe.grade.uLut.value = t; lutLoaded = true; }
    apply();
  })();
  const api: LightApi = {
    ready,
    set: (s) => { cur = { ...cur, ...s }; apply(); },
    get: () => ({ ...cur }),
    stats: () => ({ square: a.stats, well: b.stats, lights: lights.length, lut: lutLoaded }),
  };
  window.__light = api;
  apply();
  return api;
}
