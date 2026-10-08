import { expect, it } from 'vitest';
import { Scope } from '../../src/engine/app/scope';
import { dataLookClock, DATA_LOOK_DAY } from '../../src/engine/render/dataLook';
import { createSettings } from '../../src/engine/ui/Settings';
import type { DayCycleClock } from '../../src/engine/world/dayCycle';
import { bindClockSettings } from '../../src/game/session/clockSettings';
import { createDay as skyDay } from '../../src/shards/far-reach/look/render';
import { signalDunesLook } from '../../src/shards/sunscar-dunes/look/render';
import type { LookComposeContext, SkyBackdropContext } from '../../src/engine/render/look';
import type { SkyRig } from '../../src/engine/world/skyRig';
import { Scene } from 'three';
import { legacyDouble } from '../fake/FakeGame';

import { MemoryStorage } from '../setup';


const picks = (developer: boolean) => {
  const store = new MemoryStorage(); store.setItem('settings', JSON.stringify({ time: 'midday' }));
  return createSettings(store, () => '', { enabled: () => developer });
};

it('applies the initial Developer time to the actual declared, Sky and Sun hour clocks, then follows live changes until disposal', async () => {
  const sunLook = signalDunesLook(), sunScope = new Scope('sun-look');
  if (sunLook.mode !== 'extend' || sunLook.backdrop === undefined) throw new Error('Missing Sun backdrop');
  sunLook.compose(legacyDouble<LookComposeContext>({ scope: sunScope, scene: new Scene(), engineChain: () => [] }));
  const sun = await sunLook.backdrop(legacyDouble<SkyBackdropContext>({ sky: legacyDouble<SkyRig>({}) }));
  const clocks: [DayCycleClock, number][] = [[dataLookClock({ ...DATA_LOOK_DAY, start: 0.25 }, null), 17], [skyDay(), 17.5], [sun.clock, 18]];
  for (const [clock, golden] of clocks) {
    const scope = new Scope('resident-clock'), settings = picks(true);
    bindClockSettings(clock, scope, settings);
    expect(clock.hour).toBe(12); expect(clock.paused).toBe(true);
    clock.update(100); expect(clock.hour).toBe(12);
    settings.saveSetting('time', 'golden'); expect(clock.hour).toBe(golden);
    settings.saveSetting('time', 'live'); expect(clock.paused).toBe(false);
    scope.dispose(); settings.saveSetting('time', 'night'); expect(clock.paused).toBe(false);
  }
  sunScope.dispose();
});

it('leaves authored starts and fixed overrides intact when Developer is off or the time pick is Live', () => {
  for (const override of [null, 0.75]) {
    const clock = dataLookClock({ ...DATA_LOOK_DAY, start: 0.25 }, override), scope = new Scope('authored-clock');
    bindClockSettings(clock, scope, picks(false));
    expect(clock.phase).toBe(override ?? 0.25); expect(clock.paused).toBe(override !== null);
    scope.dispose();
  }
  const clock = skyDay(), scope = new Scope('sky-clock'), settings = picks(true);
  settings.saveSetting('time', 'live'); bindClockSettings(clock, scope, settings);
  expect(clock.hour).toBe(17.5); expect(clock.paused).toBe(false); scope.dispose();
});
