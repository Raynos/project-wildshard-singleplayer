import { describe, expect, it } from 'vitest';
import { saveStorageFixture } from './fake/saveFixture';
import { createSettings } from '../src/engine/ui/Settings';
import { saveStorage } from '../src/engine/saves/slots';
import { FOCUS_FAR, FOCUS_SIZE, focusRegionShadow } from '../src/game/grid/regionShadow';

const fixtures = saveStorageFixture('global');

/** a page sky with one cascade: its reach and map size, focused and put back */
function fakeSky(): { far: number; size: number; focusCascade: (far: number, size: number) => () => void } {
  const sky = {
    far: 88, size: 1024,
    focusCascade: (far: number, size: number) => {
      const held = { far: sky.far, size: sky.size };
      sky.far = far; sky.size = size;
      return () => { sky.far = held.far; sky.size = held.size; };
    },
  };
  return sky;
}

function fakeEntry(): { onDispose: (fn: () => void) => void; dispose: () => void } {
  const fns: (() => void)[] = [];
  return { onDispose: (fn) => { fns.push(fn); }, dispose: () => { for (const fn of fns.reverse()) fn(); } };
}

describe('SF63 region shadow focus', () => {
  it('leaves the page cascade alone while the Debug row is off (the default)', () => {
    fixtures.removeItem('settings');
    const settings = createSettings(saveStorage('global'), () => '');
    const sky = fakeSky(), entry = fakeEntry();
    focusRegionShadow(sky, entry, settings);
    expect([sky.far, sky.size]).toEqual([88, 1024]);
    entry.dispose();
    expect([sky.far, sky.size]).toEqual([88, 1024]);
  });

  it('follows the row live while entered and puts the page cascade back on leave', () => {
    fixtures.removeItem('settings');
    const settings = createSettings(saveStorage('global'), () => '');
    const sky = fakeSky(), entry = fakeEntry();
    focusRegionShadow(sky, entry, settings);
    settings.saveSetting('regionShadowFocus', 'tight');
    expect([sky.far, sky.size]).toEqual([FOCUS_FAR, FOCUS_SIZE]);
    settings.saveSetting('regionShadowFocus', 'off');
    expect([sky.far, sky.size]).toEqual([88, 1024]);
    settings.saveSetting('regionShadowFocus', 'tight');
    entry.dispose();
    expect([sky.far, sky.size]).toEqual([88, 1024]);
    settings.saveSetting('regionShadowFocus', 'off');
    settings.saveSetting('regionShadowFocus', 'tight');
    expect([sky.far, sky.size]).toEqual([88, 1024]); // left: the row no longer reaches it
  });
});
