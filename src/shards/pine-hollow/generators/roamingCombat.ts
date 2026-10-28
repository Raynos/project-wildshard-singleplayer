

import { PINE_ELITE_DEFS } from './eliteRoster';
import { roamingCombatRows as admitRoamingCombat } from '@wildshard/sdk/bossProfiles';
import { nameBlob , type NamedBlob as NamedBlobType } from '@wildshard/sdk/blobs';
import { namedFormatJsonSchema } from '@wildshard/sdk/formatJsonSchema';
import { encodeCanonicalJson } from '@wildshard/sdk/immutable';
import { roamingProjection } from './roamingProjection';
import type { KingKitRows } from './kingKit';
import session from '../data/combatSession.json' with { type: 'json' };
import presentation from '../data/bossPresentation.json' with { type: 'json' };

/** The roaming combat rows over the King's baked kit (GR8: the program bakes the kit). */
export function roamingCombat(kit: KingKitRows): ReturnType<typeof admitRoamingCombat> {
  return admitRoamingCombat({
  session: { ...session, id: 'pine.combat', god: false }, projection: roamingProjection(kit), presentation,
  loadout: 'pine.loadout', elites: 'actors/elites.json', persistence: 'quests/persistence.json', score: 'score.pine',
  elitePresentation: Object.fromEntries(Object.values(PINE_ELITE_DEFS).map(def => [def.id, {
    prompt: `Take the ${def.drop.skinName} ${def.drop.weapon} skin`, toast: `${def.drop.skinName} ${def.drop.weapon} skin — ${def.drop.blurb}`,
    hum: true, sting: { banner: .8, phase2: 1, kill: 'chunk' },
  }])),
  availability: .5, dayScene: 'day', nightScene: 'night',
  parked: { name: 'pine-drops-parked', y: -500, finishes: ['ironhide', 'ghost-stag', 'blackpaw', 'imperial', 'warden'] },
  reward: { finish: 'warden', bowScale: .5, bowPitch: -Math.PI / 2, trophy: 'amber-resin', count: 3 },
  tells: { count: 3, colour: [2.2, .7, .28], range: 45, near: 1.5, ahead: 4, width: 2.2, scale: .8, alpha: .55, pulse: .2, frequency: 18 },
  system: { id: 'elites', before: ['main.world', 'engine.creatures.update', 'main.frame'] },
  observers: { elites: '__pineElites', boss: '__antlerKing' },
  });
}
/** The roaming combat file over the King's baked kit. */
export function roamingCombatBlob(kit: KingKitRows): NamedBlobType {
  return nameBlob('combat/roaming.json', 'json', new TextEncoder().encode(encodeCanonicalJson(roamingCombat(kit))), { jsonSchema: namedFormatJsonSchema('roamingCombat.RoamingCombat') });
}
