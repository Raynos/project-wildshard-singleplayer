import { expect, test } from 'vitest';
import { driftwoodQuestFigures } from '../src/shards/driftwood-isle/generators/questFigures';
import { FIGURE_CATALOGUE } from '../src/shards/driftwood-isle/generators/figureCatalogue';
import { siteCatalogue } from '../src/shards/driftwood-isle/generators/siteCatalogue';
import { parseWorldSceneModels } from '../src/format/worldSceneModels';
import inventory from '../src/shards/driftwood-isle/data/fixedGeometry.json' with { type: 'json' };
import page from '../src/shards/driftwood-isle/data/questPageComposition.json' with { type: 'json' };
import stall from '../src/shards/driftwood-isle/data/traderStall.json' with { type: 'json' };

test('entered figures resolve real kit, fixed-draw, model and quest identities in original order', () => {
  const rows = driftwoodQuestFigures().figures;
  const slots = new Set<string>(inventory.draws.map(draw => draw.slot));
  const kits = new Set(Object.keys(FIGURE_CATALOGUE.figures));
  const models = new Set(parseWorldSceneModels(siteCatalogue()).models.map(model => model.key));
  expect(rows.map(row => row.id)).toEqual([page.speaker.figure, page.trader.figure]);
  for (const row of rows) {
    expect(kits.has(row.kit)).toBe(true);
    for (const slot of [...Object.values(row.parts), ...row.objects.map(object => object.draw), ...row.publish.map(publication => publication.draw)]) expect(slots.has(slot)).toBe(true);
    if (row.card !== undefined) expect(models.has(row.card)).toBe(true);
    if (row.counter !== undefined) { expect(models.has(row.counter.model)).toBe(true); expect(row.counter.piece).toBe(page.trader.counter); }
  }
  expect(rows[0]?.system).toEqual({ id: page.systems.speakerPose, before: [page.systems.talks] });
  expect(rows[1]?.system).toEqual({ id: page.systems.traderPose, before: [page.systems.trader] });
  expect(rows[1]?.feet).toEqual(stall.placement.feet);
  expect(rows[1]?.counter?.ahead).toBe(stall.placement.counterAhead);
});
