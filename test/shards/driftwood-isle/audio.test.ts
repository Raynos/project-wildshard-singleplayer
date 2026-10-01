import { afterEach, describe, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { Audio } from '#engine/audio/Audio';
import { tap } from '#engine/core/harnessTap';
import { IslandAmbience } from '../../../src/shards/driftwood-isle/audio/ambience';
import { IslandBed, IslandSfx, ISLAND_BED } from '../../../src/shards/driftwood-isle/audio/sfx';
import { driftwoodCueMap } from '../../../src/shards/driftwood-isle/audio/cues';
import { SurfaceMap } from '../../../src/shards/driftwood-isle/audio/surface';
import { DriftwoodScore } from '../../../src/shards/driftwood-isle/audio/score';
import { Scope } from '#engine/app/scope';
import { Events } from '#engine/events/events';

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
    const scope = new Scope('score'), score = new DriftwoodScore({ style: 'folk', refreshScore: () => undefined }, scope);
    expect(score.base).toBe('island');
    expect(score.target({ shard: 'unused', mode: 'calm', intensity: 0, underwater: false })).toBe('island');
    score.useStyleBank({ style: 'folk', set: 'base', slots: new Map(), stings: new Map(), log: [] });
    expect(score.want(undefined)).toBeUndefined();
    expect(score.pending).toBe(false);
    scope.dispose(); score.dispose();
    expect(score.want(undefined)).toBeUndefined();
  });
});
