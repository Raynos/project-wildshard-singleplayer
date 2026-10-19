import { Color, Matrix4, Quaternion, Vector3, Vector4 } from 'three';
import { zlibSync } from 'fflate';
import * as v from 'valibot';
import { LightEmitters } from '@wildshard/engine/fx/lightEmitters';
import type { LightPoolRow } from '@wildshard/format/lightEmitters';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import { bakeLightVolume } from './lightVolume';
import { neonSize } from './signMath';
import layout from '../data/layout.generated.json' with { type: 'json' };
import fixed from '../data/fixedKits.generated.json' with { type: 'json' };
import signs from '../data/signAtlas.generated.json' with { type: 'json' };
import pools from '../data/lightPools.json' with { type: 'json' };
import lantern from '../data/lantern.json' with { type: 'json' };
import signRows from '../data/signView.json' with { type: 'json' };

interface EmitterLike { at: Vector3; color: Color; w: number; h: number; power: number; spill: number }
interface WindowLike { m: Matrix4; win: Vector4; light: Color }
const isLamp = (e: EmitterLike): boolean => e.w < 0.5 && e.h < 0.5;
const number = v.pipe(v.number(), v.finite(), v.minValue(0));
/** Author-side validation; the page receives only baked voxel data. */
export const LightPoolProfilesSchema = v.strictObject({
  maximum: number,
  lantern: v.strictObject({ k: number, r: number, cut: number, tint: number, redShare: number }),
  shop: v.strictObject({ k: number, rPerW: number, rMin: number, cut: number, out: number, tint: number }),
  lamp: v.strictObject({ k: number, r: number, cut: number, tint: number }),
  sign: v.strictObject({ k: number, rPerSize: number, rMin: number, cut: number }),
  window: v.strictObject({ k: number, r: number, cut: number, out: number }),
});
type LightPoolProfiles = v.InferOutput<typeof LightPoolProfilesSchema>;
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

/** Restore the static pool inputs in the same order as the page's layout reader. */
export function volumeSources(tier: 'phone' | 'desktop', caps: boolean): { lanterns: EmitterLike[]; ctxEmitters: EmitterLike[]; signs: EmitterLike[]; windows: WindowLike[] } {
  const c = layout.rows.counts, records = layout.records;
  let cursor = (c.walkers + c.sitters) * 16;
  const numeric = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (value === '-0') return -0;
    throw new Error('Nine light input record is not finite');
  };
  const num = (): number => numeric(records[cursor++]);
  const matrices = Array.from({ length: c.lanterns }, () => new Matrix4().fromArray(Array.from({ length: 16 }, num)));
  if (caps) for (const matrix of fixed.lanterns) matrices.push(new Matrix4().fromArray(matrix.map(numeric)));
  const point = new Vector3(), rotation = new Quaternion(), scale = new Vector3();
  const lanterns = matrices.map(matrix => {
    matrix.decompose(point, rotation, scale);
    return { at: point.clone().add(new Vector3(0, -lantern.drop * scale.x, 0)), color: new Color(lantern.glow.color),
      w: lantern.glow.w * scale.x, h: lantern.glow.h * scale.x, power: lantern.glow.power, spill: lantern.glow.spill * scale.x };
  });
  cursor += c.acs * 16 + c.hooks * 3 + c.hookMounts * 6 + c.steam * 3 + c.pieces * 19;
  const windows = Array.from({ length: c.windows }, () => {
    const m = new Matrix4().fromArray(Array.from({ length: 16 }, num)), win = new Vector4(num(), num(), num(), num());
    num(); num(); num(); // the wall colour precedes the emitted light
    return { m, win, light: new Color(num(), num(), num()) };
  });
  const neon: EmitterLike[] = [];
  for (const { p, neon: calligraphy } of signs[tier].placed) {
    if (!calligraphy) continue;
    const { w, h } = neonSize(p.spec.text, p.size, p.spec.vertical);
    const gain = ((p.gain ?? signRows.model.calligraphyGain) / signRows.model.calligraphyGain) * signRows.model.tubeGain;
    const power = (1.4 * gain) / signRows.model.tubeGain;
    neon.push({ at: new Vector3().fromArray(p.at.map(numeric)).addScaledVector(new Vector3().fromArray(p.normal.map(numeric)).setY(0).normalize(), 0.09 / 2),
      color: new Color(p.spec.color), w, h, power, spill: 0.3 * power });
  }
  const inflate = (e: { at: number[]; color: number[]; w: number; h: number; power: number; spill: number }): EmitterLike =>
    ({ ...e, at: new Vector3().fromArray(e.at), color: new Color(numeric(e.color[0]), numeric(e.color[1]), numeric(e.color[2])) });
  return { lanterns, windows, ctxEmitters: layout.rows.emitters.map(inflate), signs: neon.concat(signs[tier].lights.map(inflate)) };
}

/** Exact RGBA8 irradiance bytes; compression only changes transfer size. No page bake remains. */
interface VolumeRow { readonly file: string; readonly size: readonly [number, number, number]; readonly min: readonly number[]; readonly inv: readonly number[]; readonly maximum: number }
let cached: { blobs: NamedBlob[]; rows: Record<string, VolumeRow> } | undefined;
function volumeData(): { blobs: NamedBlob[]; rows: Record<string, VolumeRow> } {
  if (cached !== undefined) return cached;
  const blobs: NamedBlob[] = [], rows: Record<string, VolumeRow> = {};
  for (const tier of ['phone', 'desktop'] as const) for (const caps of [false, true]) {
    const lights = new LightEmitters(lightPoolRows(volumeSources(tier, caps), v.parse(LightPoolProfilesSchema, pools))).volume();
    const key = `looks/volumes-${tier}-${caps ? 'capped' : 'open'}`;
    const boxes = [{ min: new Vector3(-30, 123, -175), max: new Vector3(110, 171, 28), cell: 1 },
      { min: new Vector3(-30, -100, -46), max: new Vector3(2, 123, 18), cell: 1.5 }];
    boxes.forEach((box, index) => {
      const min = new Vector3(), inv = new Vector3(), { tex } = bakeLightVolume(lights, box, pools.maximum, min, inv);
      const data = tex.image.data;
      if (!(data instanceof Uint8Array)) throw new Error('Nine volume bake has no byte payload');
      const file = `${key}-${index}`;
      const volume = nameBlob(`${file}.bin`, 'bin', zlibSync(data, { level: 9 }), { decoded: data.length, gpu: data.length });
      const existing = blobs.find(blob => blob.file.hash === volume.file.hash);
      if (existing === undefined) blobs.push(volume);
      const name = existing?.file.name ?? volume.file.name;
      if (name === undefined) throw new Error('Irradiance payload needs its logical name');
      rows[`${tier}-${caps ? 'capped' : 'open'}-${index}`] = { file: name, size: [tex.image.width, tex.image.height, tex.image.depth], min: min.toArray(), inv: inv.toArray(), maximum: pools.maximum };
      tex.dispose();
    });
  }
  cached = { blobs, rows }; return cached;
}
export function lightVolumeBlobs(): NamedBlob[] { return volumeData().blobs; }
export function lightVolumeRows(): Readonly<Record<string, VolumeRow>> { return volumeData().rows; }
