import type { Scope } from '@wildshard/engine/app/scope';
import { onSettingChange, setting, type Settings } from '@wildshard/engine/ui/Settings';
import type { DayCycleClock } from '@wildshard/engine/world/dayCycle';

const pageSettings = { setting, onSettingChange };

/** Apply an explicit Developer time at resident-clock binding; Live preserves authored starts and fixed overrides. */
export function bindClockSettings(clock: DayCycleClock, scope: Scope, settings: Pick<Settings, 'setting' | 'onSettingChange'> = pageSettings): void {
  const initial = settings.setting('time');
  if (initial !== 'live') clock.setTime(initial);
  scope.onDispose(settings.onSettingChange('time', (time) => { clock.setTime(time); }));
}
