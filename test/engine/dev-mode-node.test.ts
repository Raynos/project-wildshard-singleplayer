import { expect, it } from 'vitest';
import { Audio } from '../../src/engine/audio/Audio';
import { isDev, onDev, setDev } from '../../src/engine/core/devMode';
import { onSfxSet } from '../../src/engine/ui/Settings';

it('constructs native audio and subscribes to settings without a browser event source', () => {
  expect(typeof window).toBe('undefined');
  const previous = isDev(), seen: boolean[] = [];
  const off = onDev(value => { seen.push(value); }), offSfx = onSfxSet(() => undefined);
  try {
    const audio = new Audio();
    expect(audio.census().activeVoices).toBe(0);
    setDev(!previous);
    expect(isDev()).toBe(!previous); expect(seen).toEqual([]);
  } finally { off(); offSfx(); setDev(previous); }
});
