/**
 * A live region's light on the page's one sky (SHARD-PLATFORM G223 / SF48-g, E435). There is one sun, one fill, one
 * sky rig, one set of fog and painterly uniforms and one colour chain on a grid page (SF19a). A trusted runtime admitted
 * as a neighbour region lights them the way it lights its own standalone page: its day clock, weather and look rig write
 * the key light, the fill, the sun disc, the shadow maps, the painterly and fog uniforms, the volumetric light and the
 * engine grade every frame, and a few of those once at build.
 *
 * Honest per value:
 * - **its air and grade** already reach the one frame through `frameLook.ts` (its own fog object, its level's grade);
 * - **everything else it lights** is a region-scoped override of the shared state: held when the region is entered, put
 *   back exactly when it is left (so the road, or the next cell, finds the page as it was), and the region's own values
 *   come back on its next entry (its once-at-build writes, such as a phone shadow map size, survive the round trip).
 *   The override swaps at the interior crossing; it is not blended across the 16 m edge band (only the air and grade are).
 *
 * The painterly clock `uPTime` is a clock, not a look, and keeps running. Generic game code (E405): no shard is named here.
 */
import { Color, Vector3, type Vector4 } from 'three';
import { fogUniforms, weatherFogUniforms, weatherUniforms } from '@wildshard/engine/world/Atmosphere';
import { painterlyUniforms } from '@wildshard/engine/world/painterly';
import type { ShardWorld } from '../shard/world';

type UniformValue = number | Color | Vector3 | Vector4;
type UniformSet = Readonly<Record<string, { value: UniformValue }>>;

/** Hold every value of a shared uniform set (bar `skip`); the returned function puts each back in place. */
export function holdUniforms(set: UniformSet, skip: readonly string[] = []): () => void {
  const held: (() => void)[] = [];
  for (const [key, uniform] of Object.entries(set)) {
    if (skip.includes(key)) continue;
    const value = uniform.value;
    if (typeof value === 'number') held.push(() => { uniform.value = value; });
    else if (value instanceof Color) { const copy = value.clone(); held.push(() => { value.copy(copy); }); }
    else if (value instanceof Vector3) { const copy = value.clone(); held.push(() => { value.copy(copy); }); }
    else { const copy = value.clone(); held.push(() => { value.copy(copy); }); }
  }
  return () => { for (const restore of held) restore(); };
}

/** What a page's shared light is read from: its sky rig and its composer's grade chain (null before it is built). */
export interface PageLight {
  readonly sky: Pick<ShardWorld['sky'], 'holdLight'>;
  readonly game: Pick<ShardWorld['game'], 'post' | 'volumetrics'>;
}

/**
 * Hold the page's whole shared light: the sky rig's light (`SkyRig.holdLight`), the painterly uniforms (bar their clock),
 * the fog, weather and weather-fog uniforms, the engine grade (split tone, saturation, contrast, brightness) and the
 * volumetric light (built with the grade). The returned function puts it all back.
 */
export function holdPageLight(page: PageLight): () => void {
  const held = [page.sky.holdLight(), holdUniforms(painterlyUniforms, ['uPTime']), holdUniforms(fogUniforms), holdUniforms(weatherUniforms), holdUniforms(weatherFogUniforms)];
  const post = page.game.post;
  if (post !== null) {
    const saturation = post.saturation.saturation, contrast = post.contrast.contrast, brightness = post.contrast.brightness;
    held.push(post.grade.hold(), page.game.volumetrics.holdLight(), () => {
      post.saturation.saturation = saturation; post.contrast.contrast = contrast; post.contrast.brightness = brightness;
    });
  }
  return () => { for (const restore of held.reverse()) restore(); };
}

/**
 * One region's light swap, for each entry: hold the page's light, put the region's own last light back (none on the first
 * entry: its runtime lights the page as it builds), and on leave hold the region's light for next time and put the page's
 * back. `hold` reads the shared state (`holdPageLight` in the browser).
 */
export function regionLightSwap(hold: () => () => void): (entry: { readonly onDispose: (fn: () => void) => void }) => void {
  let region: (() => void) | null = null;
  return (entry) => {
    const page = hold();
    region?.();
    entry.onDispose(() => { region = hold(); page(); });
  };
}
