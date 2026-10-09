import { saveStorageFixture } from './fake/saveFixture';
// src/engine/ui/Settings.ts — a page's settings read storage once when built, so each test builds its own (createSettings).
import { describe, expect, it, vi } from 'vitest';
import { createSettings, settingParams, settingsReloadUrl, type Settings } from '../src/engine/ui/Settings';
import { saveStorage } from '../src/engine/saves/slots';

const fixtures = saveStorageFixture('global');

const STORE = 'settings';
/** a fresh page's settings over the same saved storage (not a module reload, E422) */
function fresh(): Promise<Settings> { return Promise.resolve(createSettings(saveStorage('global'))); }

describe('Settings', () => {
  it.each([false, true])('defaults Memory saver OFF whatever the Developer mode (%s) (G271)', (enabled) => {
    const mode = { enabled: () => enabled };
    const s = createSettings(saveStorage('global'), () => '', mode);
    expect(s.setting('memorySaver')).toBe('off');
    expect(s.savedSetting('memorySaver')).toBe('off');
    s.setNumber('volume', 0.5);
    expect(JSON.parse(fixtures.getItem(STORE) ?? '{}')).toMatchObject({ memorySaver: 'off' });
    expect(createSettings(saveStorage('global'), () => '', { enabled: () => !enabled }).setting('memorySaver')).toBe('off');
  });
  it.each(['off', 'on'] as const)('preserves the explicit Memory saver %s override, fenced off publicly', (pick) => {
    fixtures.setItem(STORE, JSON.stringify({ memorySaver: pick }));
    const publicSettings = createSettings(saveStorage('global'), () => '?memorySaver=on', { enabled: () => false });
    expect(publicSettings.setting('memorySaver')).toBe('off');
    expect(publicSettings.savedSetting('memorySaver')).toBe(pick);
    expect(publicSettings.settingFromUrl('memorySaver')).toBe(false);
    publicSettings.saveSetting('memorySaver', pick === 'on' ? 'off' : 'on');
    publicSettings.setNumber('volume', 0.5);
    expect(JSON.parse(fixtures.getItem(STORE) ?? '{}')).toMatchObject({ memorySaver: pick });
    expect(createSettings(saveStorage('global'), () => '', { enabled: () => true }).setting('memorySaver')).toBe(pick);
  });
  it('turns Memory saver on only through a Developer pick, notifying mode changes and overrides (G271)', () => {
    let enabled = false;
    const changed = new Set<() => void>();
    const s = createSettings(saveStorage('global'), () => '', { enabled: () => enabled,
      on: fn => { changed.add(fn); return () => { changed.delete(fn); }; } });
    const seen: string[] = [];
    const off = s.onSettingChange('memorySaver', v => { seen.push(v); });
    enabled = true; for (const fn of changed) fn();
    expect(s.setting('memorySaver')).toBe('off');
    s.saveSetting('memorySaver', 'on');
    expect(JSON.parse(fixtures.getItem(STORE) ?? '{}')).toMatchObject({ memorySaver: 'on' });
    s.overrideSetting('memorySaver', 'off');
    s.overrideSetting('memorySaver', null);
    enabled = false; for (const fn of changed) fn();
    enabled = true; for (const fn of changed) fn();
    expect(seen).toEqual(['off', 'on', 'off', 'on', 'off', 'on']);
    expect(createSettings(saveStorage('global'), () => '', { enabled: () => true }).setting('memorySaver')).toBe('on');
    expect(createSettings(saveStorage('global'), () => '', { enabled: () => false }).setting('memorySaver')).toBe('off');
    s.saveSetting('memorySaver', 'off');
    expect(createSettings(saveStorage('global'), () => '', { enabled: () => true }).setting('memorySaver')).toBe('off');
    off(); expect(changed.size).toBe(0);
  });
  it.each([false, true])('ignores an invalid Memory saver pick in Developer mode %s', enabled => {
    fixtures.setItem(STORE, JSON.stringify({ memorySaver: 'invalid' }));
    expect(createSettings(saveStorage('global'), () => '', { enabled: () => enabled }).setting('memorySaver')).toBe('off');
  });

  it('ignores saved diagnostic picks outside Developer and restores them without rewriting storage', () => {
    fixtures.setItem(STORE, JSON.stringify({ weather: 'rain', fps: '60', musicStyle: 'folk' }));
    let enabled = false;
    const changed = new Set<() => void>();
    const s = createSettings(saveStorage('global'), () => '', { enabled: () => enabled,
      on: (fn) => { changed.add(fn); return () => { changed.delete(fn); }; } });
    expect(s.setting('weather')).toBe('live'); expect(s.setting('fps')).toBe('auto');
    expect(s.getMusicStyle()).toBe('folk'); expect(s.savedSetting('weather')).toBe('rain');
    s.saveSetting('weather', 'clear'); expect(s.savedSetting('weather')).toBe('rain');
    const picks: string[] = [], off = s.onSettingChange('weather', value => { picks.push(value); });
    enabled = true; for (const fn of changed) fn();
    expect(s.setting('weather')).toBe('rain'); expect(s.setting('fps')).toBe('60');
    enabled = false; for (const fn of changed) fn();
    expect(picks).toEqual(['rain', 'live']); off(); expect(changed.size).toBe(0);
    expect(JSON.parse(fixtures.getItem(STORE) ?? '{}')).toMatchObject({ weather: 'rain' });
    // The existing fps capture parameter remains an explicit harness override.
    expect(createSettings(saveStorage('global'), () => '?fps=60', { enabled: () => false }).setting('fps')).toBe('60');
  });
  it('drops the retired colour-grade opt-out when saving current settings (E85)', () => {
    fixtures.setItem(STORE, JSON.stringify({ learnedLut: 'off', volume: 0.25 }));
    const s = createSettings(saveStorage('global'));
    expect(s.getNumber('volume')).toBe(0.25);
    s.setNumber('volume', 0.5);
    expect(JSON.parse(fixtures.getItem(STORE) ?? '{}')).not.toHaveProperty('learnedLut');
  });
  it('drops the retired procedural creature override without changing player settings (E136)', () => {
    fixtures.setItem(STORE, JSON.stringify({ creatures: 'proc', aimAssist: false }));
    const s = createSettings(saveStorage('global'));
    expect(s.getSetting('aimAssist')).toBe(false);
    s.setNumber('volume', 0.5);
    expect(JSON.parse(fixtures.getItem(STORE) ?? '{}')).not.toHaveProperty('creatures');
  });
  it('drops the retired background-download opt-out on the next save (E158)', () => {
    fixtures.setItem(STORE, JSON.stringify({ prefetch: 'off', music: 0.25 }));
    const s = createSettings(saveStorage('global'));
    expect(s.getNumber('music')).toBe(0.25);
    s.setNumber('volume', 0.5);
    expect(JSON.parse(fixtures.getItem(STORE) ?? '{}')).not.toHaveProperty('prefetch');
  });
  it('defaults: aim assist + tracers on, volume 0.8, music 0.7', async () => {
    const s = await fresh();
    expect(s.getSetting('aimAssist')).toBe(true);
    expect(s.getSetting('tracers')).toBe(true);
    expect(s.getNumber('volume')).toBe(0.8);
    expect(s.getNumber('music')).toBe(0.7);
  });

  it('loads saved values and ignores wrongly-typed ones', async () => {
    fixtures.setItem(STORE, JSON.stringify({ aimAssist: false, tracers: 'no', volume: 0.25, music: '1' }));
    const s = await fresh();
    expect(s.getSetting('aimAssist')).toBe(false);
    expect(s.getSetting('tracers')).toBe(true);
    expect(s.getNumber('volume')).toBe(0.25);
    expect(s.getNumber('music')).toBe(0.7);
  });

  it('falls back to defaults on corrupt JSON or a throwing storage', async () => {
    fixtures.setItem(STORE, '{{');
    expect((await fresh()).getNumber('volume')).toBe(0.8);
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });
    expect((await fresh()).getSetting('aimAssist')).toBe(true);
  });

  it('setSetting persists and notifies subscribers once per real change', async () => {
    const s = await fresh();
    const fn = vi.fn<(v: boolean) => void>();
    s.onSetting('tracers', fn);
    s.setSetting('tracers', false);
    s.setSetting('tracers', false); // unchanged: no second call
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(false);
    expect(JSON.parse(fixtures.getItem(STORE) ?? '{}')).toMatchObject({ tracers: false, aimAssist: true, volume: 0.8 });
    expect((await fresh()).getSetting('tracers')).toBe(false);
  });

  it('subscribers are per key and can unsubscribe', async () => {
    const s = await fresh();
    const aim = vi.fn<(v: boolean) => void>(), tracers = vi.fn<(v: boolean) => void>();
    const off = s.onSetting('aimAssist', aim);
    s.onSetting('tracers', tracers);
    s.setSetting('aimAssist', false);
    off();
    s.setSetting('aimAssist', true);
    expect(aim).toHaveBeenCalledTimes(1);
    expect(tracers).not.toHaveBeenCalled();
  });

  it('setNumber clamps to 0..1 and notifies with the clamped value', async () => {
    const s = await fresh();
    const fn = vi.fn<(v: number) => void>();
    const off = s.onNumber('music', fn);
    s.setNumber('music', 1.7);
    expect(s.getNumber('music')).toBe(1);
    s.setNumber('music', -3);
    expect(s.getNumber('music')).toBe(0);
    s.setNumber('music', -1); // still 0: no notification
    expect(fn.mock.calls).toEqual([[1], [0]]);
    off();
    s.setNumber('music', 0.5);
    expect(fn).toHaveBeenCalledTimes(2);
    expect((await fresh()).getNumber('music')).toBe(0.5);
  });

  it('keeps the in-memory value when storage throws on write', async () => {
    const s = await fresh();
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); });
    s.setNumber('volume', 0.3);
    expect(s.getNumber('volume')).toBe(0.3);
    // storage works again: the default written back, so the page's save store holds no failed write for the next test
    vi.restoreAllMocks(); s.setNumber('volume', 0.8);
  });

  it('musicStyle: piano by default, persisted, validated, notifies once per change', async () => {
    const s = await fresh();
    expect(s.getMusicStyle()).toBe('piano');
    const fn = vi.fn<(v: string) => void>();
    s.onMusicStyle(fn);
    s.setMusicStyle('folk');
    s.setMusicStyle('folk');
    expect(fn.mock.calls).toEqual([['folk']]);
    expect(JSON.parse(fixtures.getItem(STORE) ?? '{}')).toMatchObject({ musicStyle: 'folk', volume: 0.8 });
    expect((await fresh()).getMusicStyle()).toBe('folk');
    fixtures.setItem(STORE, JSON.stringify({ musicStyle: 'dubstep' }));
    expect((await fresh()).getMusicStyle()).toBe('piano');
  });

  it('ignores retired SFX audition picks and saves only the Best shipping set', async () => {
    fixtures.setItem(STORE, JSON.stringify({ sfxSet: 'synth', musicStyle: 'folk' }));
    const s = await fresh(); expect(s.getSfxSet()).toBe('best');
    s.setMusicStyle('piano');
    expect(JSON.parse(fixtures.getItem(STORE) ?? '{}')).not.toHaveProperty('sfxSet');
    expect(s.getMusicStyle()).toBe('piano');
  });

  it('the old ?music=<style> switch is ignored: the saved style plays (E162)', async () => {
    fixtures.setItem(STORE, JSON.stringify({ musicStyle: 'orchestral' }));
    vi.stubGlobal('location', new URL('http://localhost:5173/?music=synth'));
    try {
      const s = await fresh();
      expect(s.getMusicStyle()).toBe('orchestral');
      s.setMusicStyle('folk');
      expect(JSON.parse(fixtures.getItem(STORE) ?? '{}')).toMatchObject({ musicStyle: 'folk' });
    } finally { vi.stubGlobal('location', new URL('http://localhost:5173/')); }
  });
});

