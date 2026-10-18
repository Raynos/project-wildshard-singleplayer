import { SKY_PAINTED } from './rows/skyPaintedLook';
import { parsePaintedLook, type PaintedLookRow } from '@wildshard/format/paintedLook';
import { MaterialsSchema } from '@wildshard/format/materials';
import { validateGraph } from '@wildshard/format/materialGraph';
import * as v from 'valibot';
import { SKY_WORLD_PREPARATION } from './worldTextures';

/** Resolve the fixed golden-hour look, image samplers and dressing graphs offline. */
export function paintedLookRows(): unknown {
  const { look, day, haze, ...rows } = SKY_PAINTED;
  return { ...rows, look: { ...look, lightScope: 'page', clock: day, sky: { kind: 'haze', row: haze } } };
}

/** Product presentation preserves original image samplers, geometry and draw order. */
export function skyPaintedPresentation(): PaintedLookRow {
  const { look, images, dressing } = SKY_PAINTED;
  const disc = (row: typeof dressing.maelstrom.disc, graph: string, image: string) => ({ name: row.name, graph, image, order: row.order, at: row.at,
    ...('spin' in row ? { spin: row.spin } : {}), geometry: { kind: 'disc', radius: row.radius, segments: row.segments } });
  const cards = (row: typeof dressing.glow.cards | typeof dressing.cumulus.cards, graph: string, image?: string) => row.cards.map(card => ({ name: row.name, graph,
    ...(image === undefined ? {} : { image }), order: row.order, geometry: { kind: 'plane', size: row.plane, instances: card.instances } }));
  return parsePaintedLook({ look: { ...look, lightScope: 'page', clock: SKY_PAINTED.day, sky: { kind: 'haze', row: SKY_PAINTED.haze } },
    lut: '/assets/lut/far-reach.bin', images: { pano: images.pano, cloud: images.rest[0], sea: images.rest[1], vortex: images.rest[2],
      ...Object.fromEntries(SKY_WORLD_PREPARATION.textures.map(({ id, phase: _phase, ...image }) => [id, image])) },
    bumps: SKY_WORLD_PREPARATION.bumps.map(({ material, texture, channel, scale }) => ({ material, image: texture, channel, scale })),
    dome: { graph: { phone: 'sky-dome-phone', desktop: 'sky-dome-desktop' }, image: 'pano' },
    dressing: { name: 'far.sky-dressing', draws: [...cards(dressing.glow.cards, 'sky-glow'), disc(dressing.maelstrom.disc, 'sky-maelstrom', 'vortex'),
      ...dressing.seas.map((row, i) => disc(row.disc, `sky-sea-${i}`, 'sea')), ...cards(dressing.cumulus.cards, 'sky-cumulus', 'cloud')] } });
}

/** Graphs are material-book entries, with no nested custom shader sections. */
const graphs: Readonly<Record<string, unknown>> = {
  'sky-dome-phone': SKY_PAINTED.dressing.dome.phone, 'sky-dome-desktop': SKY_PAINTED.dressing.dome.desktop,
  'sky-glow': SKY_PAINTED.dressing.glow.graph, 'sky-maelstrom': SKY_PAINTED.dressing.maelstrom.graph,
  ...Object.fromEntries(SKY_PAINTED.dressing.seas.map((row, i) => [`sky-sea-${i}`, row.graph])), 'sky-cumulus': SKY_PAINTED.dressing.cumulus.graph,
};
export const SKY_PAINTED_GRAPHS = v.parse(MaterialsSchema, Object.fromEntries(Object.entries(graphs).map(([id, input]) => {
  const checked = validateGraph(input, { trustedBudget: true });
  if (!checked.ok) throw new Error(checked.errors.join('; '));
  const graph = checked.graph;
  return [id, { family: 'graph', graph: { ...graph, params: Object.fromEntries(Object.entries(graph.params ?? {}).map(([name, param]) =>
    [name, { ...param, ...(param.type === 'texture' ? { role: 'lent' } : {}) }])) } }];
})));
