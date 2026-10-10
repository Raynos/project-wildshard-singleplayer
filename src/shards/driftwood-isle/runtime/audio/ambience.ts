import type { Audio } from '@wildshard/engine/audio/Audio';
import { windUniforms } from '@wildshard/engine/world/TreeFactory';
import { AmbienceMix, type AmbienceMixSet } from '@wildshard/sdk/audio/ambienceMix';
import { ISLAND_MIX, type IslandZone } from '../../data/islandMix';
import { IslandBed, ISLAND_BED } from './sfx';
/**
 * IslandAmbience — Driftwood Isle's zoned soundscape (S1) and reverb zones + underwater (S2), project/archive/2026-09-23-driftwood-remaster.md;
 * its AmbienceZones profile since E357 S4.3 (08 §6.3 C.1: the beds live in the engine's AmbienceZones, the schedulers on the
 * profile's own Scope, the island's synth bed is installed here and handed over when the zoned graph is built).
 *
 *   const amb = new IslandAmbience(audio, { sea: OCEAN.level, heightAt, palms: palmSpecs, wreck, cove });
 *   game.onUpdate((dt) => amb.update(dt, game.camera));   // listener + the surf emitter every frame, the zone mix at 10 Hz
 *   amb.setUnderwater(true | false)                       // Player.onSubmerge / onSurface (next to audio.setUnderwater)
 *   amb.night = 0 … 1                                     // the day / night clock (the level's day cycle)
 *   amb.zone                                              // the dominant zone ('sea' | 'beach' | 'palms' | 'jungle' | 'cove' |
 *                                                         //   'lookout' | 'hold' | 'cave' | 'shrine'; E318: its never-wired onZone hook is gone)
 *   amb.diag                                              // the live mix: every bed's level and every reverb send (logging / tests)
 *
 * The beds (all built once, on the first update after the first gesture; nothing is created per frame):
 * - **surf** on a *line emitter*: the island's shoreline, found once by marching 256 rays in from the sea until the terrain
 *   breaks the surface, and every frame one PannerNode is moved to the nearest point of that polyline. Swells roll in on
 *   their own timer (a build, the break, the wash draining back), softer at night. Over the water (a pier, the shallows)
 *   a lapping bed joins it.
 * - **breeze** everywhere, rising with height; **high wind** on the lookout (a whistle through the frame, the pennant flapping).
 * - **palm rustle**: leaf flutter whose level follows the palms within 22 m of you (panned toward them) times the wind
 *   (TreeFactory `windUniforms.uWindStrength`, the uniform the sway shares, with the same slow gust the fronds swing on).
 * - **jungle** around the shrine: an insect drone pulsing in two bands, exotic bird calls; at night crickets instead.
 * - **cove**: the waterfall on its own PannerNode at the plunge pool (rumble + body + splash), drips in the sea cave.
 * - **underwater**: a bubble bed; the master low-pass (Audio.setUnderwater) ramps to 500 Hz over 150 ms on this shard.
 * Everything crossfades by position with 300 ms time constants; walls muffle the outdoor beds (hold / cave occlusion).
 * SHARD-PLATFORM M3: the beds are data/islandBeds.ts, the rest of the mix (emitters, zone weights, levels, rooms, diag, zone,
 * the swell / bird / drip one-shots) data/islandMix.ts, run by @wildshard/sdk/audio/ambienceMix; this profile hands it the
 * ports (the ground, the sea, the palms, the wreck and the cove, the waterfall's foot, the wind the palms sway in).
 *
 * Reverb (S2): ConvolverNodes with generated IRs (gen.ts: hold 0.6 s, cave 1.5 s, shrine 2.5 s), fed from the sfx bus
 * (footsteps, combat, vocals) through a send per room whose level follows how far inside that room you are (300 ms
 * crossfades); the returns go to `audio.world`. A room's convolver is only built the first time you get near it, and an
 * idle send is at gain 0 (the browser stops processing a convolver whose input is silent past its tail).
 */
import type { Camera } from 'three';
import source from '../../shard.config';
import { requireAudioProfile, requireAudioZone } from '@wildshard/engine/audio/audioProfiles';

/** The island's dominant zones. */
export type Zone = IslandZone;
/** A room's footprint: centre, radius and height span. */
export interface Bounds { x: number; z: number; r: number; yMin: number; yMax: number }

/** The island's ports. */
export interface IslandAmbienceOpts {
  sea: number;
  heightAt: (x: number, z: number) => number;
  /** the palms' trunks (Palms.scatterIsland specs) */
  palms?: readonly { x: number; z: number }[];
  /** the wreck: its `holdBounds` when the model has one (the hold reverb), else the hull footprint below the deck */
  wreck?: object | null;
  /** the cove's layout (Cove.forIsland()): the waterfall's foot and the sea-cave mouth */
  cove?: { fall: { foot: [number, number] }; cave: { x: number; z: number; yaw: number; depth: number } } | null;
}

const PROFILE = requireAudioProfile(source.audio.zones, 'ambience.driftwood');
const CAVE = requireAudioZone(PROFILE, 'cave');

/** Driftwood's ambience profile: the island synth bed until the zoned mix is built, then the mix of data/islandMix.ts. */
export class IslandAmbience {
  private readonly mix: AmbienceMixSet<Zone>;

  constructor(audio: Audio, o: IslandAmbienceOpts) {
    const f = o.cove?.fall.foot, c = o.cove?.cave, fall = { x: f?.[0] ?? 127.5, z: f?.[1] ?? 18 };
    // the cave's interior: `depth / 2` in from the mouth along its facing
    const cave = c ? { x: c.x - Math.sin(c.yaw) * c.depth * 0.5, z: c.z - Math.cos(c.yaw) * c.depth * 0.5 } : { x: CAVE.x, z: CAVE.z };
    // the synth island bed (breeze, surf hiss, swells) until the zoned graph is built (the mix's first build: `islandBed.zone()`)
    const islandBed = new IslandBed(audio);
    this.mix = new AmbienceMix(audio, PROFILE, ISLAND_MIX, {
      random: Math.random, scope: 'audio.island.ambience', heightAt: o.heightAt, sea: o.sea,
      objects: { wreck: o.wreck, cove: o.cove }, near: { palms: o.palms },
      points: { fall: { x: fall.x, y: o.heightAt(fall.x, fall.z) + 1, z: fall.z }, cave },
      // the wind the palms sway in: TreeFactory's shared strength and clock
      inputs: { windTime: () => windUniforms.uTime.value, windStrength: () => windUniforms.uWindStrength.value },
      onBuild: () => { islandBed.zone(); },
    }, 'beach');
    audio.installSynthBed(ISLAND_BED, islandBed, this.mix.scope);
  }

  /** 0 = day … 1 = night (the clock drives it) */
  get night(): number { return this.mix.night; }
  set night(v: number) { this.mix.night = v; }
  /** the dominant zone */
  get zone(): Zone { return this.mix.zone; }
  /** the live mix: every bed's level and every reverb send (logging / tests) */
  get diag(): Readonly<Record<string, number>> { return this.mix.diag; }

  /** the listener and the surf emitter every frame, the zone mix at 10 Hz */
  update(dt: number, camera: Camera): void { this.mix.frame(dt, camera); }

  /** head under / over the surface (next to audio.setUnderwater): the outdoor beds and sends drop, the bubble bed rises */
  setUnderwater(on: boolean): void { this.mix.setUnderwater(on); }

  /** the schedulers stop and the synth bed is unregistered (the mixer's unloadLevel fades what is left) */
  dispose(): void { this.mix.dispose(); }
}
