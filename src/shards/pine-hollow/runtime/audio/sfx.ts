export type PhBed = 'hollow' | 'pond' | 'cabin' | 'creek' | 'waterfall' | 'mill' | 'ridge' | 'oldgrowth' | 'cave' | 'night' | 'nightfog'
  | 'rain-canopy' | 'rain-open' | 'dawn';
/** Every one-shot family Pine's SFX banks carry (the life's declared voices are checked against it with `isPhShot`). */
export const PH_SHOTS = ['boltImpact-rock', 'deer_snort', 'leverCycle', 'leverShot', 'leverEcho', 'longbowDraw', 'longbowLoose',
  'thrall_call', 'thrall_groan', 'thrall_move', 'king_bells', 'king_stomp', 'king_roar', 'doorOpen', 'doorClose',
  'lanternLight', 'lanternCreak', 'zipline',
  // the sound-gaps round: the lever gun's dry click + a round thumbed through its gate; the life's birds; the skinning strokes
  'leverDry', 'leverRoundIn', 'raven_caw', 'raven_pair', 'raven_flap', 'owl_hoot', 'woodpecker_drum', 'woodpecker_call',
  'skinCut-a', 'skinCut-b'] as const;
export type PhShot = (typeof PH_SHOTS)[number];
/** Whether a section's sound id names one of Pine's one-shot families. */
export function isPhShot(id: string): id is PhShot { return PH_SHOTS.some(shot => shot === id); }
export const PH_BEDS: readonly PhBed[] = ['hollow', 'pond', 'cabin', 'creek', 'waterfall', 'mill', 'ridge', 'oldgrowth', 'cave', 'night', 'nightfog', 'rain-canopy', 'rain-open', 'dawn'];
