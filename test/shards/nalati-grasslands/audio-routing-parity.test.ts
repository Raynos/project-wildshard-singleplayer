// oxlint-disable-next-line import/no-nodejs-modules -- Native oracle hashes the pre-conversion voice/microtask argument stream.
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import type { CombatCueOpts } from '../../../src/engine/combat/cues';
import { nalatiCombatCues } from '../../../src/shards/nalati-grasslands/runtime/audio/combatCues';

// Captured from sound.ts at 12310ead5 before its switch became declared routes.
it('preserves voice arguments, unbound fallback, silent loose and thrust microtasks across 6480 dispatches', () => {
  const digest = createHash('sha256'); let dispatches = 0;
  const record = (name: string, ...args: readonly (string | number)[]): void => { digest.update(JSON.stringify(['voice', name, ...args])); };
  const voices = {
    bowTwang: (strength: number) => { record('bowTwang', strength); }, bowDraw: () => { record('bowDraw'); },
    bowFullDraw: () => { record('bowFullDraw'); }, bowLetDown: () => { record('bowLetDown'); },
    javelinThrow: () => { record('javelinThrow'); }, sabreSwing: () => { record('sabreSwing'); },
    arrowImpact: (surface: 'wood' | 'flesh' | 'ground', pan: number, gain: number) => { record('arrowImpact', surface, pan, gain); },
    javelinImpact: (surface: 'wood' | 'flesh' | 'ground', pan: number, gain: number) => { record('javelinImpact', surface, pan, gain); },
    sabreHit: (surface: 'wood' | 'flesh' | 'ground', pan: number, gain: number) => { record('sabreHit', surface, pan, gain); },
  };
  const ids = ['cue.bow.loose', 'cue.bow.loose.power', 'cue.bow.draw', 'cue.bow.full', 'cue.bow.letdown', 'cue.spear.throw', 'cue.sabre.swing', 'cue.spear.thrust', 'cue.arrow.hit', 'cue.javelin.hit', 'cue.sabre.hit', 'cue.unknown'] as const;
  for (const ready of [false, true]) for (const loaded of [false, true]) for (const surface of [undefined, 'wood', 'flesh', 'ground', 'water'])
    for (const pan of [undefined, 0, -0.4]) for (const gain of [undefined, 0, 0.7]) for (const strength of [undefined, 0, 0.4]) {
      const jobs: (() => void)[] = [], opts: CombatCueOpts = {};
      if (surface !== undefined) opts.surface = surface; if (pan !== undefined) opts.pan = pan;
      if (gain !== undefined) opts.gain = gain; if (strength !== undefined) opts.strength = strength;
      const cue = nalatiCombatCues({ ready: () => ready, voices: () => loaded ? voices : null, thrust: () => {
        digest.update(JSON.stringify(['microtask'])); jobs.push(() => { record('spearThrust'); });
      } });
      for (const id of ids) { digest.update(JSON.stringify([id, opts, cue(id, opts)])); for (const job of jobs.splice(0)) job(); dispatches++; }
    }
  expect(dispatches).toBe(6480);
  expect(digest.digest('hex')).toBe('913f9343117a18ad15a851acc461be4d66cf80415f978b8edf8ec7f17fbd26b9');
});
