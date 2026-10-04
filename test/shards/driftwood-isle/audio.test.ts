import { afterEach, describe, expect, it, vi } from 'vitest';
import { Camera, Vector3 } from 'three';
import { Audio } from '#engine-internal/audio/Audio';
import { tap } from '#engine-internal/core/harnessTap';
import { IslandAmbience } from '../../../src/shards/driftwood-isle/audio/ambience';
import { IslandBed, IslandSfx, ISLAND_BED } from '../../../src/shards/driftwood-isle/audio/sfx';
import { driftwoodCueMap } from '../../../src/shards/driftwood-isle/audio/cues';
import { SurfaceMap } from '../../../src/shards/driftwood-isle/audio/surface';
import { DriftwoodScore } from '../../../src/shards/driftwood-isle/audio/score';
import { Scope } from '#engine-internal/app/scope';
import { Events } from '#engine-internal/events/events';
import { sortSystems, type SystemSpec } from '#engine-internal/app/systems';
import { driftwoodAudioSystems } from '../../../src/shards/driftwood-isle/audio/systems';
import { Music } from '#engine-internal/audio/Music';
import { createDriftwoodAudio } from '../../../src/shards/driftwood-isle/audio/files';

// E357 S4.3 (08 §6.3 C): the island's bed, gulls and voices left the engine mixer for Driftwood's audio folder.
describe("Driftwood's island audio on the engine mixer", () => {
  afterEach(() => { tap.sound = null; vi.restoreAllMocks(); });

  it('the ambience profile installs the island synth bed for its own life and hands it over when zoned', () => {
    const stop = vi.spyOn(IslandBed.prototype, 'stop');
    const audio = new Audio();
    // a round island of radius 100 at the origin, the sea at 0
    const amb = new IslandAmbience(audio, { sea: 0, heightAt: (x, z) => 5 - Math.hypot(x, z) / 20 });
    expect(ISLAND_BED).toBe('island');
    expect(stop).not.toHaveBeenCalled();
    amb.dispose();
    expect(stop).toHaveBeenCalledTimes(1);   // the scope unregistered and stopped the bed
    amb.dispose();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('a zoned island bed never starts its synth (the zoned graph owns the island)', () => {
    const ids: string[] = [];
    tap.sound = (id) => { ids.push(id); };
    const bed = new IslandBed(new Audio());
    bed.zone();
    bed.start();
    bed.stop();
    expect(ids).toEqual([]);
  });

  it('the gull calls keep their literal taps before the gesture (no context is created)', () => {
    const ids: string[] = [];
    tap.sound = (id) => { ids.push(id); };
    const audio = new Audio(), sfx = new IslandSfx(audio);
    sfx.gullCallAt(new Vector3(10, 2, 0), new Vector3(0, 0, 0));
    sfx.gullCall();
    expect(audio.ready).toBe(false);
    expect(ids).toEqual(['gullCallAt', 'gullCall']);
  });

  it('routes rich island cues without changing bank arguments, combining impacts and death voices, or accepting unknown kinds', () => {
    const audio = new Audio(), sfx = new IslandSfx(audio), listener = { position: new Vector3(0, 0, 0), yaw: 0.4 };
    const whoosh = vi.spyOn(sfx, 'whoosh').mockImplementation(() => undefined);
    const impact = vi.spyOn(sfx, 'impact').mockImplementation(() => undefined);
    const vocal = vi.spyOn(sfx, 'vocal').mockImplementation(() => undefined);
    const windup = vi.spyOn(sfx, 'windup').mockImplementation(() => undefined);
    const step = vi.spyOn(sfx, 'footstep').mockImplementation(() => undefined);
    const plunge = vi.spyOn(sfx, 'plunge').mockImplementation(() => undefined);
    const chime = vi.spyOn(sfx, 'interact').mockImplementation(() => undefined);
    const gull = vi.spyOn(sfx, 'gullCallAt').mockImplementation(() => undefined);
    const cue = driftwoodCueMap(sfx, listener), point = new Vector3(3, 4, 5);
    expect(cue('cue.weapon.fire', { speed: 0.7, heavy: true, dir: -1 })).toBe(true);
    expect(whoosh).toHaveBeenCalledWith(0.7, { heavy: true, dir: -1 });
    expect(cue('cue.hit.shell', { point, strength: 0.75 })).toBe(true);
    expect(impact).toHaveBeenCalledWith('shell', 0.75, point);
    expect(vocal).not.toHaveBeenCalled();
    cue('cue.creature.death', { kind: 'crab', point });
    expect(vocal).toHaveBeenCalledWith('crab', point, 1.3);
    expect(cue('cue.creature.death', { kind: 'bear', point })).toBe(false);
    expect(cue('cue.ai.windup', { kind: 'bear', point })).toBe(true);
    expect(windup).toHaveBeenCalledWith('boar', point);
    expect(cue('cue.ai.windup', { kind: 'monkey', point })).toBe(false);
    expect(cue('cue.weapon.clang.wood', { point, strength: 0.5 })).toBe(true);
    expect(impact).toHaveBeenLastCalledWith('wood', 0.5, point);
    for (const surface of ['sand', 'wetSand', 'grass', 'rock', 'planks', 'stone', 'water']) expect(cue(`cue.step.${surface}`, { speed: 6 })).toBe(true);
    expect(step).toHaveBeenLastCalledWith('water', 6);
    expect(cue('cue.step.litter', { speed: 6 })).toBe(false);
    cue('cue.player.dive', {}); cue('cue.player.surface', {});
    expect(plunge.mock.calls).toEqual([[false], [true]]);
    cue('cue.feat.earned', {}); expect(chime).toHaveBeenCalledWith('chime');
    cue('cue.ambient.gull', { point }); expect(gull).toHaveBeenCalledWith(point, listener.position, listener.yaw);
    expect(cue('step', {})).toBe(false);
  });

  it('keeps a caller surface default unanswered and releases a scoped island deck answer', () => {
    const events = new Events(), scope = new Scope('island surface');
    const request = { x: 4, y: 2, z: 5, surface: 'litter' as const };
    const surfaces = new SurfaceMap({ sea: 0, heightAt: () => 1, trailDistance: () => 100, decks: [{ floorHeightAt: () => 2 }] });
    expect(events.ask('player.stepSurface', request)).toBe(request);
    events.answer('player.stepSurface', (at) => ({ ...at, surface: surfaces.surfaceAt(at.x, at.z, at.y) }), scope);
    expect(events.ask('player.stepSurface', request).surface).toBe('planks');
    scope.dispose();
    expect(events.ask('player.stepSurface', request)).toBe(request);
  });

  it('owns the island score slot in play and uses the selected style bank without starting an audio device', () => {
    const scope = new Scope('score'), score = new DriftwoodScore({ genre: 'folk', refreshScore: () => undefined }, scope);
    expect(score.base).toBe('island');
    expect(score.target({ mode: 'calm', intensity: 0, underwater: false })).toBe('island');
    score.useStyleBank({ genre: 'folk', set: 'base', slots: new Map(), stings: new Map(), log: [] });
    expect(score.want(undefined)).toBeUndefined();
    expect(score.pending).toBe(false);
    scope.dispose(); score.dispose();
    expect(score.want(undefined)).toBeUndefined();
  });

  it('keeps the island synth lead as marimba and restores the default pluck when another score attaches', () => {
    const audio = new Audio(), music = new Music(audio), scope = new Scope('lead');
    const score = new DriftwoodScore(music, scope);
    music.setScore('score.driftwood', score);
    expect(music.state.lead).toBe('marimba');
    const { synthLead: _lead, ...other } = score;
    void _lead;
    music.setScore('score.other', { ...other, pending: false, target: () => 'other', want: () => undefined, useBank: () => undefined });
    expect(music.state.lead).toBe('pluck');
    expect(audio.ready).toBe(false);
    scope.dispose();
  });

  it('retains dusk before hands/enemies and weapons, pickups, listener, hum, ambience, interactions even when plugin systems register last', () => {
    const calls: string[] = [], systems: SystemSpec[] = [], camera = new Camera();
    const add = (id: string, run: () => void, after: string[] = [], before: string[] = []): void => {
      systems.push({ id, phase: 'update', after, before, run });
    };
    add('main.world', () => { calls.push('boundary', 'hands', 'enemies'); });
    add('engine.creatures.update', () => { calls.push('animals'); }, ['main.world'], ['main.equipment']);
    add('main.equipment', () => { calls.push('weapons', 'pickups'); }, ['engine.creatures.update'], ['engine.audio.listener']);
    add('engine.audio.listener', () => { calls.push('listener'); }, ['main.equipment'], ['main.frame']);
    add('main.frame', () => { calls.push('otherAudio', 'interactions'); }, ['engine.audio.listener']);
    const ambience = { night: 0, update: (dt: number, view: Camera): void => { expect(dt).toBe(0.02); expect(view).toBe(camera); calls.push(`ambience:${ambience.night}`); } };
    driftwoodAudioSystems({ system: (s) => { systems.push(s); } }, camera, {
      clock: () => ({ dusk: 0.7, night: 0.4 }), shrine: { setDusk: (d) => { calls.push(`dusk:${d}`); } },
      hum: { update: (view) => { expect(view).toBe(camera); calls.push('hum'); } }, ambience,
    });
    for (const s of sortSystems(systems)) s.run(0.02, 0);
    expect(calls).toEqual(['dusk:0.7', 'boundary', 'hands', 'enemies', 'animals', 'weapons', 'pickups', 'listener', 'hum', 'ambience:0.4', 'otherAudio', 'interactions']);
  });

  it('decodes moved island/shrine samples at the original gains and retains variant order and common loops', async () => {
    const profile = await createDriftwoodAudio(), reads: string[] = [];
    const bytes = new TextEncoder(), labels = new WeakMap<AudioBuffer, string>();
    const bank = await profile.decode('synth', (url) => { reads.push(url); return Promise.resolve(bytes.encode(url).buffer); },
      (data) => {
        const buffer: AudioBuffer = { duration: 40, length: 1, numberOfChannels: 1, sampleRate: 1, getChannelData: () => new Float32Array(1), copyFromChannel: () => undefined, copyToChannel: () => undefined };
        labels.set(buffer, new TextDecoder().decode(data));
        return Promise.resolve(buffer);
      });
    const samples = bank.samples;
    expect(samples).toBeDefined();
    expect([...samples?.loops.keys() ?? []]).toEqual(['island', 'underwater', 'pickup', 'shrine']);
    expect(samples?.loops.get('island')?.gain).toBe(0.25);
    expect(samples?.loops.get('shrine')?.gain).toBe(0.36);
    expect(samples?.shots.get('crab_snap')?.bufs.map((buffer) => labels.get(buffer))).toEqual([
      '/assets/sfx/driftwood-isle/crab_snap-2-bff601ad.m4a', '/assets/sfx/driftwood-isle/crab_snap-3-69ea11c0.m4a',
    ]);
    expect(reads.filter((url) => url.startsWith('/assets/sfx/driftwood-isle/'))).toHaveLength(16);
    expect(reads.some((url) => url.startsWith('/assets/sfx/best/bed-island'))).toBe(false);
    const selected = profile.bootFiles('folk');
    expect(new Set(selected).size).toBe(selected.length);
    expect(selected.some((url) => url.startsWith('/assets/music/folk/island'))).toBe(true);
    expect(selected.some((url) => url.startsWith('/assets/sfx/driftwood-isle/'))).toBe(true);
  });
});
