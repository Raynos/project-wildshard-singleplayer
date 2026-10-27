import type { AudioData } from '@wildshard/sdk/audio';
import { islandFoliagePlacements } from './islandDressing';
import island from '../data/islandFacts.generated.json' with {type:'json'};
import type { FixedWreckLayout } from './fixedLayouts';
import cove from '../data/coveComposition.json' with {type:'json'};

const foliage = islandFoliagePlacements();

/** The exact completed world's spatial observations, detached before shipping.
 * Tier palms keep their original scatter order and the baked island suffix.
 * The absent legacy pier/jetties/hut/lookout floor fields remain explicit gaps. */
export function driftwoodGameplayAudioEnvironment(wreck: FixedWreckLayout):NonNullable<NonNullable<AudioData['gameplay']>['entryEnvironment']> {
 const points=(tier:'phone'|'desktop')=>[...foliage.tiers[tier].palms.specs,...island.extraPalms].map(({x,z})=>({x,z}));
 return {floors:{decks:[null,null,'boat',null,null,'bridge','wreck'],stone:['shrine']},
   bounds:{holdBox:{...wreck.holdBounds},caveBox:{...cove.audioBounds}},
   near:{palms:{phone:points('phone'),desktop:points('desktop')}},dusk:'shrine',
   emitter:{id:'hum',profile:'shrine',point:'shrine',height:2.5},
   publish:{id:'driftwood.audio',hum:'shrineHum',bank:'islandSfx',surfaces:'surfaces',ambience:'ambience'}};
}
