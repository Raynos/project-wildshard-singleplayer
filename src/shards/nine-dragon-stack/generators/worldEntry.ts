import { parseWorldEntry, type WorldEntryRows } from '@wildshard/format/worldEntry';
import { BLEND_ADD_KEEP_ALPHA } from '@wildshard/game/plugin/shaderFamily';
import canopy from '../data/canopy.json' with { type: 'json' };
import light from '../data/light.json' with { type: 'json' };
import { nineWorldInstallRows, type NinePhysicsPlacement } from './physicsPlacements';
import worldRows from '../data/worldRows.generated.json' with { type: 'json' };
import deckFloors from '../data/deckFloors.generated.json' with { type: 'json' };
import { LAYOUT_PLACEMENTS, SET_PLACEMENTS } from './worldScenes';

/**
 * Nine Dragon Stack's declared world entry (the world/scenes section's entry, run by @wildshard/game/shardfile/worldEntry in
 * world/build.ts): the portals, the banyan crown's looks and its dressing root, the wet floor's reflection cards for
 * this deck ending (`capped` standalone, `open` in a grid cell) with the streak and halo looks they draw in, the
 * catalogue placements the build reaches in turn (the square's lions and sets, the hung lanterns, the wall kit, the hook
 * and the crowd), and the square's floors piece for each ending (the plugin runs `pieces` once the world stands).
 */
export function nineWorldEntry(): WorldEntryRows {
  // the walkable square and stacks as one piece: its stone colliders for the ending, the world's floors then the decks' (first)
  const install = nineWorldInstallRows();
  const floors = (variant: 'capped' | 'open', rows: readonly NinePhysicsPlacement[]) => {
    const row = rows.find(entry => entry.id === 'nds-floors'); if (row === undefined) throw new Error('Missing Nine floors piece');
    return { kind: 'piece', when: { variant }, id: row.id, name: row.name, file: row.file, category: 'buildings', surface: 'stone', colliders: row.colliders,
      floors: [...worldRows.rows.floors, ...deckFloors], floorPolicy: 'first', solidFloor: true };
  };
  // the ending's other stone pieces (the decks, the square, the fronts) with no scene object; the grapple guard follows its
  // gate's live state, declared separately as the final piece
  const stone = (variant: 'capped' | 'open', rows: readonly NinePhysicsPlacement[]) => rows.filter(row => row.id !== 'nds-floors' && row.id !== 'nds-grapple-guard')
    .map(row => {
      const piece: Record<string, unknown> = { kind: 'piece', when: { variant }, id: row.id, name: row.name, file: row.file, category: 'buildings', surface: 'stone',
        colliders: row.colliders, floors: [], floorPolicy: 'first', solidFloor: false, object: null };
      if (row.colliderOwner !== undefined) piece['colliderOwner'] = row.colliderOwner;
      return piece;
    });
  const guard = (variant: 'capped' | 'open', rows: readonly NinePhysicsPlacement[]) => {
    const row = rows.find(entry => entry.id === 'nds-grapple-guard'); if (row === undefined) throw new Error('Missing Nine grapple guard');
    return { kind: 'piece', when: { variant }, id: row.id, name: row.name, file: row.file, category: 'buildings', surface: 'stone',
      colliders: row.colliders, floors: [], floorPolicy: 'first', solidFloor: false, object: null, active: 'tool-closed' };
  };
  // the Well's crossings (both endings): stone, timber and metal walkways
  const crossings = { kind: 'piece', ...install.crossings, category: 'buildings', surface: 'stone', surfaces: ['stone', 'wood', 'metal'], colliders: worldRows.rows.crossings,
    floors: [], floorPolicy: 'first', solidFloor: false, object: null };
  // a world-scene placement put under the world root (scenes.place publishes `<id>.root`), optionally renamed
  const placed = (id: string, name?: string, variant?: 'capped' | 'open') => {
    const when = variant === undefined ? {} : { when: { variant } };
    return [{ kind: 'place', id, ...when }, { kind: 'attach', id: `${id}.root`, as: 'object', ...(name === undefined ? {} : { name }), ...when }];
  };
  const wall = LAYOUT_PLACEMENTS.filter(row => row.id.startsWith('nds-inst-') && row.id !== 'nds-inst-ac');
  return parseWorldEntry({ blocks: {
    pieces: [floors('capped', install.standalone), floors('open', install.cell), ...stone('capped', install.standalone), ...stone('open', install.cell), crossings, guard('capped', install.standalone), guard('open', install.cell)],
    portals: [{ kind: 'attach', id: 'portals.root', as: 'group' }],
    canopy: canopy.draws.map(draw => ({ kind: 'look', look: draw.look, state: draw.state })),
    dressing: [{ kind: 'attach', id: 'dressing.root', as: 'group' }],
    lions: worldRows.rows.lions.length > 0 ? placed('nds-lions') : [],
    sets: SET_PLACEMENTS.flatMap(row => placed(row.id)),
    lanterns: (['open', 'capped'] as const).flatMap(variant => placed(`nds-lanterns-${variant}`, 'lanterns', variant)),
    wall: wall.flatMap(row => placed(row.id)),
    figures: [...placed('nds-fei-zhua-hooks'), ...(['walkers', 'sitters'] as const).flatMap(group => worldRows.rows.crowd[group].length === 0 ? [] : placed(`nds-crowd-${group}`, 'crowd'))],
    cards: [
      { kind: 'look', look: 'nine-streaks', state: { transparent: true, ...BLEND_ADD_KEEP_ALPHA } },
      { kind: 'look', look: 'nine-halo', state: light.haloState },
      { kind: 'attach', id: 'cards-capped.root', as: 'group', when: { variant: 'capped' } },
      { kind: 'attach', id: 'cards-open.root', as: 'group', when: { variant: 'open' } },
    ],
  } });
}
