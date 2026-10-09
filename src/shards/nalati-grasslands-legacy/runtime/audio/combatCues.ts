import { createCueRouter } from '@wildshard/engine/audio/cueRouting';
import type { CombatCueMap, CombatCueOpts } from '@wildshard/engine/combat/cues';
import type { SteppeVoices } from './synth';
import source from '../../shard.config';

type Voices = Pick<SteppeVoices, 'bowTwang' | 'bowDraw' | 'bowFullDraw' | 'bowLetDown' | 'javelinThrow' | 'sabreSwing' | 'arrowImpact' | 'javelinImpact' | 'sabreHit'>;
const surfaceOf = (surface: string | undefined): 'wood' | 'flesh' | 'ground' => surface === 'wood' || surface === 'flesh' ? surface : 'ground';
/** Existing trusted voice recipes; the shardfile owns the cue map, while spear cancellation keeps its microtask port. */
export function nalatiCombatCues(ports: { ready: () => boolean; voices: () => Voices | null; thrust: () => void }): CombatCueMap {
  const voices = new Map<string, (opts: CombatCueOpts) => boolean | undefined>();
  const bind = (id: string, run: (voice: Voices, opts: CombatCueOpts) => void): void => {
    voices.set(`steppe.${id}`, (opts) => { const voice = ports.voices(); if (voice === null) return false; run(voice, opts); return true; });
  };
  bind('bowTwang', (v, o) => { v.bowTwang(o.strength ?? 1); });
  bind('bowDraw', (v) => { v.bowDraw(); });
  bind('bowFullDraw', (v) => { v.bowFullDraw(); });
  bind('bowLetDown', (v) => { v.bowLetDown(); });
  bind('javelinThrow', (v) => { v.javelinThrow(); });
  bind('sabreSwing', (v) => { v.sabreSwing(); });
  bind('thrustPending', () => { ports.thrust(); });
  bind('arrowImpact', (v, o) => { v.arrowImpact(surfaceOf(o.surface), o.pan ?? 0, o.gain ?? 1); });
  bind('javelinImpact', (v, o) => { v.javelinImpact(surfaceOf(o.surface), o.pan ?? 0, o.gain ?? 1); });
  bind('sabreHit', (v, o) => { v.sabreHit(surfaceOf(o.surface), o.pan ?? 0, o.gain ?? 1); });
  const cue = createCueRouter(source.audio.routing, { voices });
  return (id, opts) => ports.ready() && ports.voices() !== null && cue(id, opts);
}
