import { afterEach, describe, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { Audio } from '#engine/audio/Audio';
import { tap } from '#engine/core/harnessTap';
import { IslandAmbience } from '../../../src/shards/driftwood-isle/audio/ambience';
import { IslandBed, IslandSfx, ISLAND_BED } from '../../../src/shards/driftwood-isle/audio/sfx';

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
});