// E55: the OPTIONS — the player-facing toggles that were query params. setting(k) = URL param › saved pick › default.
describe('Settings OPTIONS (setting / saveSetting)', () => {
  const at = (search: string): Promise<Settings> => {
    vi.stubGlobal('location', new URL(`http://localhost:5173/${search}`));
    return fresh();
  };
  const reset = () => { vi.stubGlobal('location', new URL('http://localhost:5173/')); };

  it('defaults: auto tier, auto touch, live clock', async () => {
    const s = await fresh();
    expect([s.setting('tier'), s.setting('touch'), s.setting('time')])
      .toEqual(['auto', 'auto', 'live']);
    expect(s.pendingReload()).toEqual([]);
  });

  it('precedence: the URL param wins for this load, else the saved pick, else the default', async () => {
    fixtures.setItem(STORE, JSON.stringify({ tier: 'phone', time: 'night' }));
    try {
      const saved = await at('');
      expect([saved.setting('tier'), saved.setting('time')]).toEqual(['phone', 'night']);
      expect(saved.settingFromUrl('tier')).toBe(false);
      const url = await at('?tier=desktop&tod=0.5&touch');
      expect([url.setting('tier'), url.setting('time'), url.setting('touch')])
        .toEqual(['desktop', 'live', 'on']);
      expect(url.settingFromUrl('tier')).toBe(true);
      expect(url.savedSetting('tier')).toBe('phone'); // the URL is never persisted
      url.setNumber('volume', 0.3);
      expect(JSON.parse(fixtures.getItem(STORE) ?? '{}')).toMatchObject({ tier: 'phone', time: 'night' });
    } finally { reset(); }
  });

  it('URL forms: an invalid ?tier= falls through to the saved pick', async () => {
    fixtures.setItem(STORE, JSON.stringify({ tier: 'phone' }));
    try {
      const s = await at('?tier=lego');
      expect(s.setting('tier')).toBe('phone');
      expect(s.settingFromUrl('tier')).toBe(false);
    } finally { reset(); }
  });

  it('a saved value outside the option set falls back to the default', async () => {
    fixtures.setItem(STORE, JSON.stringify({ tier: 'vulkan', time: 42 }));
    const s = await fresh();
    expect(s.setting('tier')).toBe('auto');
    expect(s.setting('time')).toBe('live');
  });

  it('the retired Look Lab picks (E136) a player saved before are ignored and dropped on the next save', async () => {
    fixtures.setItem(STORE, JSON.stringify({ island: 'procedural', edge: 'off', lighting: 'standard', sky: 'hdri', post: 'cinematic', lut: 'off', matte: 'off', tier: 'phone' }));
    fixtures.setItem('ws.island.v1', 'procedural');
    try {
      const s = await at('?island=procedural&edge=0&lighting=standard&sky=hdri&post=cinematic&matte=0');
      expect(s.setting('tier')).toBe('phone');
      expect(s.pendingReload()).toEqual([]);
      s.setNumber('volume', 0.3);
      const stored = JSON.parse(fixtures.getItem(STORE) ?? '{}') as Record<string, unknown>;
      expect(stored).toMatchObject({ tier: 'phone', volume: 0.3 });
      for (const k of ['island', 'edge', 'lighting', 'sky', 'post', 'lut', 'matte']) expect(stored).not.toHaveProperty(k);
    } finally { reset(); localStorage.removeItem('ws.island.v1'); }
  });

  it('a boot option saves the pick but keeps running what the page was built with, until the reload', async () => {
    const s = await fresh();
    const fn = vi.fn<(v: string) => void>();
    s.onSettingChange('tier', fn);
    s.saveSetting('tier', 'phone');
    s.saveSetting('tier', 'phone');
    expect(s.setting('tier')).toBe('auto');
    expect(s.savedSetting('tier')).toBe('phone');
    expect(fn.mock.calls).toEqual([['phone']]);
    expect(s.pendingReload()).toEqual(['tier']);
    const next = await fresh();
    expect(next.setting('tier')).toBe('phone');
    expect(next.pendingReload()).toEqual([]);
  });

  it('a live option applies at once and notifies once per real change, even over a URL override', async () => {
    try {
      const s = await at('?tod=0.5');
      const fn = vi.fn<(v: string) => void>();
      s.onSettingChange('time', fn);
      s.saveSetting('time', 'golden');
      s.saveSetting('time', 'golden');
      expect(s.setting('time')).toBe('golden');
      expect(fn.mock.calls).toEqual([['golden']]);
      expect(s.pendingReload()).toEqual([]); // live options never wait for a reload
      expect(JSON.parse(fixtures.getItem(STORE) ?? '{}')).toMatchObject({ time: 'golden' });
    } finally { reset(); }
  });

  it('settingsReloadUrl drops every option override and the extras, keeps the chunk and the dev params', () => {
    const out = new URL(settingsReloadUrl('http://localhost:5173/?chunk=driftwood-isle&tier=phone&touch&tod=0.5&clock=60&skipintro&nolock&x=3', ['skipintro']));
    expect([...out.searchParams.keys()]).toEqual(['chunk', 'nolock', 'x']);
    expect(settingParams('time')).toEqual(['tod', 'clock']);
  });
});
