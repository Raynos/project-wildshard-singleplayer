import { DataTexture, LinearFilter, RepeatWrapping, RGBAFormat, UnsignedByteType } from 'three';
import SEA_BAKE from '../data/seaTexture.json' with { type: 'json' };

/**
 * The cloud sea's small tileable cloud texture (R: density; G: lit, the side of a puff that faces the low sun), baked
 * offline for the fixed sun's heading (SF72: generators/seaTexture.ts → data/seaTexture.json); uploaded once. The sea's
 * sheets, the maelstrom and the painted sea and vortex are disc rows of an SDK shader family (data/cloudSeaLook.ts,
 * its layout data/skyLook.ts `SEA`); look/render.ts adds them.
 */
export function seaTexture(): DataTexture {
  const bytes = Uint8Array.from(atob(SEA_BAKE.rgba), (c) => c.codePointAt(0) ?? 0);
  const tex = new DataTexture(bytes, SEA_BAKE.size, SEA_BAKE.size, RGBAFormat, UnsignedByteType);
  tex.wrapS = RepeatWrapping; tex.wrapT = RepeatWrapping; tex.magFilter = LinearFilter; tex.minFilter = LinearFilter; tex.needsUpdate = true;
  return tex;
}
