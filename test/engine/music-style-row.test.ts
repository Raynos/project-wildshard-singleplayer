// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { Scope } from '../../src/engine/app/scope';
import { getMusicStyle, MUSIC_STYLES, setMusicStyle } from '../../src/engine/ui/Settings';
import { buildMusicStyleRow } from '../../src/engine/ui/musicStyleRow';
import { DEBUG_ROWS } from '../../src/engine/ui/debugOptions';

it('offers the requested music styles outside Debug and keeps both Settings views synchronized', () => {
  const scope = new Scope('music-preference'), previous = getMusicStyle();
  try {
    const pause = buildMusicStyleRow(scope), title = buildMusicStyleRow(scope);
    expect(DEBUG_ROWS.some(row => row.id === 'musicStyle')).toBe(false);
    expect([...pause.querySelectorAll('button')].map(button => button.dataset['v'])).toEqual(MUSIC_STYLES);
    pause.querySelector<HTMLButtonElement>('[data-v="folk"]')?.click();
    expect(getMusicStyle()).toBe('folk');
    expect(title.querySelector<HTMLElement>('.active')?.dataset['v']).toBe('folk');
    title.querySelector<HTMLButtonElement>('[data-v="orchestral"]')?.click();
    expect(pause.querySelector<HTMLElement>('.active')?.dataset['v']).toBe('orchestral');
    scope.dispose();
    pause.querySelector<HTMLButtonElement>('[data-v="piano"]')?.click();
    expect(getMusicStyle()).toBe('orchestral');
  } finally { scope.dispose(); setMusicStyle(previous); }
});
