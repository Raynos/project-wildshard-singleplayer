// The uniforms every neon-lab program shares (one object each, so one write reaches every material), the palette
// (ART-STYLE-RESEARCH §5.1, linear), the silk weave texture and the emitter list the spill / reflections read.
import { Color, DataTexture, LinearFilter, LinearMipmapLinearFilter, RedFormat, RepeatWrapping, UnsignedByteType, Vector2, Vector3, Vector4 } from 'three';
import { MAX_LIGHTS } from './glsl';

/** §5.1 neon, sRGB hex (converted to linear by Color) */
export const NEON = {
  magenta: 0xff3fa4,
  cyan: 0x3fe6ff,
  jade: 0x33f0b0,
  red: 0xff3b30,
  amber: 0xffb347,
  lantern: 0xff4a3a,
} as const;

export const lin = (hex: number): Color => new Color(hex);

/** something that glows: a sign, a lantern, a lit shopfront; the streak cards and the spill read these */
export interface Emitter {
  at: Vector3;
  /** linear colour (the saturated hue) */
  color: Color;
  /** size of the glowing face in metres */
  w: number;
  h: number;
  /** reflection strength */
  power: number;
  /** spill strength on walls / ground (0 = none) */
  spill: number;
}

function silkWeave(): DataTexture {
  const N = 256;
  const d = new Uint8Array(N * N);
  let s = 97;
  const rnd = (): number => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const warp = Array.from({ length: N }, () => rnd());
  const weft = Array.from({ length: N }, () => rnd());
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const over = ((x >> 1) + (y >> 1)) % 2 === 0;
      const thread = over ? (warp[x] ?? 0.5) : (weft[y] ?? 0.5);
      const v = 0.5 + (over ? 0.1 : -0.1) + (thread - 0.5) * 0.35 + (rnd() - 0.5) * 0.12;
      d[y * N + x] = Math.max(0, Math.min(255, Math.round(v * 255)));
    }
  }
  const t = new DataTexture(d, N, N, RedFormat, UnsignedByteType);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

export class LabShared {
  readonly u = {
    uTime: { value: 0 },
    uCam: { value: new Vector3() },
    uFogCol: { value: lin(0xa0a9ba) },
    uFogTop: { value: lin(0x9aa6be) },
    uFog: { value: new Vector4(0.0085, 0.88, 60, 0) },
    uGroundY: { value: 0 },
    uRes: { value: new Vector2(1, 1) },
    uSilk: { value: silkWeave() },
    uLPos: { value: Array.from({ length: MAX_LIGHTS }, () => new Vector4(0, -999, 0, 1)) },
    uLCol: { value: Array.from({ length: MAX_LIGHTS }, () => new Vector3()) },
    uAmbient: { value: lin(0x8f98aa) },
    /** 1 while measuring overdraw: the additive programs write 1/255 per layer */
    uCount: { value: 0 },
  };

  /** pick the MAX_LIGHTS emitters with the most spill near `eye` (the lab re-picks per shot, not per frame) */
  setLights(emitters: readonly Emitter[], eye: Vector3): void {
    const ranked = emitters
      .filter((e) => e.spill > 0)
      .map((e) => ({ e, k: e.spill / (1 + e.at.distanceToSquared(eye) * 0.004) }))
      .sort((a, b) => b.k - a.k)
      .slice(0, MAX_LIGHTS);
    for (let i = 0; i < MAX_LIGHTS; i++) {
      const p = this.u.uLPos.value[i];
      const c = this.u.uLCol.value[i];
      if (p === undefined || c === undefined) continue;
      const r = ranked[i];
      if (r === undefined) { p.set(0, -999, 0, 1); c.set(0, 0, 0); continue; }
      const rad = Math.max(r.e.w, r.e.h) * 2.2 + 1.5;
      p.set(r.e.at.x, r.e.at.y, r.e.at.z, 1 / (rad * rad));
      c.set(r.e.color.r * r.e.spill, r.e.color.g * r.e.spill, r.e.color.b * r.e.spill);
    }
  }
}
