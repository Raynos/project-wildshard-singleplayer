import type { CombatCueMap } from '@wildshard/engine/combat/cues';
import type { Vector3 } from 'three';
import type { PhShot } from './sfx';

export function pineCombatCues(ports: {
  shot: (name: PhShot, opts?: { gain?: number; at?: Vector3 }) => boolean;
  later: (fn: () => void, seconds: number) => void; stony: (point: Vector3) => boolean;
  echoDelay: number; echoGain: number;
}): CombatCueMap {
  return (id, opts) => {
    switch (id) {
      case 'cue.lever.fire':
        if (!ports.shot('leverShot')) return false;
        ports.later(() => { ports.shot('leverEcho', { gain: ports.echoGain }); }, ports.echoDelay); return true;
      case 'cue.lever.dry': return ports.shot('leverDry');
      case 'cue.lever.reload': return true; // each round supplies its own sound; there is no magazine sound
      case 'cue.lever.cycle': return ports.shot('leverCycle');
      case 'cue.lever.round': return ports.shot('leverRoundIn', { gain: 0.9 });
      case 'cue.longbow.loose': return ports.shot('longbowLoose');
      case 'cue.longbow.draw': return ports.shot('longbowDraw', { gain: 0.8 });
      case 'cue.projectile.hit': return opts.surface === 'ground' && opts.point !== undefined && ports.stony(opts.point)
        && ports.shot('boltImpact-rock', { at: opts.point });
      default: return false;
    }
  };
}
