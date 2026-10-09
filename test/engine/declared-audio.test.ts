import { afterEach, expect, it, vi } from 'vitest';
import { Audio } from '../../src/engine/audio/Audio';
import { Scope } from '../../src/engine/app/scope';
import { CombatCues, type CombatCueOpts } from '../../src/engine/combat/cues';
import { installDeclaredAudio, type DeclaredAudioPorts } from '../../src/engine/audio/declared';
import { parseAudioData } from '../../src/game/shardfile/audio';
import { TEMPLATE_AUDIO } from '../../src/shards/_template/data/audio';

function fixture() {
  const scope = new Scope('audio.fixture'), cues = new CombatCues(), gain = { value: 0.4 }, calls: { voice: string; opts: CombatCueOpts }[] = [];
  const winds: number[][] = [], beds: string[] = []; let stop: (() => void) | undefined, disconnected = 0;
  const voices = new Map(TEMPLATE_AUDIO.cues.map((cue) => [cue.voice, (opts: CombatCueOpts) => { calls.push({ voice: cue.voice, opts }); }]));
  const audio: DeclaredAudioPorts['audio'] = {
    installCues: () => undefined,
    installSynthBed: (id, bed, owner) => { beds.push(id); stop = bed.stop; owner.onDispose(bed.stop); bed.start(); },
    restartSynthBed: (id) => { beds.push(`restart:${id}`); },
    mkWind: (...args) => { winds.push(args.filter((arg): arg is number => arg !== undefined)); return { disconnect: () => { disconnected++; } }; },
  };
  return { scope, cues, gain, calls, winds, beds, ports: { scope, cues, music: { silence: (owner: Scope) => { const before = gain.value; gain.value = 0; owner.onDispose(() => { gain.value = before; }); } }, voices, audio }, stop: () => stop?.(), disconnected: () => disconnected };
}
it('plays the declared template cue map through engine routing, starts matching forest winds and silences only the score', () => {
  const f = fixture(); installDeclaredAudio(TEMPLATE_AUDIO, f.ports);
  expect(f.gain.value).toBe(0); expect(f.beds).toEqual(['forest', 'restart:forest']);
  expect(f.winds).toEqual([[260, 0.5, -0.55, 0.07, 0.11], [620, 0.8, 0.55, 0.11, 0.06]]);
  for (const cue of ['cue.sword.swing', 'cue.sword.hit', 'cue.sword.heavy', 'cue.reload', 'cue.swap'] as const) expect(f.cues.cue(cue, { surface: 'wood', pan: -0.2, gain: 0.7 })).toBe(true);
  expect(f.calls.map((call) => call.voice)).toEqual(TEMPLATE_AUDIO.cues.map((cue) => cue.voice));
  expect(f.calls[1]?.opts).toMatchObject({ surface: 'wood', pan: -0.2, gain: 0.7 });
  expect(f.cues.cue('cue.unknown')).toBe(false);
  f.stop(); f.scope.dispose(); expect(f.disconnected()).toBe(2); expect(f.gain.value).toBe(0.4);
  expect(f.cues.cue('cue.sword.swing')).toBe(false); expect(f.scope.census.sounds).toBe(0);
});
it('rejects invalid parameters and unknown voices before installing any source, cue or score change', () => {
  expect(() => parseAudioData({ ...TEMPLATE_AUDIO, cues: [...TEMPLATE_AUDIO.cues, TEMPLATE_AUDIO.cues[0]] })).toThrow();
  expect(() => parseAudioData({ ...TEMPLATE_AUDIO, ambience: { bed: 'forest', winds: [{ frequency: Number.NaN, q: 1, pan: 2, rate: 1, gain: 4 }] } })).toThrow();
  const f = fixture();
  try {
    expect(() => installDeclaredAudio({ ...TEMPLATE_AUDIO, cues: [{ id: 'cue.forbidden', voice: 'unknown' }] }, f.ports)).toThrow('Unknown catalogue');
    expect(f.beds).toEqual([]); expect(f.gain.value).toBe(0.4); expect(f.cues.cue('cue.forbidden')).toBe(false);
  } finally { f.scope.dispose(); }
});
it('dispatches conditional data before thin fallback and cancels declared echoes when the owner leaves', () => {
  vi.useFakeTimers();
  const f = fixture(), data = parseAudioData({ ...TEMPLATE_AUDIO, ambience: null, score: 'default', routing: [
    { id: 'cue.sword.swing', when: [{ op: 'number', field: 'dir' }], actions: [{ voice: 'weapon.swap' }, { voice: 'sword.hit', delay: 0.42, defaults: { gain: 0.55 } }] },
  ] });
  try {
    installDeclaredAudio(data, f.ports);
    expect(f.cues.cue('cue.sword.swing', { dir: 1 })).toBe(true); expect(f.calls.map((call) => call.voice)).toEqual(['weapon.swap']);
    expect(f.cues.cue('cue.sword.swing')).toBe(true); expect(f.calls.map((call) => call.voice)).toEqual(['weapon.swap', 'sword.swing']);
    f.scope.dispose(); vi.advanceTimersByTime(1000);
    expect(f.calls).toHaveLength(2); expect(f.cues.cue('cue.sword.swing', { dir: 1 })).toBe(false);
  } finally { f.scope.dispose(); }
});

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
it('starts and unloads the data bed through the actual engine mixer lifetime', () => {
  vi.useFakeTimers();
  const audio = new Audio({ bed: 'forest' }), f = fixture(); let stopped = 0;
  vi.spyOn(audio, 'ctx', 'get').mockReturnValue({ currentTime: 0, state: 'running' } as AudioContext);
  const wind = vi.spyOn(audio, 'mkWind').mockImplementation(() => ({ disconnect: () => { stopped++; } } as GainNode));
  try {
    installDeclaredAudio(TEMPLATE_AUDIO, { ...f.ports, audio });
    expect(wind).not.toHaveBeenCalled(); audio.resume();
    expect(wind.mock.calls).toEqual([[260, 0.5, -0.55, 0.07, 0.11], [620, 0.8, 0.55, 0.11, 0.06]]);
    audio.unloadLevel(); expect(stopped).toBe(2); f.scope.dispose(); expect(stopped).toBe(2);
  } finally { f.scope.dispose(); audio.dispose(); }
});

