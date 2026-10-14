import type { Audio } from '@wildshard/engine/audio/Audio';
import { windUniforms } from '@wildshard/engine/world/TreeFactory';
import { AmbienceMix } from '@wildshard/engine/audio/ambience';
import source from '../../shard.config';
import { requireAudioProfile, requireAudioZone, type AudioZoneProfile } from '@wildshard/engine/audio/audioProfiles';

export interface IslandAmbienceOpts {
  wind?: Parameters<Audio['windBed']>[0];
  sea: number;
  heightAt: (x: number, z: number) => number;
  /** the palms' trunks (Palms.scatterIsland specs) */
  palms?: readonly { x: number; z: number }[];
  /** the wreck: its `holdBounds` when the model has one (the hold reverb), else the hull footprint below the deck */
  wreck?: object | null;
  /** the cove's layout (Cove.forIsland()): the waterfall's foot and the sea-cave mouth */
  cove?: { fall: { foot: [number, number] }; cave: { x: number; z: number; yaw: number; depth: number } } | null;
}

/** Lend native island geometry and wind ports to the shared mix. */
export function createIslandAmbience(audio:Audio,o:IslandAmbienceOpts,profile:AudioZoneProfile=requireAudioProfile(source.audio.zones,'ambience.driftwood')):AmbienceMix {
    const wind=o.wind??requireAudioProfile(source.audio.ambience??undefined,'island wind');
    const CAVE = requireAudioZone(profile, 'cave');
    requireAudioZone(profile, 'shore');
    const f = o.cove?.fall.foot, c = o.cove?.cave, fall = { x: f?.[0] ?? 127.5, z: f?.[1] ?? 18 };
    // the cave's interior: `depth / 2` in from the mouth along its facing
    const cave = c ? { x: c.x - Math.sin(c.yaw) * c.depth * 0.5, z: c.z - Math.cos(c.yaw) * c.depth * 0.5 } : { x: CAVE.x, z: CAVE.z };
    // the synth island bed (breeze, surf hiss, swells) until the zoned graph is built (the mix's first build: `islandBed.zone()`)
    const islandBed = audio.windBed(wind);
    const mix = new AmbienceMix(audio, profile, {
      random: Math.random, scope: 'audio.island.ambience', heightAt: o.heightAt, sea: o.sea,
      objects: { wreck: o.wreck, cove: o.cove }, near: { palms: o.palms },
      points: { fall: { x: fall.x, y: o.heightAt(fall.x, fall.z) + 1, z: fall.z }, cave },
      // the wind the palms sway in: TreeFactory's shared strength and clock
      inputs: { windTime: () => windUniforms.uTime.value, windStrength: () => windUniforms.uWindStrength.value },
      onBuild: () => { islandBed.zone(); },
    }, 'beach');
    audio.installSynthBed(wind.bed, islandBed, mix.scope);
    return mix;

}
