import { Group, type Texture } from 'three';
import { loadLUT } from '@wildshard/engine/boot/bakedApi';
import { TIER } from '@wildshard/engine/core/tier';
import { paintedLook, type PaintedDressing, type PaintedDressingContext } from '@wildshard/engine/render/dataLook';
import type { LookStrategy } from '@wildshard/engine/render/look';
import { DayCycle } from '@wildshard/engine/world/dayCycle';
import { loadPaintedTexture } from '@wildshard/game/plugin/geometry';
import { cardGroup } from '@wildshard/sdk/looks/cardField';
import { discLayer } from '../runtime/looks/discLayer';
import * as v from 'valibot';
import { validateGraph, type GraphIr } from '@wildshard/format/materialGraph';
import { SKY_PAINTED } from '../data/skyPaintedLook';

// The dome's and dressing's finished SF59 graphs, card fields and discs (generators/skyDressing.ts, built by the
// `sky-dressing` job into data/skyDressing.generated.json), admitted once here. P2a's product.section() replaces the
// JSON import behind SKY_PAINTED.dressing; this schema becomes its section schema.
const graph = v.pipe(v.unknown(), v.rawTransform(({ dataset, addIssue, NEVER }): GraphIr => {
  const checked = validateGraph(dataset.value, { trustedBudget: true });
  if (!checked.ok) { addIssue({ message: checked.errors.join('; ') }); return NEVER; }
  return checked.graph;
}));
const cards = v.object({ name: v.string(), order: v.number(), plane: v.tuple([v.number(), v.number()]),
  cards: v.array(v.object({ program: v.string(), instances: v.record(v.string(), v.object({ size: v.number(), float32: v.string() })) })) });
const disc = v.object({ name: v.string(), program: v.string(), radius: v.number(), segments: v.number(), at: v.tuple([v.number(), v.number(), v.number()]), order: v.number(), spin: v.exactOptional(v.number()) });
const DressingSchema = v.object({ dome: v.object({ phone: graph, desktop: graph }), glow: v.object({ graph, cards }), maelstrom: v.object({ graph, disc }),
  seas: v.array(v.object({ graph, disc })), cumulus: v.object({ graph, cards }) });

/**
 * Sky Reach's look (the engine's `paintedLook`; the style bible is docs/design/far-reach/style-bible.md): the clean chain
 * under the NEUTRAL curve (E399: AgX compressed the top 1 % to 223-228 where the mockups reach 236-241), a painted
 * golden-hour dome (ONE seamless painted 360° panorama, art/far-reach/round-14-loop-4/pano/, on its graph
 * generators/skyDomeLook.ts; offline or on a test page the look's haze strip stands in), the painted light and the heading haze,
 * a layered painted cloud sea (generators/cloudSeaLook.ts) and the shard grade (one learned LUT, art/far-reach/round-32-lut/).
 * The panorama paints the one sun (council R1B-1); its god rays (E398) rise from it. Every number is a row of
 * data/skyPaintedLook.ts (the look, its haze, clock and images, from data/skyLook.ts); the dome and dressing graphs are
 * data/skyDressing.generated.json.
 */
export async function skyReachLook(): Promise<LookStrategy> {
  const rows = v.parse(DressingSchema, SKY_PAINTED.dressing);
  const [pano = null, cloudAtlas = null, seaPaint = null, vortex = null] = await Promise.all([SKY_PAINTED.images.pano[TIER], ...SKY_PAINTED.images.rest]
    .map((row) => loadPaintedTexture(row.url, row.name, row.warn, row.sampler)));
  const dressing = async (ctx: PaintedDressingContext): Promise<PaintedDressing> => {
    const group = new Group(); group.name = 'far.sky-dressing';
    const glow = await ctx.graph(rows.glow.graph); cardGroup({ material: () => glow }, rows.glow.cards, {}, { into: group });
    if (seaPaint !== null) {
      if (vortex !== null) group.add(discLayer(await ctx.graph(rows.maelstrom.graph, () => vortex), rows.maelstrom.disc));
      for (const sea of rows.seas) group.add(discLayer(await ctx.graph(sea.graph, () => seaPaint), sea.disc));
    }
    if (cloudAtlas !== null) { const puff = await ctx.graph(rows.cumulus.graph, () => cloudAtlas); cardGroup({ material: () => puff }, rows.cumulus.cards, {}, { into: group }); }
    return { group, textures: [], update: () => undefined };
  };
  return paintedLook({ ...SKY_PAINTED.look, textures: [pano, cloudAtlas, seaPaint, vortex].filter((texture): texture is Texture => texture !== null), dressing,
    sky: { haze: SKY_PAINTED.haze, graph: (strip) => ({ ir: rows.dome[TIER], textures: (ref) => (ref === 'haze' ? strip : pano ?? strip) }) },
    clock: () => new DayCycle(SKY_PAINTED.day), lut: () => loadLUT('far-reach') });
}
