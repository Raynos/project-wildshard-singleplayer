import type { AudioGameplay } from '@wildshard/format/audio';
import foliage from '../data/foliagePlacements.generated.json' with {type:'json'};
import island from '../data/islandFacts.generated.json' with {type:'json'};
import wreck from '../data/wreckBake.json' with {type:'json'};
import cove from '../data/coveComposition.json' with {type:'json'};

/** The exact completed world's spatial observations, detached before shipping.
 * Tier palms keep their original scatter order and the baked island suffix.
 * The absent legacy pier/jetties/hut/lookout floor fields remain explicit gaps. */
export function driftwoodGameplayAudioEnvironment():NonNullable<AudioGameplay['entryEnvironment']> {
 const points=(tier:'phone'|'desktop')=>[...foliage.tiers[tier].palms.specs,...island.extraPalms].map(({x,z})=>({x,z}));
 return {floors:{decks:[null,null,'boat',null,null,'bridge','wreck'],stone:['shrine']},
   bounds:{holdBox:{...wreck.holdBounds},caveBox:{...cove.audioBounds}},
   near:{palms:{phone:points('phone'),desktop:points('desktop')}},dusk:'shrine',
   emitter:{id:'hum',profile:'shrine',point:'shrine',height:2.5},
   publish:{id:'driftwood.audio',hum:'shrineHum',bank:'islandSfx',surfaces:'surfaces',ambience:'ambience'}};
}
