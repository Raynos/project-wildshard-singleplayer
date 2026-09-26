// src/ui/Settings.ts — reads storage once at module init, so each test imports a fresh copy of the module.
import { describe, expect, it, vi } from 'vitest';
import type * as SettingsModule from '../src/ui/Settings';

const STORE = 'ws.settings.v1';
function fresh(): Promise<typeof SettingsModule> {
  vi.resetModules();
  return import('../src/ui/Settings');
}

describe('Settings', () => {
  it('defaults: aim assist + tracers on, volume 0.8, music 0.7', async () => {
    const s = await fresh();
    expect(s.getSetting('aimAssist')).toBe(true);
    expect(s.getSetting('tracers')).toBe(true);
    expect(s.getNumber('volume')).toBe(0.8);
    expect(s.getNumber('music')).toBe(0.7);
  });

  it('loads saved values and ignores wrongly-typed ones', async () => {
    localStorage.setItem(STORE, JSON.stringify({ aimAssist: false, tracers: 'no', volume: 0.25, music: '1' }));
    const s = await fresh();
    expect(s.getSetting('aimAssist')).toBe(false);
    expect(s.getSetting('tracers')).toBe(true);
    expect(s.getNumber('volume')).toBe(0.25);
    expect(s.getNumber('music')).toBe(0.7);
  });

  it('falls back to defaults on corrupt JSON or a throwing storage', async () => {
    localStorage.setItem(STORE, '{{');
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
    expect(JSON.parse(localStorage.getItem(STORE) ?? '{}')).toMatchObject({ tracers: false, aimAssist: true, volume: 0.8 });
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
  });

  it('musicStyle: piano by default, persisted, validated, notifies once per change', async () => {
    const s = await fresh();
    expect(s.getMusicStyle()).toBe('piano');
    const fn = vi.fn<(v: string) => void>();
    s.onMusicStyle(fn);
    s.setMusicStyle('folk');
    s.setMusicStyle('folk');
    expect(fn.mock.calls).toEqual([['folk']]);
    expect(JSON.parse(localStorage.getItem(STORE) ?? '{}')).toMatchObject({ musicStyle: 'folk', volume: 0.8 });
    expect((await fresh()).getMusicStyle()).toBe('folk');
    localStorage.setItem(STORE, JSON.stringify({ musicStyle: 'dubstep' }));
    expect((await fresh()).getMusicStyle()).toBe('piano');
  });

  it('sfxSet: best by default, a retired saved set reads as best, persisted beside musicStyle, no URL override (E162)', async () => {
    localStorage.setItem(STORE, JSON.stringify({ sfxSet: 'moss' })); // a set from SFX round 2, retired by the merged one
    expect((await fresh()).getSfxSet()).toBe('best');
    localStorage.clear();
    const s = await fresh();
    expect(s.getSfxSet()).toBe('best');
    s.setSfxSet('synth');
    expect(JSON.parse(localStorage.getItem(STORE) ?? '{}')).toMatchObject({ sfxSet: 'synth', musicStyle: 'piano' });
    s.setSfxSet('best');
    vi.stubGlobal('location', new URL('http://localhost:5173/?sfx=synth'));
    try {
      expect((await fresh()).getSfxSet()).toBe('best'); // the old ?sfx= switch is ignored
    } finally { vi.stubGlobal('location', new URL('http://localhost:5173/')); }
  });

  it('the old ?music=<style> switch is ignored: the saved style plays (E162)', async () => {
    localStorage.setItem(STORE, JSON.stringify({ musicStyle: 'orchestral' }));
    vi.stubGlobal('location', new URL('http://localhost:5173/?music=synth'));
    try {
      const s = await fresh();
      expect(s.getMusicStyle()).toBe('orchestral');
      s.setMusicStyle('folk');
      expect(JSON.parse(localStorage.getItem(STORE) ?? '{}')).toMatchObject({ musicStyle: 'folk' });
    } finally { vi.stubGlobal('location', new URL('http://localhost:5173/')); }
  });
});

// E55: the OPTIONS — the player-facing toggles that were query params. setting(k) = URL param › saved pick › default.
describe('Settings OPTIONS (setting / saveSetting)', () => {
  const at = (search: string): Promise<typeof SettingsModule> => {
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
    localStorage.setItem(STORE, JSON.stringify({ tier: 'phone', time: 'night' }));
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
      expect(JSON.parse(localStorage.getItem(STORE) ?? '{}')).toMatchObject({ tier: 'phone', time: 'night' });
    } finally { reset(); }
  });

  it('URL forms: an invalid ?tier= falls through to the saved pick', async () => {
    localStorage.setItem(STORE, JSON.stringify({ tier: 'phone' }));
    try {
      const s = await at('?tier=lego');
      expect(s.setting('tier')).toBe('phone');
      expect(s.settingFromUrl('tier')).toBe(false);
    } finally { reset(); }
  });

  it('a saved value outside the option set falls back to the default', async () => {
    localStorage.setItem(STORE, JSON.stringify({ tier: 'vulkan', time: 42 }));
    const s = await fresh();
    expect(s.setting('tier')).toBe('auto');
    expect(s.setting('time')).toBe('live');
  });

  it('the retired Look Lab picks (E136) a player saved before are ignored and dropped on the next save', async () => {
    localStorage.setItem(STORE, JSON.stringify({ island: 'procedural', edge: 'off', lighting: 'standard', sky: 'hdri', post: 'cinematic', lut: 'off', matte: 'off', tier: 'phone' }));
    localStorage.setItem('ws.island.v1', 'procedural');
    try {
      const s = await at('?island=procedural&edge=0&lighting=standard&sky=hdri&post=cinematic&matte=0');
      expect(s.setting('tier')).toBe('phone');
      expect(s.pendingReload()).toEqual([]);
      s.setNumber('volume', 0.3);
      const stored = JSON.parse(localStorage.getItem(STORE) ?? '{}') as Record<string, unknown>;
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
      expect(JSON.parse(localStorage.getItem(STORE) ?? '{}')).toMatchObject({ time: 'golden' });
    } finally { reset(); }
  });

  it('settingsReloadUrl drops every option override and the extras, keeps the chunk and the dev params', async () => {
    const s = await fresh();
    const out = new URL(s.settingsReloadUrl('http://localhost:5173/?chunk=driftwood-isle&tier=phone&touch&tod=0.5&clock=60&skipintro&nolock&x=3', ['skipintro']));
    expect([...out.searchParams.keys()]).toEqual(['chunk', 'nolock', 'x']);
    expect(s.settingParams('time')).toEqual(['tod', 'clock']);
  });
});

