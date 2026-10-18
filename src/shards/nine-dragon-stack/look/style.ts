// 界画霓虹 Jiehua Neon (runtime/looks/look.ts: the programs and the blue-hour look).
// SHARD-PLATFORM M3: the programs and the shared uniforms are rows in runtime/looks/look.ts on the SDK shader family
// (@wildshard/sdk/looks/shaderFamily); this module makes the family (the splices the data cannot hold), the live shared
// uniforms and each material.
import { Color, DataTexture, LinearMipmapLinearFilter, RedFormat, RepeatWrapping, UnsignedByteType, type Material, type Texture, type IUniform } from 'three';
import { uniformsFrom, type UniformsOf } from '@wildshard/sdk/looks/shaderFamily';
import { lentLook } from '@wildshard/sdk/looks/lentLooks';
import { syncArchitecture } from './facadeMaterial';
import { Y0 } from '../layout';
import { paintUniforms } from './paint';
import { FLAG } from '../runtime/looks/paint';
// the baked light volume (lab P6): warm pools from every lantern, shop, lamp, sign and lit window
import { lightVolUniforms } from './light/lightvol';
import { LIGHTVOL_GLSL } from '../runtime/looks/light';
import { METAL, SUTRA } from '../util';
import { fogBandWindow } from '../runtime/looks/fogBands';
import { SHARED_UNIFORMS } from '../runtime/looks/look';

/** the splices only the shard knows (the datum, the flagstones, paint, light) */
export const LOOK_FRAGMENTS: Readonly<Record<string, string>> = { y0: String(Y0), flagRh: FLAG.rh.toFixed(3), lightvol: LIGHTVOL_GLSL };
/** the family: the data's programs, with the splices only the shard knows (the datum, the flagstones, paint, light) */


const c = (hex: number): Color => new Color(hex);

export type Uniforms = Record<string, IUniform>;

/** Restore an exact baked R8 weave, retaining the original sampler and mip generation. */
export function restoreWeave(data: Uint8Array): DataTexture {
  if (data.length !== 256 * 256) throw new Error('Nine silk weave must contain 256 × 256 R8 texels');
  const texture = new DataTexture(data, 256, 256, RedFormat, UnsignedByteType);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function sharedUniforms(silk: Texture): UniformsOf<typeof SHARED_UNIFORMS> & {
  uSilver: { value: Color }; uGold: { value: Color }; uPaper: { value: Color }; uPaperDeep: { value: Color }; uSilk: { value: Texture };
} & ReturnType<typeof paintUniforms> & ReturnType<typeof lightVolUniforms> {
  return {
    ...uniformsFrom(SHARED_UNIFORMS),
    uSilver: { value: c(METAL.silver) },
    uGold: { value: c(METAL.gold) },
    uPaper: { value: c(SUTRA.indigo) },
    uPaperDeep: { value: c(SUTRA.deep) },
    uSilk: { value: silk },
    // the painted surfaces (paint.ts, merged from lab P5): the texture array and its strengths
    ...paintUniforms(),
    ...lightVolUniforms(),
  };
}

/** uniforms every world program shares (one object each, so a write reaches every material) */
export class Shared {
  readonly u;
  constructor(silk: Texture) { this.u = sharedUniforms(silk); }

  /**
   * (E283) the silk fog's band window for the eye at uCam (call it after every uCam write): the bands run top to bottom,
   * each reaching 3 widths either side of its height, so a ray going down from the eye can reach no band before the
   * first whose bottom is at or under the eye, and a ray going up none after the last whose top is at or over it — and
   * past the first band the ray's far end cannot reach, no later one either. silkFog then walks only those bands, in the
   * same order, with the same test on each: the same fog, bit for bit. Off (z 0) if the bands ever stop running top to
   * bottom (@wildshard/sdk/looks/fogBands).
   */
  bandWindow(): void { fogBandWindow(this.u.uBands.value, this.u.uCam.value.y, this.u.uBandWin.value); }
}

export function jiehuaMaterial(shared: Shared, opt: { alphaCut?: boolean; viewmodel?: boolean; doubleSide?: boolean } = {}): Material {
  syncArchitecture(shared.u);
  return lentLook(opt.alphaCut === true ? 'nine-architecture-cut' : 'nine-architecture');
}
