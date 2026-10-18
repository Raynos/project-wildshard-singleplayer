// The light lab's glue, trimmed for the clean room (from the dev labs (deleted in E357 F7), round-9-lab-light): bake the
// light-pool volumes from every emitter and lit window, wire the window glow and the learned LUT, and apply the lab's
// HEAD tuning. No global of its own and no URL switches: `__nd.light({...})` sets a variant for A/B captures.
import { Color, Vector3, type Matrix4, type Data3DTexture, type Vector4 } from 'three';
import { LightEmitters } from '@wildshard/engine/fx/lightEmitters';
import type { LightPoolRow } from '@wildshard/format/lightEmitters';
import * as v from 'valibot';
import { SQUARE_BOX, WELL_BOX } from './lightvol';
import { type BakeStats, bakeLightVolumeSliced } from '../../runtime/looks/lightVolume';
import { loadLut } from './grade';
import { gpuOnlyTexture } from '@wildshard/engine/core/gpuOnly';
import { LIGHT_DEFAULTS, LP_MAX, LUT_URL, type LightSettings } from '../../runtime/looks/light';
// SHARD-PLATFORM M3: the settings, the lab's tuning and the LUT's URL are data (data/light.ts).

/** Numeric sources shared with halo presentation; no shader or scene owner crosses the emitter API. */
export interface EmitterLike { at: Vector3; color: Color; w: number; h: number; power: number; spill: number }
interface WindowLike { m: Matrix4; win: Vector4; light: Color }
export function isLamp(e: EmitterLike): boolean { return e.w < 0.5 && e.h < 0.5; }
const number = v.pipe(v.number(), v.finite(), v.minValue(0));
/** Profiles are admitted with the existing fixed-world kit blob. */
export const LightPoolProfilesSchema = v.strictObject({
  lantern: v.strictObject({ k: number, r: number, cut: number, tint: number, redShare: number }),
  shop: v.strictObject({ k: number, rPerW: number, rMin: number, cut: number, out: number, tint: number }),
  lamp: v.strictObject({ k: number, r: number, cut: number, tint: number }),
  sign: v.strictObject({ k: number, rPerSize: number, rMin: number, cut: number }),
  window: v.strictObject({ k: number, r: number, cut: number, out: number }),
});
type LightPoolProfiles = v.InferOutput<typeof LightPoolProfilesSchema>;
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

/** The existing emitter layout projects numeric pool rows; the shared host materialises both volume and uniform views. */
export function lightPoolRows(opt: { readonly lanterns: readonly EmitterLike[]; readonly ctxEmitters: readonly EmitterLike[];
  readonly signs: readonly EmitterLike[]; readonly windows: readonly WindowLike[] }, POOL: LightPoolProfiles): LightPoolRow[] {
  const shops = opt.ctxEmitters.filter((e) => !isLamp(e));
  const lamps = opt.ctxEmitters.filter(isLamp).map((e) => e.at);
  const rows: LightPoolRow[] = [];
  const push = (at: Vector3, color: Color, gain: number, radius: number, cut: number): void => {
    rows.push({ id: `light.${String(rows.length)}`, at: [at.x, at.y, at.z], colour: [color.r, color.g, color.b], gain, radius, cut, initially: true });
  };
  for (const e of opt.lanterns) {
    const size = e.w / 0.5, row = POOL.lantern;
    push(e.at, new Color(row.tint).lerp(e.color, row.redShare), row.k * size, row.r * size, row.cut);
  }
  for (const e of shops) {
    const row = POOL.shop;
    push(e.at, new Color(row.tint).lerp(e.color, 0.5), row.k * Math.min(Math.max(e.spill / 0.3, 0.5), 1), Math.max(row.rMin, row.rPerW * e.w), row.cut);
  }
  for (const at of lamps) push(at, new Color(POOL.lamp.tint), POOL.lamp.k, POOL.lamp.r, POOL.lamp.cut);
  for (const e of opt.signs) if (e.spill > 0) {
    const row = POOL.sign;
    push(e.at, e.color, row.k * Math.min(e.power, 1.5), Math.max(row.rMin, row.rPerSize * Math.max(e.w, e.h)), row.cut);
  }
  const point = new Vector3(), normal = new Vector3();
  for (const window of opt.windows) if (window.win.y > 0) {
    point.setFromMatrixPosition(window.m); normal.setFromMatrixColumn(window.m, 2).normalize();
    const h = new Vector3().setFromMatrixColumn(window.m, 1).length(), row = POOL.window;
    push(point.clone().addScaledVector(normal, row.out).setY(point.y + h * 0.5), window.light, row.k * window.win.y, row.r, row.cut);
  }
  return rows;
}

export function installLight(opt: {
  u: LightUniforms; pipe: LightPipe;
  pools: LightPoolProfiles;
  lanterns: readonly EmitterLike[]; ctxEmitters: readonly EmitterLike[]; signs: readonly EmitterLike[]; windows: readonly WindowLike[];
}): Light {
  const u = opt.u;
  sources = { lanterns: opt.lanterns, shops: opt.ctxEmitters, signs: opt.signs };
  const lights = new LightEmitters(lightPoolRows(opt, opt.pools)).volume();
  // (op-hitch29) the volumes bake in work slices as part of `ready` (a grid cell bakes them on the road, in play: one ~55 ms
  // task before); the world build awaits `ready` before it hands the world over
  const unbaked: BakeStats = { lights: 0, cells: 0, ms: 0, maxE: 0 };
  let square = unbaked, well = unbaked;
  const bakeVolumes = async (): Promise<void> => {
    const a = await bakeLightVolumeSliced(lights, SQUARE_BOX, LP_MAX, u.uLpMinA.value, u.uLpInvA.value);
    u.uLpVolA.value = a.tex;
    const b = await bakeLightVolumeSliced(lights, WELL_BOX, LP_MAX, u.uLpMinB.value, u.uLpInvB.value);
    u.uLpVolB.value = b.tex;
    // (E264) the volumes are baked once: their texels are on the GPU after the first draw (6.3 MB of RGBA8 in JS)
    gpuOnlyTexture(a.tex, 'Nine Dragon light volumes (GPU only)');
    gpuOnlyTexture(b.tex, 'Nine Dragon light volumes (GPU only)');
    square = a.stats; well = b.stats;
  };
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
    const lut = loadLut(LUT_URL);
    await bakeVolumes();
    const t = await lut;
    if (t !== null) { opt.pipe.grade.uLut.value = t; lutLoaded = true; }
    apply();
  })();
  apply();
  return {
    ready,
    set: (s) => { cur = { ...cur, ...s }; apply(); },
    get: () => ({ ...cur }),
    stats: () => ({ square, well, lights: lights.length, lut: lutLoaded }),
  };
}
