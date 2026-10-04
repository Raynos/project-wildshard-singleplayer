// oxlint-disable-next-line import/no-nodejs-modules -- Native test oracle hashes the captured pre-conversion argument stream; this module never ships to the browser.
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { Vector3 } from 'three';
import type { CombatCueOpts } from '../../../src/engine/combat/cues';
import { driftwoodCueMap } from '../../../src/shards/driftwood-isle/audio/cues';
import { driftwoodCombatCues } from '../../../src/shards/driftwood-isle/audio/combatCues';
import source from '../../../src/shards/driftwood-isle/shard.config';

// Captured from the pre-conversion routers at 4b50e4c40, using the same engine option objects.
// The digest records both dispatch acceptance and the complete ordered recipe argument stream.
it('keeps every old mixer/combat boundary and recipe argument across 81,648 same-engine dispatches', () => {
  const digest = createHash('sha256'); let dispatches = 0;
  const record = (name: string) => (...args: unknown[]): void => { digest.update(JSON.stringify([name, args])); };
  const sfx = { whoosh: record('whoosh'), impact: record('impact'), vocal: record('vocal'), windup: record('windup'),
    footstep: record('footstep'), plunge: record('plunge'), interact: record('interact'), gullCallAt: record('gullCallAt') };
  const maps = [driftwoodCueMap(sfx, { position: new Vector3(1, 2, 3), yaw: 0.4 }), driftwoodCombatCues(sfx)];
  const ids = [...new Set(source.audio.routing.map((route) => route.id)), 'cue.unknown', 'cue.step.litter'].filter((id): id is `cue.${string}` => id.startsWith('cue.'));
  for (const kind of [undefined, 'crab', 'sailor', 'boar', 'monkey', 'bear', 'unknown'])
    for (const point of [undefined, new Vector3(3, 4, 5)])
      for (const dir of [undefined, -1, 1, new Vector3(0, 0, 1)] as const)
        for (const killed of [undefined, false, true])
          for (const value of [undefined, 0, 0.7])
            for (const clang of [undefined, 'wood', 'stone'] as const) {
              const opts: CombatCueOpts = {};
              if (kind !== undefined) opts.kind = kind; if (point !== undefined) opts.point = point;
              if (dir !== undefined) opts.dir = dir; if (killed !== undefined) opts.killed = killed;
              if (value !== undefined) { opts.speed = value; opts.strength = value; opts.gain = value; }
              if (clang !== undefined) opts.clang = clang;
              for (const [index, map] of maps.entries()) for (const id of ids) { digest.update(JSON.stringify([index, id, opts, map(id, opts)])); dispatches++; }
            }
  expect(dispatches).toBe(81648);
  expect(digest.digest('hex')).toBe('4d024a0dc280fc9a2cc9bca7010238502cdea29313bbb376938c0cd4b7b1ba74');
});
