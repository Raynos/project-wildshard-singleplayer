import inventory from '../data/fixedGeometry.json' with { type: 'json' };
import page from '../data/questPageComposition.json' with { type: 'json' };
import stall from '../data/traderStall.json' with { type: 'json' };
import { CASTAWAY_SMOKE, SMOKE_LOOK } from './smokeLook';
import * as v from 'valibot';
import { QuestFiguresSchema, type QuestFiguresRows } from '@wildshard/format/questFigures';

/** Literal bindings over the original kit rigs. The compiled figure installer
 * resolves QuestPlace frames once; fire-relative geometry stays in that frame. */
export function driftwoodQuestFigures(): QuestFiguresRows {
  const { flames, ...castaway } = inventory.groups.npc.castaway;
  return v.parse(QuestFiguresSchema, { figures: [{
    id: page.speaker.figure, kit: 'castaway', feet: page.speaker.feet, fire: page.speaker.fire,
    parts: castaway, campAt: 'fire',
    objects: [
      { id: 'flames', kind: 'basic-mesh', draw: flames, colour: [1.8, 1.8, 1.8], vertexColors: true,
        at: 'fire', lift: .08, name: 'castaway-flame' },
      { id: 'smoke', kind: 'cloud', draw: 'castawaySmoke', look: SMOKE_LOOK, name: CASTAWAY_SMOKE.name,
        center: CASTAWAY_SMOKE.bounds.offset, radius: CASTAWAY_SMOKE.bounds.radius, order: CASTAWAY_SMOKE.renderOrder,
        at: 'fire', seeds: false },
    ],
    publish: [{ id: 'castaway.fitted-head', draw: 'wendellHead' }],
    system: { id: page.systems.speakerPose, before: [page.systems.talks] },
  }, {
    id: page.trader.figure, kit: 'trader', feet: stall.placement.feet, parts: inventory.groups.npc.trader,
    piece: page.trader.figure, card: 'trader', name: 'The trader',
    counter: { model: 'tradeCounter', ahead: stall.placement.counterAhead, piece: page.trader.counter,
      name: "The trader's counter", solidFloor: false },
    system: { id: page.systems.traderPose, before: [page.systems.trader] },
  }] });
}
