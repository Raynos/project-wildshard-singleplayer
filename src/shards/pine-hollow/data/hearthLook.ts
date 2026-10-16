/**
 * Pine Hollow's hearth particles (the chimney smoke, the hearth flames and their embers) as SF59 material graphs
 * (SHARD-PLATFORM W2 C2; the shardfile's `look.materials`, compiled by runtime/index.ts and drawn on the baked buildings'
 * instanced quads, runtime/props/bakedBuilding.ts). Each quad is one camera-facing billboard posed in the vertex stage
 * from its `aSeed` (x, y: shape and heading, z: speed and spread, w: phase) on the frame clock: no CPU work per frame.
 *
 * - `smoke`: rises, drifts downwind (world space, so every plume leans the same way) on a slow turbulence, grows and turns;
 *   a noisy round puff lit on the sun's side (`sunColour`, the sky's sun, fed each frame) and cool blue-grey in its own
 *   shade, dimmed by `shade` at night, the young plume catching the chimney's glow from below (`lamps`). Alpha, fogged.
 * - `flame`: tongues licking up and in from the hearth, a tall noisy body hot white at its heart. Additive, unfogged.
 * - `ember`: sparks rising on the wind, flickering out. Additive, unfogged.
 */

/** One particle kind: its life (s), rise (m), spread (m), size from birth to death (m), wind (m/s, world), blend. */
export interface HearthParticleRow {
  readonly life: number;
  readonly rise: number;
  readonly spread: number;
  readonly size: readonly [number, number];
  readonly wind: readonly [number, number, number];
}

/** the chimney smoke, the hearth flames and their embers */
export const CABIN_PARTICLE_KINDS: Readonly<Record<'smoke' | 'flame' | 'ember', HearthParticleRow>> = {
  smoke: { life: 11.0, rise: 12.0, spread: 0.25, size: [0.7, 4.6], wind: [1.6, 0.0, 0.45] },
  flame: { life: 0.85, rise: 0.95, spread: 0.36, size: [0.95, 0.3], wind: [0, 0, 0] },
  ember: { life: 2.8, rise: 3.4, spread: 0.4, size: [0.04, 0.012], wind: [0.3, 0, 0.15] },
};

/** the look.materials ids the hearth particles wear */
export const HEARTH_LOOKS = { smoke: 'pine-hearth-smoke', flame: 'pine-hearth-flame', ember: 'pine-hearth-ember' } as const;
