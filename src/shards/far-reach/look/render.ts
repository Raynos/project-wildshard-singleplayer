import { Group, Vector3, type Texture } from 'three';
import { loadLUT } from '@wildshard/engine/boot/bakedApi';
import { TIER } from '@wildshard/engine/core/tier';
import { paintedLook, type PaintedDressing, type PaintedDressingContext } from '@wildshard/engine/render/dataLook';
import type { LookStrategy } from '@wildshard/engine/render/look';
import { DayCycle } from '@wildshard/engine/world/dayCycle';
import { loadPaintedTexture } from '@wildshard/game/plugin/geometry';
import { discLayer } from '../runtime/looks/discLayer';
import { SEA_DISCS, SEA_LAYERS, paintedMaelstromGraph, paintedSeaGraph } from '../data/cloudSeaLook';
import { cardGroup } from '@wildshard/sdk/looks/cardField';
import { SKY_CARDS } from '../data/skyCards';
import { cumulusGraph, fieldCards } from '../data/skyCardsLook';
import { SUN_GLOW_FIELD, sunGlowGraph } from '../data/sunGlowLook';
import { SKY, SKY_DAY, SKY_FOG, SKY_HAZE, SKY_KEY, SKY_PAINTER_LIGHT, SKY_RAYS, SKY_SUN } from '../data/skyLook';
import { SKY_DOME_GRAPH, SKY_LOOK_TEXTURES } from '../data/lookTextures';
import { PANO_FOG_SRGB } from './panoramaData';

/**
 * Sky Reach's look (the engine's `paintedLook`; the style bible is docs/design/far-reach/style-bible.md): the clean chain
 * under the NEUTRAL curve (E399: AgX compressed the top 1 % to 223-228 where the mockups reach 236-241), a painted
 * golden-hour dome (ONE seamless painted 360° panorama, art/far-reach/round-14-loop-4/pano/, on its graph
 * data/skyDomeLook.ts; offline or on a test page the look's haze strip stands in), the painted light and the heading haze,
 * a layered painted cloud sea (data/cloudSeaLook.ts) and the shard grade (one learned LUT, art/far-reach/round-32-lut/).
 * The panorama paints the one sun (council R1B-1); its god rays (E398) rise from it. Every number is a row of
 * data/skyLook.ts (the fixed clock, key, fog, palette, light and haze) or data/lookTextures.ts (the images).
 */
export async function skyReachLook(): Promise<LookStrategy> {
  const [pano = null, cloudAtlas = null, seaPaint = null, vortex = null] = await Promise.all([SKY_LOOK_TEXTURES.pano[TIER], ...SKY_LOOK_TEXTURES.rest]
    .map((row) => loadPaintedTexture(row.url, row.name, row.warn, row.sampler)));
  const dressing = async (ctx: PaintedDressingContext): Promise<PaintedDressing> => {
    const group = new Group(); group.name = 'far.sky-dressing';
    // the sun's bloom and light shafts at the painted sun (E392): one instanced draw of its material graph
    const glow = await ctx.graph(sunGlowGraph(SKY_SUN, SUN_GLOW_FIELD.distance));
    cardGroup({ material: () => glow }, SUN_GLOW_FIELD, {}, { into: group });
    // the painted cloud sea (E392) and the painted maelstrom under the crown; without their textures, no sea is drawn
    if (seaPaint !== null) {
      if (vortex !== null) group.add(discLayer(await ctx.graph(paintedMaelstromGraph('far.maelstrom'), () => vortex), SEA_DISCS.paintedMaelstrom));
      for (const upper of [false, true]) {
        const layer = upper ? SEA_LAYERS.upper : SEA_LAYERS.lower;
        group.add(discLayer(await ctx.graph(paintedSeaGraph('far.cloudsea', layer.gain, layer.crown), () => seaPaint), upper ? SEA_DISCS.paintedSeaUpper : SEA_DISCS.paintedSea));
      }
    }
    // cumulus over the sea (loop 5): the islands rise out of billowing cloud (the camera-facing puffs baked by generators/skyCards.ts)
    if (cloudAtlas !== null) { const puff = await ctx.graph(cumulusGraph(SKY_SUN, 'far.cumulus'), () => cloudAtlas); cardGroup({ material: () => puff }, fieldCards(SKY_CARDS.cumulus), {}, { into: group }); }
    return { group, textures: [], update: () => undefined };
  };
  return paintedLook({ textures: [pano, cloudAtlas, seaPaint, vortex].filter((texture): texture is Texture => texture !== null), dressing,
    sky: { haze: { ...SKY_HAZE, ...SKY_FOG, strip: PANO_FOG_SRGB }, graph: (strip) => ({ ir: SKY_DOME_GRAPH[TIER], textures: (ref) => (ref === 'haze' ? strip : pano ?? strip) }) },
    light: SKY_PAINTER_LIGHT, sun: { ...SKY_KEY, dir: new Vector3(...SKY_SUN) }, fog: { color: SKY.fog, near: SKY_FOG.near, far: SKY_FOG.far }, horizon: SKY.horizon,
    neutral: true, rays: SKY_RAYS, clock: () => new DayCycle(SKY_DAY), lut: () => loadLUT('far-reach') });
}
