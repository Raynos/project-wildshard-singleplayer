import { parseWorldEntry, type WorldEntryRows } from '@wildshard/format/worldEntry';
import { BLEND_ADD_KEEP_ALPHA } from '@wildshard/game/plugin/shaderFamily';
import canopy from '../data/canopy.json' with { type: 'json' };
import light from '../data/light.json' with { type: 'json' };
import { nineWorldInstallRows, type NinePhysicsPlacement } from './physicsPlacements';
import worldRows from '../data/worldRows.generated.json' with { type: 'json' };
import deckFloors from '../data/deckFloors.generated.json' with { type: 'json' };

/**
 * Nine Dragon Stack's declared world entry (the world/scenes section's entry, run by @wildshard/game/shardfile/worldEntry in
 * world/build.ts): the portals, the banyan crown's looks and its dressing root, the wet floor's reflection cards for
 * this deck ending (`capped` standalone, `open` in a grid cell) with the streak and halo looks they draw in, and the
 * square's floors piece for each ending (the plugin runs `pieces` once the world stands).
 */
export function nineWorldEntry(): WorldEntryRows {
  // the walkable square and stacks as one piece: its stone colliders for the ending, the world's floors then the decks' (first)
  const install = nineWorldInstallRows();
  const floors = (variant: 'capped' | 'open', rows: readonly NinePhysicsPlacement[]) => {
    const row = rows.find(entry => entry.id === 'nds-floors'); if (row === undefined) throw new Error('Missing Nine floors piece');
    return { kind: 'piece', when: { variant }, id: row.id, name: row.name, file: row.file, category: 'buildings', surface: 'stone', colliders: row.colliders,
      floors: [...worldRows.rows.floors, ...deckFloors], floorPolicy: 'first', solidFloor: true };
  };
  return parseWorldEntry({ blocks: {
    pieces: [floors('capped', install.standalone), floors('open', install.cell)],
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
