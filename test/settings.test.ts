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

  it('sfxSet: best by default, a retired saved set reads as best, persisted beside musicStyle, ?sfx=synth overrides without persisting', async () => {
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
      const t = await fresh();
      expect(t.getSfxSet()).toBe('synth');
      t.setNumber('volume', 0.5);
      expect(JSON.parse(localStorage.getItem(STORE) ?? '{}')).toMatchObject({ sfxSet: 'best' });
    } finally { vi.stubGlobal('location', new URL('http://localhost:5173/')); }
  });

  it('?music=<style> overrides the saved style without persisting it', async () => {
    localStorage.setItem(STORE, JSON.stringify({ musicStyle: 'orchestral' }));
    vi.stubGlobal('location', new URL('http://localhost:5173/?music=synth'));
    try {
      const s = await fresh();
      expect(s.getMusicStyle()).toBe('synth');
      s.setNumber('volume', 0.4); // an unrelated write keeps the saved pick
      expect(JSON.parse(localStorage.getItem(STORE) ?? '{}')).toMatchObject({ musicStyle: 'orchestral' });
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

  it('defaults: WebGL, procedural island, auto tier, auto touch, horizon on, live clock', async () => {
    const s = await fresh();
    expect([s.setting('gpu'), s.setting('island'), s.setting('tier'), s.setting('touch'), s.setting('matte'), s.setting('time')])
      .toEqual(['webgl', 'procedural', 'auto', 'auto', 'on', 'live']);
    expect(s.pendingReload()).toEqual([]);
  });

  it('precedence: the URL param wins for this load, else the saved pick, else the default', async () => {
    localStorage.setItem(STORE, JSON.stringify({ island: 'blender', gpu: 'webgpu', tier: 'phone', matte: 'off', time: 'night' }));
    try {
      const saved = await at('');
      expect([saved.setting('island'), saved.setting('gpu'), saved.setting('tier'), saved.setting('matte'), saved.setting('time')]).toEqual(['blender', 'webgpu', 'phone', 'off', 'night']);
      expect(saved.settingFromUrl('island')).toBe(false);
      const url = await at('?island=procedural&gpu=webgpu-gl&tier=desktop&matte=1&tod=0.5&touch');
      expect([url.setting('island'), url.setting('gpu'), url.setting('tier'), url.setting('matte'), url.setting('time'), url.setting('touch')])
        .toEqual(['procedural', 'webgpu-gl', 'desktop', 'on', 'live', 'on']);
      expect(url.settingFromUrl('island')).toBe(true);
      expect(url.savedSetting('island')).toBe('blender'); // the URL is never persisted
      url.setNumber('volume', 0.3);
      expect(JSON.parse(localStorage.getItem(STORE) ?? '{}')).toMatchObject({ island: 'blender', gpu: 'webgpu', tier: 'phone', matte: 'off', time: 'night' });
    } finally { reset(); }
  });

  it('URL forms: ?matte=0 is off, an unknown ?gpu= is WebGL, an invalid ?island= falls through to the saved pick', async () => {
    localStorage.setItem(STORE, JSON.stringify({ island: 'blender', gpu: 'webgpu' }));
    try {
      const s = await at('?matte=0&gpu=nope&island=lego');
      expect(s.setting('matte')).toBe('off');
      expect(s.setting('gpu')).toBe('webgl');
      expect(s.setting('island')).toBe('blender');
      expect(s.settingFromUrl('island')).toBe(false);
    } finally { reset(); }
  });

  it('a saved value outside the option set falls back to the default', async () => {
    localStorage.setItem(STORE, JSON.stringify({ gpu: 'vulkan', time: 42 }));
    const s = await fresh();
    expect(s.setting('gpu')).toBe('webgl');
    expect(s.setting('time')).toBe('live');
  });

  it('a boot option saves the pick but keeps running what the page was built with, until the reload', async () => {
    const s = await fresh();
    const fn = vi.fn<(v: string) => void>();
    s.onSettingChange('island', fn);
    s.saveSetting('island', 'blender');
    s.saveSetting('island', 'blender');
    expect(s.setting('island')).toBe('procedural');
    expect(s.savedSetting('island')).toBe('blender');
    expect(fn.mock.calls).toEqual([['blender']]);
    expect(s.pendingReload()).toEqual(['island']);
    const next = await fresh();
    expect(next.setting('island')).toBe('blender');
    expect(next.pendingReload()).toEqual([]);
  });

  it('a live option applies at once and notifies once per real change, even over a URL override', async () => {
    try {
      const s = await at('?matte=0');
      const fn = vi.fn<(v: string) => void>();
      s.onSettingChange('matte', fn);
      s.saveSetting('matte', 'on');
      s.saveSetting('matte', 'on');
      expect(s.setting('matte')).toBe('on');
      s.saveSetting('time', 'golden');
      expect(s.setting('time')).toBe('golden');
      expect(fn.mock.calls).toEqual([['on']]);
      expect(s.pendingReload()).toEqual([]); // live options never wait for a reload
      expect(JSON.parse(localStorage.getItem(STORE) ?? '{}')).toMatchObject({ matte: 'on', time: 'golden' });
    } finally { reset(); }
  });

  it('carries the pre-E55 island pick (ws.island.v1) over once', async () => {
    localStorage.setItem('ws.island.v1', 'blender');
    expect((await fresh()).setting('island')).toBe('blender');
    localStorage.setItem(STORE, JSON.stringify({ island: 'procedural' }));
    expect((await fresh()).setting('island')).toBe('procedural'); // the new store wins once it has a pick
  });

  it('settingsReloadUrl drops every option / audio override and the extras, keeps the chunk and the dev params', async () => {
    const s = await fresh();
    const out = new URL(s.settingsReloadUrl('http://localhost:5173/?chunk=driftwood-isle&island=blender&gpu=webgpu&tier=phone&touch&matte=0&tod=0.5&clock=60&music=synth&sfx=moss&skipintro&nolock&x=3', ['skipintro']));
    expect([...out.searchParams.keys()]).toEqual(['chunk', 'nolock', 'x']);
    expect(s.settingParams('time')).toEqual(['tod', 'clock']);
  });
});

