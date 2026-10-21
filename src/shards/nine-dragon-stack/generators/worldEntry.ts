import { parseWorldEntry, type WorldEntryRows } from '@wildshard/format/worldEntry';
import { parseWorldScenePlacement, type WorldScenePlacementRow } from '@wildshard/format/worldScenePlacement';
import world from '../data/worldRows.generated.json' with { type: 'json' };
import { BLEND_ADD_KEEP_ALPHA } from '@wildshard/game/plugin/shaderFamily';
import canopy from '../data/canopy.json' with { type: 'json' };
import light from '../data/light.json' with { type: 'json' };

/**
 * Nine Dragon Stack's declared world entry (the world/scenes section's entry, run by @wildshard/game/shardfile/worldEntry in
 * world/build.ts): the portals, the banyan crown's looks and its dressing root, the wet floor's reflection cards for
 * this deck ending (`capped` standalone, `open` in a grid cell) with the streak and halo looks they draw in.
 */
/** the catalogue model of each set the square's builders queued (a pavilion's copies carry their turn) */
const SETS: Readonly<Record<string, string>> = { booth: 'marketBooth', parasol: 'parasolTable', 'balustrade-panel': 'balustradePanel', pavilion: 'diningPavilion' };
const setId = (name: string): string => `nine.set.${name}`;

/** The night market's booths, parasol tables and pavilions and Lantern Square's balustrade panels: each set's copies at
 *  their layout frames (data/worldRows.generated.json), instanced, culled by their spheres (pieces `nds-set-<name>`). */
export function nineSetPlacements(): WorldScenePlacementRow[] {
  return world.rows.sets.map(({ name, frames }) => {
    const model = SETS[name]; if (model === undefined) throw new Error(`Nine set ${name} has no catalogue model`);
    return parseWorldScenePlacement({ id: setId(name), model, draw: 'instanced', cull: { bounds: 'sphere' }, piece: { id: `nds-set-${name}` },
      poses: frames.map(frame => {
        const matrix = world.records.slice(frame, frame + 16), [x = 0, y = 0, z = 0] = [matrix[12], matrix[13], matrix[14]];
        return { x, y, z, matrix, ...(name === 'pavilion' ? { params: { turn: Math.atan2(matrix[8] ?? 0, matrix[0] ?? 1) } } : {}) };
      }) });
  });
}

export function nineWorldEntry(): WorldEntryRows {
  return parseWorldEntry({ blocks: {
    portals: [{ kind: 'attach', id: 'portals.root', as: 'group' }],
    canopy: canopy.draws.map(draw => ({ kind: 'look', look: draw.look, state: draw.state })),
    dressing: [{ kind: 'attach', id: 'dressing.root', as: 'group' }],
    sets: world.rows.sets.flatMap(({ name }) => [{ kind: 'place', id: setId(name) }, { kind: 'attach', id: `${setId(name)}.root`, as: 'object' }]),
    cards: [
      { kind: 'look', look: 'nine-streaks', state: { transparent: true, ...BLEND_ADD_KEEP_ALPHA } },
      { kind: 'look', look: 'nine-halo', state: light.haloState },
      { kind: 'attach', id: 'cards-capped.root', as: 'group', when: { variant: 'capped' } },
      { kind: 'attach', id: 'cards-open.root', as: 'group', when: { variant: 'open' } },
    ],
  } });
}
