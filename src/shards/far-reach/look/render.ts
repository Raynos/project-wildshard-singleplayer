import { Group, type Texture } from 'three';
import { loadLUT } from '@wildshard/engine/boot/bakedApi';
import { TIER } from '@wildshard/engine/core/tier';
import { paintedLook, type PaintedDressing, type PaintedDressingContext } from '@wildshard/engine/render/dataLook';
import type { LookStrategy } from '@wildshard/engine/render/look';
import { DayCycle } from '@wildshard/engine/world/dayCycle';
import { loadPaintedTexture } from '@wildshard/game/plugin/geometry';
import { cardGroup } from '@wildshard/sdk/looks/cardField';
import { discLayer } from '../runtime/looks/discLayer';
import { SKY_DRESSING, SKY_PAINTED } from '../data/skyPaintedLook';

/**
 * Sky Reach's look (the engine's `paintedLook`; the style bible is docs/design/far-reach/style-bible.md): the clean chain
 * under the NEUTRAL curve (E399: AgX compressed the top 1 % to 223-228 where the mockups reach 236-241), a painted
 * golden-hour dome (ONE seamless painted 360° panorama, art/far-reach/round-14-loop-4/pano/, on its graph
 * data/skyDomeLook.ts; offline or on a test page the look's haze strip stands in), the painted light and the heading haze,
 * a layered painted cloud sea (data/cloudSeaLook.ts) and the shard grade (one learned LUT, art/far-reach/round-32-lut/).
 * The panorama paints the one sun (council R1B-1); its god rays (E398) rise from it. Every number is a row of
 * data/skyPaintedLook.ts (the look, its haze, clock, images and dressing, from data/skyLook.ts and data/lookTextures.ts).
 */
export async function skyReachLook(): Promise<LookStrategy> {
  const [pano = null, cloudAtlas = null, seaPaint = null, vortex = null] = await Promise.all([SKY_PAINTED.images.pano[TIER], ...SKY_PAINTED.images.rest]
    .map((row) => loadPaintedTexture(row.url, row.name, row.warn, row.sampler)));
  const dressing = async (ctx: PaintedDressingContext): Promise<PaintedDressing> => {
    const group = new Group(), rows = SKY_DRESSING; group.name = 'far.sky-dressing';
    const glow = await ctx.graph(rows.glow.graph); cardGroup({ material: () => glow }, rows.glow.cards, {}, { into: group });
    if (seaPaint !== null) {
      if (vortex !== null) group.add(discLayer(await ctx.graph(rows.maelstrom.graph, () => vortex), rows.maelstrom.disc));
      for (const sea of rows.seas) group.add(discLayer(await ctx.graph(sea.graph, () => seaPaint), sea.disc));
    }
    if (cloudAtlas !== null) { const puff = await ctx.graph(rows.cumulus.graph, () => cloudAtlas); cardGroup({ material: () => puff }, rows.cumulus.cards, {}, { into: group }); }
    return { group, textures: [], update: () => undefined };
  };
  return paintedLook({ ...SKY_PAINTED.look, textures: [pano, cloudAtlas, seaPaint, vortex].filter((texture): texture is Texture => texture !== null), dressing,
    sky: { haze: SKY_PAINTED.haze, graph: (strip) => ({ ir: SKY_PAINTED.dome[TIER], textures: (ref) => (ref === 'haze' ? strip : pano ?? strip) }) },
    clock: () => new DayCycle(SKY_PAINTED.day), lut: () => loadLUT('far-reach') });
}
