import { Weather, type WeatherProfile } from '@wildshard/engine/world/weather';
import { DayCycle } from '@wildshard/engine/world/dayCycle';
import type { Rng } from '@wildshard/engine/core/rng';
import type { SpeciesLook } from '@wildshard/engine/entities/species/look';
import type { ShardCompendium } from '../compendium/types';
import type { LootPresentation } from '../loot/runtime';
import type { ShardRows } from '../shardfile/rows';
import { sketchReference } from '../shardfile/sketch';

/** Expand a table of authored outputs into the existing seeded weather mechanism. */
export function declaredWeather(row: ShardRows['weather'][number], rng: Rng): Weather {
  const states = new Map(row.states.map((state) => [state.id, state]));
  const profile: WeatherProfile = { states: row.states.map((state) => state.id), next: Object.fromEntries(row.states.map((state) => [state.id, state.next])),
    length: Object.fromEntries(row.states.map((state) => [state.id, state.length])), soak: row.soak, dry: row.dry,
    initial: () => ({ ...row.initial }), numbers: ({ state }) => {
      const selected = states.get(state); if (selected === undefined) throw new Error('Unknown declared weather state'); return { ...selected.numbers };
    }, modes: Object.fromEntries(row.modes.map((mode) => [mode.id, mode.hold === null ? 'none' : { hold: mode.hold, at: mode.at, dry: mode.dry }])) };
  return new Weather(profile, rng);
}
/** A complete authored hour schedule runs the existing engine day clock. */
export function declaredDay(row: ShardRows['days'][number]): DayCycle { return new DayCycle(row); }
/** Registered view recipes receive pure parameters; missing recipes fail before the view boots. */
export function declaredSpeciesLook(row: ShardRows['looks'][number], recipes: ReadonlyMap<string, (row: ShardRows['looks'][number]) => SpeciesLook>): SpeciesLook {
  const recipe = recipes.get(row.recipe); if (recipe === undefined) throw new Error(`Unknown species look recipe ${row.recipe}`);
  return recipe(row);
}
/** Constant stamp/stat data supplies the existing compendium without authored closures. */
export function declaredCompendium(row: ShardRows['compendiums'][number], rows: ShardRows, chunkId: string, sketchData?: (ref: string) => string): ShardCompendium {
  const kinds = new Map(rows.species.map((species) => [species.id, species.kind]));
  return { chunkId, skin: { className: row.className, title: row.title, tabs: row.tabs, stamp: () => row.stamp, stats: () => row.stats.map((stat) => ({ ...stat })) },
    entries: row.entries.map(({ sketch, species, ...entry }) => {
      const kind = kinds.get(species); if (kind === undefined) throw new Error('Unknown compendium species');
      if (sketchData === undefined && (!sketch.startsWith('data:image/svg+xml,') || !sketchReference(sketch))) throw new Error('Compendium hash or unsafe SVG requires admitted sketch data');
      return { ...entry, plate: { sketch: sketchData?.(sketch) ?? sketch }, match: { kind } };
    }) };
}
/** Presentation uses the existing purse and a registered cue; data cannot install callbacks. */
export function declaredLootPresentation(row: ShardRows['loot'][number], cue: (id: string) => void): LootPresentation {
  return { gear: (purse) => ({ coins: purse.coins }), finds: null, marks: null, charted: () => row.charted, chime: () => { cue(row.chime); } };
}
