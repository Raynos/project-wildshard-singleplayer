import { parseWorldEntry, type WorldEntryRows } from '@wildshard/format/worldEntry';
import { BLEND_ADD_KEEP_ALPHA } from '@wildshard/game/plugin/shaderFamily';
import canopy from '../data/canopy.json' with { type: 'json' };
import light from '../data/light.json' with { type: 'json' };

/**
 * Nine Dragon Stack's declared world entry (the world/scenes section's entry, run by @wildshard/game/shardfile/worldEntry in
 * world/build.ts): the portals, the banyan crown's looks and its dressing root, the wet floor's reflection cards for
 * this deck ending (`capped` standalone, `open` in a grid cell) with the streak and halo looks they draw in.
 */
export function nineWorldEntry(): WorldEntryRows {
  return parseWorldEntry({ blocks: {
    portals: [{ kind: 'attach', id: 'portals.root', as: 'group' }],
    canopy: canopy.draws.map(draw => ({ kind: 'look', look: draw.look, state: draw.state })),
    dressing: [{ kind: 'attach', id: 'dressing.root', as: 'group' }],
    cards: [
      { kind: 'look', look: 'nine-streaks', state: { transparent: true, ...BLEND_ADD_KEEP_ALPHA } },
      { kind: 'look', look: 'nine-halo', state: light.haloState },
      { kind: 'attach', id: 'cards-capped.root', as: 'group', when: { variant: 'capped' } },
      { kind: 'attach', id: 'cards-open.root', as: 'group', when: { variant: 'open' } },
    ],
  } });
}
