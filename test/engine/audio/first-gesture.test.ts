// @vitest-environment happy-dom
// G325 (Jake, SF67): the page's AudioContext is made in the player's first gesture, never during load. Before it, the arrival's
// `enter()` (audio.resume + music.play) queues; the gesture builds the graph and starts the queued music.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Scope } from '../../../src/engine/app/scope';
import { withOwner } from '../../../src/engine/app/ownership';
import { Audio } from '../../../src/engine/audio/Audio';
import { Music } from '../../../src/engine/audio/Music';
import { audioUnlocked, installAudioUnlock, pageAudioContext, resetAudioUnlockForTest } from '../../../src/engine/audio/unlock';

/** A WebAudio stand-in: every node, param and buffer is one forgiving object (connect chains, params take values, buffers hold samples). */
function fakeNode(): Record<string, unknown> {
  const values = new Map<PropertyKey, unknown>([['value', 0], ['currentTime', 0], ['sampleRate', 48000], ['state', 'suspended'], ['numberOfChannels', 2], ['length', 96000], ['duration', 2]]);
  const node: Record<string, unknown> = new Proxy<Record<string, unknown>>({}, {
    get(_target, key) {
      if (key === Symbol.toPrimitive) return () => 0;
      if (key === 'then') return undefined;
      if (values.has(key)) return values.get(key);
      if (key === 'connect') return (next: unknown) => next;
      if (key === 'getChannelData') return () => new Float32Array(96000);
      if (key === 'resume') return () => { values.set('state', 'running'); return Promise.resolve(); };
      if (typeof key === 'string' && /^(create|set|cancel|linear|exponential|start|stop|disconnect|close)/u.test(key)) return () => (key.startsWith('create') ? fakeNode() : node);
      const child = fakeNode(); values.set(key, child); return child;
    },
    set(_target, key, value) { values.set(key, value); return true; },
  });
  return node;
}

/** a node class the fake never makes (Music's `instanceof` checks read it) */
function notThisNode(): void { /* instanceof only */ }
let made = 0;
/** the AudioContext constructor, counted (a plain function: `new` returns the fake it builds) */
function FakeContext(): Record<string, unknown> { made++; return fakeNode(); }

let unlockScope = new Scope('g325.page');
afterEach(() => { unlockScope.dispose(); unlockScope = new Scope('g325.page'); resetAudioUnlockForTest(); vi.unstubAllGlobals(); made = 0; });
beforeEach(() => { for (const name of ['OscillatorNode', 'GainNode', 'AudioScheduledSourceNode', 'AudioBufferSourceNode']) vi.stubGlobal(name, notThisNode); });

describe('the first-gesture AudioContext (G325)', () => {
  it('makes no context before the gesture; the gesture builds the graph and starts the queued music', () => {
    vi.stubGlobal('AudioContext', FakeContext);
    const target = new EventTarget(), uninstall = installAudioUnlock(unlockScope, target);
    const scope = new Scope('g325'), audio = withOwner(scope, () => new Audio()), music = withOwner(scope, () => new Music(audio));
    audio.music = music;
    // an arrival's enter() at the end of the load: no gesture yet
    audio.resume(); audio.worldMuted = false;
    if (!music.isPlaying) music.play('theme');
    music.sting('chunk');
    music.setState({ mode: 'calm', intensity: 0 });
    audio.footstep(false); audio.hitMarker(); audio.pickupHum(true);
    expect(audioUnlocked()).toBe(false);
    expect(made).toBe(0);
    expect(pageAudioContext()).toBeUndefined();
    expect(audio.ready).toBe(false);
    expect(music.isPlaying).toBe(true); // queued: a second enter() does not queue it twice
    expect(music.stems.synthOn).toBe(false);
    // the player's first tap
    target.dispatchEvent(new Event('pointerdown'));
    expect(audioUnlocked()).toBe(true);
    expect(made).toBe(1);
    expect(audio.ready).toBe(true);
    expect(pageAudioContext()).toBe(audio.ctx);
    expect(music.isPlaying).toBe(true);
    expect(music.stems.synthOn).toBe(true); // the queued theme started (the synth bridge: no stems decoded in this fixture)
    expect(music.state.mode).toBe('calm'); // the state set before the gesture reached the rig
    target.dispatchEvent(new Event('touchend'));
    expect(made).toBe(1); // one context per page
    uninstall(); scope.dispose(); unlockScope.dispose();
  });

  it('a page with no audio queued makes no context on its first tap (the cold title)', () => {
    vi.stubGlobal('AudioContext', FakeContext);
    const target = new EventTarget(), uninstall = installAudioUnlock(unlockScope, target);
    target.dispatchEvent(new Event('pointerdown'));
    expect(audioUnlocked()).toBe(true);
    expect(made).toBe(0);
    // ENTER WORLD's own handler wants audio: the context is made there, in that gesture
    const scope = new Scope('g325.title'), audio = withOwner(scope, () => new Audio());
    audio.resume();
    expect(made).toBe(1); expect(audio.ready).toBe(true);
    uninstall(); scope.dispose(); unlockScope.dispose();
  });

  it('a level unloaded before the gesture leaves nothing queued', () => {
    vi.stubGlobal('AudioContext', FakeContext);
    const target = new EventTarget(), uninstall = installAudioUnlock(unlockScope, target);
    const scope = new Scope('g325.unload'), audio = withOwner(scope, () => new Audio()), music = withOwner(scope, () => new Music(audio));
    audio.resume(); music.play('theme');
    audio.unloadLevel(); music.stop();
    expect(music.isPlaying).toBe(false);
    target.dispatchEvent(new Event('keydown'));
    expect(made).toBe(0); expect(audio.ready).toBe(false);
    uninstall(); scope.dispose(); unlockScope.dispose();
  });

  it('without the gate (a harness that never installs it) the first resume builds the context, as before', () => {
    vi.stubGlobal('AudioContext', FakeContext);
    const scope = new Scope('g325.off'), audio = withOwner(scope, () => new Audio());
    audio.resume();
    expect(made).toBe(1); expect(audio.ready).toBe(true);
    scope.dispose();
  });
});