it('keeps generic and combat cue buses separate and removes both on unload', () => {
  const f = fixture(), audio = new Audio(), data = parseAudioData({ ...TEMPLATE_AUDIO, ambience: null, score: 'default', routing: [
    { id: 'cue.shared', bus: 'audio', actions: [{ voice: 'weapon.swap' }] },
    { id: 'cue.shared', bus: 'combat', actions: [{ voice: 'sword.hit' }] },
  ] });
  try {
    installDeclaredAudio(data, { ...f.ports, audio });
    expect(audio.cue('cue.shared')).toBe(true); expect(f.cues.cue('cue.shared')).toBe(true);
    expect(f.calls.map((call) => call.voice)).toEqual(['weapon.swap', 'sword.hit']);
    f.scope.dispose(); expect(audio.cue('cue.shared')).toBe(false); expect(f.cues.cue('cue.shared')).toBe(false);
  } finally { f.scope.dispose(); audio.dispose(); }
});

it('refuses an unbound extended recipe before changing audio and binds its lifetime when admitted', () => {
  const f = fixture(), data = parseAudioData({ ...TEMPLATE_AUDIO, zones: { id: 'fixture.zones', smoothSeconds: 0.1, tickHz: 10,
    silentSeconds: 8, holdSeconds: 3, levels: { wind: 0.7 }, wet: { room: 0.4 }, zones: [] } });
  let stopped = 0;
  try {
    expect(() => installDeclaredAudio(data, f.ports)).toThrow('trusted catalogue installer');
    expect(f.beds).toEqual([]); expect(f.gain.value).toBe(0.4); expect(f.cues.cue('cue.sword.swing')).toBe(false);
    installDeclaredAudio(data, { ...f.ports, profiles: { zones: (profile, scope) => {
      expect(profile).toEqual(data.zones); scope.onDispose(() => { stopped++; });
    } } });
    f.scope.dispose(); expect(stopped).toBe(1);
  } finally { f.scope.dispose(); }
});
