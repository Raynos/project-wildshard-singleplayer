import { DataTexture, LinearFilter, RepeatWrapping, RGBAFormat, UnsignedByteType } from 'three';
import SEA_BAKE from '../data/seaTexture.json' with { type: 'json' };

/**
 * The cloud sea (review 2026-10-01 item 2): two layered sheets under the islands instead of the engine's one flat plane.
 * The low sheet is an opaque floor of cloud; the high one is a field of loose puffs that drift over it, so the sea has
 * depth and parallax. Both sample one small tileable cloud texture, baked once, and are lit from the low sun: tops toward
 * the sun gold-pink, shade mauve, melting into the horizon gold with distance. The kill height (`world.killY`) sits just
 * above the high sheet, so a fall ends inside the cloud. The sheets, the maelstrom and the painted sea and vortex are disc
 * rows of an SDK shader family (data/cloudSeaLook.ts, `@wildshard/sdk/looks/discLayer`); look/render.ts adds them.
 */
/** `maelstrom`: the sea twists toward an eye under the storm crown (x, z, falloff radius m). */
export const SEA = { size: 64, low: -48, high: -34, radius: 1400, handoff: [240, 700], maelstrom: { x: 0, z: -190, r: 95 } } as const;

/**
 * The cloud sea's small tileable cloud texture (R: density; G: lit, the side of a puff that faces the low sun), baked
 * offline for the fixed sun's heading (SF72: generators/seaTexture.ts → data/seaTexture.json); uploaded once.
 */
export function seaTexture(): DataTexture {
  const bytes = Uint8Array.from(atob(SEA_BAKE.rgba), (c) => c.codePointAt(0) ?? 0);
  const tex = new DataTexture(bytes, SEA_BAKE.size, SEA_BAKE.size, RGBAFormat, UnsignedByteType);
  tex.wrapS = RepeatWrapping; tex.wrapT = RepeatWrapping; tex.magFilter = LinearFilter; tex.minFilter = LinearFilter; tex.needsUpdate = true;
  return tex;
}
