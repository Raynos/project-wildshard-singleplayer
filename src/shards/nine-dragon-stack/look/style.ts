// 界画霓虹 Jiehua Neon (runtime/looks/look.ts: the programs and the blue-hour look).
// SHARD-PLATFORM M3: the programs and the shared uniforms are rows in runtime/looks/look.ts on the SDK shader family
// (@wildshard/sdk/looks/shaderFamily); this module makes the family (the splices the data cannot hold), the live shared
// uniforms and each material.
import { DataTexture, LinearMipmapLinearFilter, RedFormat, RepeatWrapping, UnsignedByteType, type Texture } from 'three';
import { uniformsFrom } from '@wildshard/sdk/looks/shaderFamily';
import metadata from '../boot/metadata.generated.json' with { type: 'json' };
import type { LookRows } from '../boot/lookTypes.generated';
// the baked light volume (lab P6): warm pools from every lantern, shop, lamp, sign and lit window
import { lightVolUniforms } from './light';
import type { SharedUniformRows } from './uniformTypes';

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

function sharedUniforms(silk: Texture, rows: SharedUniformRows) {
  return {
    ...uniformsFrom({ ...rows }),
    uSilk: { value: silk },
    // the painted surfaces' strengths (merged from lab P5; their texture array is a lent world-scene texture)
    ...uniformsFrom((metadata.looks.paint as LookRows['paint']).uniforms),
    ...lightVolUniforms(),
    // the silk fog's band depth against its authored depth (a capture that clears the bands scales it), written each frame
    // by the look's 'nine.frame' channel group (generators/frameChannels.ts)
    bandDepth: { value: 1 },
  };
}

/** uniforms every world program shares (one object each, so a write reaches every material) */
export class Shared {
  readonly u;
  constructor(silk: Texture, rows: SharedUniformRows) { this.u = sharedUniforms(silk, rows); }
}
