// oxlint-disable-next-line import/no-nodejs-modules -- Native oracle hashes the old router's actual sound/scheduler argument stream.
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import type { CombatCueOpts } from '../../../src/engine/combat/cues';
import { pineCombatCues } from '../../../src/shards/pine-hollow/audio/combatCues';
import source from '../../../src/shards/pine-hollow/shard.config';

// Captured from the pre-conversion router at 093bb2f47; no rebaseline when the implementation changes.
it('preserves recipe options, false primary fallback, silent reload and echo scheduling across 1,728 dispatches', () => {
  const digest = createHash('sha256'); let dispatches = 0;
  const ids = [...source.audio.routing.map((row) => row.id), 'cue.unknown'].filter((id): id is `cue.${string}` => id.startsWith('cue.'));
  for (const loaded of [false, true]) for (const stony of [false, true]) for (const surface of [undefined, 'ground', 'wood', 'flesh'])
    for (const point of [undefined, new Vector3(1, 2, 3)]) for (const gain of [undefined, 0, 0.7]) for (const echoDelay of [0, 0.42]) {
      const ports = { shot: (name: string, opts?: { gain?: number; at?: Vector3 }): boolean => { digest.update(JSON.stringify(['shot', name, opts])); return loaded; },
        stony: (at: Vector3): boolean => { digest.update(JSON.stringify(['stony', at])); return stony; },
        later: (run: () => void, seconds: number): void => { digest.update(JSON.stringify(['later', seconds])); run(); }, echoDelay, echoGain: 0.55 };
      const cue = pineCombatCues(ports), opts: CombatCueOpts = {};
      if (surface !== undefined) opts.surface = surface; if (point !== undefined) opts.point = point; if (gain !== undefined) opts.gain = gain;
      for (const id of ids) { digest.update(JSON.stringify([id, opts, cue(id, opts)])); dispatches++; }
    }
  expect(dispatches).toBe(1728);
  expect(digest.digest('hex')).toBe('b78ae2d0005429ab7b6a9d9048cd3976362baf136b77ae94548e17d89c39c3e8');
});
