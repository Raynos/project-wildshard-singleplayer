import { afterEach, describe, expect, it, vi } from 'vitest';
import { Audio } from '../../../src/engine/audio/Audio';
import { Scope } from '../../../src/engine/app/scope';
import { SteppeVoices, STEPPE_BED } from '../../../src/shards/nalati-grasslands/audio/synth';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('mixer level unload', () => {
  it('does not restart a synth bed when zoned ambience releases its sampled-bed flag after unload', () => {
    class Param implements AudioParam {
      value = 0; automationRate: AutomationRate = 'a-rate'; defaultValue = 0; minValue = -Infinity; maxValue = Infinity;
      setTargetAtTime(value: number, _time: number, _constant: number): AudioParam { this.value = value; return this; }
      setValueAtTime(value: number, _time: number): AudioParam { this.value = value; return this; }
      linearRampToValueAtTime(value: number, _time: number): AudioParam { this.value = value; return this; }
      exponentialRampToValueAtTime(value: number, _time: number): AudioParam { this.value = value; return this; }
      setValueCurveAtTime(_values: Float32Array, _time: number, _duration: number): AudioParam { return this; }
      cancelScheduledValues(_time: number): AudioParam { return this; }
      cancelAndHoldAtTime(_time: number): AudioParam { return this; }
    }
    class Gain {
      gain = new Param();
    }
    vi.stubGlobal('GainNode', Gain);
    vi.stubGlobal('AudioScheduledSourceNode', class { stop(): void { /* No sources in this bed fixture. */ } });
    vi.stubGlobal('window', { setTimeout: () => 1 });
    const audio = new Audio({ bed: STEPPE_BED }), scope = new Scope('bed-unload');
    vi.spyOn(audio, 'ctx', 'get').mockReturnValue({ currentTime: 0, state: 'running' } as AudioContext);
    let starts = 0;
    audio.installSynthBed(STEPPE_BED, { start: () => { starts++; audio.ownBedNodes(new Gain() as GainNode); }, stop: () => undefined }, scope);
    const voices = new SteppeVoices(audio);
    audio.resume();
    voices.sampledSteppe(true);
    expect(starts).toBe(2);
    expect(audio.census().beds).toBe(1);
    audio.unloadLevel();
    voices.sampledSteppe(false);
    expect(starts).toBe(2);
    expect(audio.census().beds).toBe(0);
    scope.dispose();
    expect(audio.census().beds).toBe(0);
  });
});
