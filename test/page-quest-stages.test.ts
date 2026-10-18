// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { parseQuestHost } from '../src/format/questHost';
import { Flags } from '../src/engine/world/interact/flags';
import { bindPageQuestStages } from '../src/game/plugin/ui';
import { QUEST_HOST as signal } from '../src/shards/sunscar-dunes/generators/questHost';
import { QUEST_HOST as sky } from '../src/shards/far-reach/generators/questHost';
import signalFlags from '../src/shards/sunscar-dunes/data/flags.generated.json' with { type: 'json' };

test('a loaded lit Signal save stays quiet and keeps the existing stage owner', () => {
  const flags = new Flags('page-signal-loaded', false); flags.set(signalFlags.FLAG.lit);
  let summons = 0;
  const stages = bindPageQuestStages({ system: () => undefined }, { questHost: parseQuestHost(signal) }, { flags, actor: () => null,
    bindings: new Map([['sunscar.signal-fire', [{ action: { spawn: 'sunscar.matriarch' }, run: () => { summons++; } }]]]),
  });
  stages.advance('sunscar.signal-fire'); expect(summons).toBe(0);
  expect(() => stages.advance('missing')).toThrow('Undeclared page quest stage');
});

test('the native Sky mover endpoint is required before any stage registers', () => {
  let installed = false;
  expect(() => bindPageQuestStages({ system: () => { installed = true; } }, { questHost: parseQuestHost(sky) }, {
    flags: new Flags('page-sky-preflight', false), actor: () => ({ alive: false }),
  })).toThrow('mover');
  expect(installed).toBe(false);
});
