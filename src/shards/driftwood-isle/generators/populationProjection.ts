import * as v from 'valibot';
import { PopulationProjectionSchema } from '@wildshard/format/populationProjection';
import { enemyPlacements } from './enemyPlacement';
import { DRIFTWOOD_SPECIES_PROGRAMS } from './speciesPrograms';
import items from '../data/items.generated.json' with { type: 'json' };
import foliage from '../data/foliagePlacements.generated.json' with { type: 'json' };
import island from '../data/islandFacts.generated.json' with { type: 'json' };
import physics from '../data/physics.generated.json' with { type: 'json' };

/** Compile presentation rows from the same placement, physical and species inputs. */
export function populationProjectionRows(): v.InferOutput<typeof PopulationProjectionSchema> {
  const placement = enemyPlacements(), strike = DRIFTWOOD_SPECIES_PROGRAMS.program.strikes.find(row => row.id === 'strike.monkey.coconut');
  if (strike === undefined) throw new Error('Missing population contact');
  return v.parse(PopulationProjectionSchema, {
    id: 'coconut', seed: placement.seed, random: placement.seed ^ 0xe11e,
    page: { phone: { ...placement.page.phone, palms: [...foliage.tiers.phone.palms.specs, ...island.extraPalms] }, desktop: { ...placement.page.desktop, palms: [...foliage.tiers.desktop.palms.specs, ...island.extraPalms] } },
    counts: { crabs: { kind: 'crab', groups: false, practice: false }, monkeys: { kind: 'monkey', groups: false, practice: false }, sailors: { kind: 'sailor', groups: false, practice: false },
      troops: { kind: 'monkey', groups: true, practice: false }, crabGroups: { kind: 'crab', groups: true, practice: true } },
    practice: { delay: 45, away: 30 }, perches: { foot: .2, crown: .5, base: .2 }, hold: { kind: 'sailor', ...physics.habitat.hold },
    volley: placement.volley, launch: items.launches.coconut, strike: { id: strike.id, damage: strike.damage, tags: ['creature.monkey', 'feel.blow', 'cover.checked'] },
    contact: { sound: 'coconut_hit', landSound: 'coconut_land', landAge: 3, splash: .3 }, husk: { colour: '#5a3d22', detail: 0 },
    splash: { capacity: 240, gravity: 9.81, colour: [.75, .95, 1], size: .05, opacity: .9, count: 60, radius: .5, height: [.2, 1.4], speed: [.6, 2.2], up: [1.2, 2.5], life: [.5, .6] },
    effects: [{ kind: 'captain', state: 'st', actions: [{ state: 1, sound: 'sailor_groan' }, { state: 3, sound: 'sailor_groan' }, { state: 4, sound: 'sailor_groan' },
      { state: 1, fromNot: 5, splash: 2 }, { state: 1, from: 5, splash: 2.2, sound: 'sailor_slash' }, { state: 4, splash: 1.4 }],
      periodic: { state: 5, interval: .1, chance: .85, x: 'burst-x', z: 'burst-z', radius: 1, splash: .3 } }],
    light: { colour: 0x7fe8ff, distance: 7, decay: 2, headY: .1, deathSplash: 1.4, fade: 1.6, intensity: 4.5, rise: 'rise', rising: 'rising', range: 60,
      flicker: [.85, .15, 11, 3.7, 2], streamRate: 30, streamHeight: [.5, 1.2], streamSplash: .08 },
  });
}
