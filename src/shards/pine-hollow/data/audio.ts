import { parseAudioData } from '@wildshard/sdk/audio';
import { PINE_AUDIO_ZONES } from './audioZones';
import { PINE_AUDIO_SAMPLES } from './audioSamples';

/** Existing forest samples, score/boss slots, scoped rifle echo and authored ambience zones. */
export const PINE_AUDIO = parseAudioData({ cues: [], ambience: null, score: 'default',
  music: { id: 'score.pine', base: 'pine', slots: ['pine', 'night', 'boss'], bootSlots: ['title', 'pine'], synthLead: 'pluck', minFade: 0,
    source: null, sets: { pine: 'base', night: 'pine-hollow', boss: 'pine-hollow' }, selectMode: 'first', selection: [
      { slots: ['pine'], when: [{ field: 'scene', op: 'equals', value: 'day' }] },
      { slots: ['night'], when: [{ field: 'scene', op: 'equals', value: 'night' }] },
      { slots: ['boss'], when: [{ field: 'scene', op: 'equals', value: 'boss' }] },
    ] },
  samples: PINE_AUDIO_SAMPLES,
  zones: { id: 'ambience.pine', smoothSeconds: 0.1, tickHz: 10, silentSeconds: 60, holdSeconds: 0,
    levels: { out: 0.55, hollow: 0.7, pond: 1, cabin: 1.1, creek: 0.9, waterfall: 1.1, mill: 0.9, ridge: 0.9, oldgrowth: 1, cave: 1, night: 0.9, nightfog: 0.7, 'rain-canopy': 1, 'rain-open': 0.9, dawn: 0.9 },
    wet: { cabin: 0.4, den: 0.55, oldgrowth: 0.3, bowl: 0.12 }, zones: PINE_AUDIO_ZONES },
  routing: [
    { id: 'cue.lever.fire', actions: [{ voice: 'pine.leverShot' }, { voice: 'pine.leverEcho', delay: 0.42, overrides: { gain: 0.55 } }] },
    { id: 'cue.lever.dry', actions: [{ voice: 'pine.leverDry' }] },
    { id: 'cue.lever.reload', actions: [] },
    { id: 'cue.lever.cycle', actions: [{ voice: 'pine.leverCycle' }] },
    { id: 'cue.lever.round', actions: [{ voice: 'pine.leverRoundIn', overrides: { gain: 0.9 } }] },
    { id: 'cue.longbow.loose', actions: [{ voice: 'pine.longbowLoose' }] },
    { id: 'cue.longbow.draw', actions: [{ voice: 'pine.longbowDraw', overrides: { gain: 0.8 } }] },
    { id: 'cue.projectile.hit', when: [{ field: 'surface', op: 'equals', value: 'ground' }, { field: 'point', op: 'present' }], actions: [{ voice: 'pine.boltImpact-rock' }] },
  ],
});
