// Restore the authored irradiance volumes, window glow and learned LUT.
// The original pool construction and splat run only in generators/lightVolumes.ts.
import { type Color, type Vector3, type Vector4, Data3DTexture, LinearFilter } from 'three';
import { loadFirstPartyProduct } from '@wildshard/game/shardfile/runtimeProduct';
import { TIER } from '@wildshard/engine/core/tier';
import { loadLut } from './grade';
import { gpuOnlyTexture } from '@wildshard/engine/core/gpuOnly';
import type { LightSettings } from './types';
import metadata from '../../boot/metadata.generated.json' with { type: 'json' };
import type { LookRows } from '../../boot/lookTypes.generated';

const light = metadata.looks.light as LookRows['light'];
// SHARD-PLATFORM M3: the settings, the lab's tuning and the LUT's URL are data (data/light.ts).

export interface EmitterLike { at: Vector3; color: Color; w: number; h: number; power: number; spill: number }

interface BakeStats { lights: number; cells: number; ms: number; maxE: number }
interface LightUniforms {
  uLpVolA: { value: Data3DTexture }; uLpMinA: { value: Vector3 }; uLpInvA: { value: Vector3 };
  uLpVolB: { value: Data3DTexture }; uLpMinB: { value: Vector3 }; uLpInvB: { value: Vector3 };
  uLpGain: { value: Vector4 };
  uLpMax: { value: number }; uLpSky: { value: number };
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
  lanterns: readonly EmitterLike[]; ctxEmitters: readonly EmitterLike[]; signs: readonly EmitterLike[]; caps: boolean;
}): Light {
  const u = opt.u;
  sources = { lanterns: opt.lanterns, shops: opt.ctxEmitters, signs: opt.signs };
  let lights = 0;
  let square: BakeStats = { lights: 0, cells: 0, ms: 0, maxE: 0 }, well = square;
  const bakeVolumes = async (): Promise<void> => {
    const product = await loadFirstPartyProduct('nine-dragon-stack');
    const key = `looks/volumes-${TIER}-${opt.caps ? 'capped' : 'open'}`;
    const loaded = await Promise.all([0, 1].map(async index => {
      const packed = Uint8Array.from(await product.file(`${key}-${index}.bin`)), header = new DataView(packed.buffer);
      if (header.byteLength < 108 || header.getUint32(0, true) !== 0x56534c57 || header.getUint8(4) !== 1
        || header.getUint8(5) !== (TIER === 'phone' ? 0 : 1) || header.getUint8(6) !== (opt.caps ? 1 : 0) || header.getUint8(7) !== index) throw new Error('Invalid Nine light volume header');
      const size: [number, number, number] = [header.getUint32(8, true), header.getUint32(12, true), header.getUint32(16, true)];
      const values = Array.from({ length: 11 }, (_, i) => header.getFloat64(20 + i * 8, true));
      if (size.some(n => n < 1 || n > 512) || !values.every(Number.isFinite) || (values[10] ?? 0) <= 0) throw new Error('Invalid Nine light volume bounds');
      const row = { min: values.slice(0, 3), inv: values.slice(3, 6), stats: { lights: values[6] ?? 0, cells: values[7] ?? 0, maxE: values[8] ?? 0, ms: 0 }, lights: values[9] ?? 0, maximum: values[10] ?? 0 };
      const data = new Uint8Array(await new Response(new Blob([packed.subarray(108)]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
      if (data.length !== size[0] * size[1] * size[2] * 4) throw new Error('Nine light volume size mismatch');
      const tex = new Data3DTexture(data, ...size);
      tex.minFilter = tex.magFilter = LinearFilter; tex.unpackAlignment = 1; tex.needsUpdate = true;
      gpuOnlyTexture(tex, 'Nine Dragon light volumes (GPU only)'); return { tex, row };
    }));
    const a = loaded[0], b = loaded[1]; if (a === undefined || b === undefined || loaded.length !== 2) throw new Error('Missing Nine light volumes');
    u.uLpVolA.value = a.tex; u.uLpMinA.value.fromArray(a.row.min); u.uLpInvA.value.fromArray(a.row.inv);
    u.uLpVolB.value = b.tex; u.uLpMinB.value.fromArray(b.row.min); u.uLpInvB.value.fromArray(b.row.inv);
    square = a.row.stats; well = b.row.stats; lights = a.row.lights; u.uLpMax.value = a.row.maximum;
  };
  let cur: LightSettings = { ...light.defaults };
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
    const lut = loadLut(light.lut);
    await bakeVolumes();
    const t = await lut;
    opt.pipe.grade.uLut.value = t; lutLoaded = true;
    apply();
  })();
  apply();
  return {
    ready,
    set: (s) => { cur = { ...cur, ...s }; apply(); },
    get: () => ({ ...cur }),
    stats: () => ({ square, well, lights, lut: lutLoaded }),
  };
}
