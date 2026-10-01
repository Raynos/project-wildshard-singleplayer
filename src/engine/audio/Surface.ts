/**
 * Surface — what the player is standing on, for footsteps (B9, project/archive/2026-09-23-driftwood-remaster.md).
 *
 *   const surfaces = new SurfaceMap({ sea: OCEAN.level, heightAt, trailDistance,
 *     decks: [pier, ...jetties, boat, hut, lookout, bridge, wreck],   // anything with floorHeightAt → 'planks'
 *     stone: [shrine] });                                              // … → 'stone'
 *   surfaces.surfaceAt(x, z, feetY)   // 'planks' | 'stone' | 'water' | 'wetSand' | 'sand' | 'grass' | 'rock'
 *
 * A deck counts when its floor is within 0.45 m of the feet (so walking *under* the pier on the sandbar is sand, not
 * planks). Off the decks the ground is classified exactly as the low-poly terrain paints it (Terrain.ts
 * lowPolyGroundColor): height above the sea + slope → wet sand (the swash line) / sand / grass, rock on the steep facets,
 * and the sand paths (trailDistance) over the grass. No allocation: the slope is four heightAt samples.
 */
export type Surface = 'sand' | 'wetSand' | 'grass' | 'rock' | 'planks' | 'stone' | 'water';

export interface Floor { floorHeightAt: (x: number, z: number) => number | undefined }

export interface SurfaceOpts {
  sea: number;
  heightAt: (x: number, z: number) => number;
  trailDistance: (x: number, z: number) => number;
  /** wooden floors: piers, jetties, the boat, the hut, the lookout, the rope bridge, the wreck deck */
  decks: readonly (Floor | null | undefined)[];
  /** stone floors: the shrine dais */
  stone?: readonly (Floor | null | undefined)[];
}

const DECK_TOL = 0.45;
/** the terrain's rock band starts at slope 0.24 and is solid by 0.4 (Terrain.ts); a step reads as rock past the midpoint */
const ROCK_SLOPE = 0.32;

export class SurfaceMap {
  private decks: Floor[]; private stone: Floor[];
  constructor(private readonly o: SurfaceOpts) {
    this.decks = o.decks.filter((d): d is Floor => d !== null && d !== undefined);
    this.stone = (o.stone ?? []).filter((d): d is Floor => d !== null && d !== undefined);
  }

  /** add a floor built later (a module that lands after the map was made) */
  addDeck(f: Floor, kind: 'planks' | 'stone' = 'planks'): void { (kind === 'stone' ? this.stone : this.decks).push(f); }

  surfaceAt(x: number, z: number, y: number): Surface {
    for (const d of this.decks) { const f = d.floorHeightAt(x, z); if (f !== undefined && Math.abs(y - f) < DECK_TOL) return 'planks'; }
    for (const d of this.stone) { const f = d.floorHeightAt(x, z); if (f !== undefined && Math.abs(y - f) < DECK_TOL) return 'stone'; }
    const H = this.o.heightAt, g = H(x, z), h = g - this.o.sea;
    if (h < 0.02) return 'water';
    const e = 1.0, dx = (H(x + e, z) - H(x - e, z)) / (2 * e), dz = (H(x, z + e) - H(x, z - e)) / (2 * e);
    const slope = 1 - 1 / Math.sqrt(1 + dx * dx + dz * dz); // 1 − normal.y
    if (slope > ROCK_SLOPE) return 'rock';
    if (h < 0.45) return 'wetSand';
    if (h > 3.35) return this.o.trailDistance(x, z) < 3.3 ? 'sand' : 'grass';
    return 'sand';
  }
}
