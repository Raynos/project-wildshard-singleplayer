import { setTerrainDatum, setTerrainHeight, setTerrainPlacement } from './terrainHeight';
import { terrainFieldFor } from './groundField';
import type { PondDef, TerrainField } from '../level/data';
import type { LevelSpec } from '../level/spec';
import { activeLevel, onLevelChange, selectedLevel } from '../level/selection';
// The level's terrain shape. Pure functions so the same field drives the mesh,
// player collision, tree placement and grass.
//
// The field itself is the selected level's `LevelSpec.ground.terrain` (compiled by src/engine/world/terrainField.ts);
// this module re-exports it under the names every consumer already imports. The exports are live `let` bindings
// resolved when a level is configured (src/engine/level/selection.ts) and again on every level change — no per-call
// lookup, so heightAt() stays as cheap as before. Read before any level is configured, a function resolves the active
// level on its first call.
import { CHUNK_HALF } from '../core/config';

const NO_POND: PondDef = { x: 0, z: 0, r: 0 };

function terrainOf(level: LevelSpec): TerrainField {
  return terrainFieldFor(level.ground, level.id);
}

/** the bound field (the level's, under any override); `null` until a level is configured. `base` is the level's own. */
const bound: { T: TerrainField | null; base: TerrainField | null } = { T: null, base: null };
/** fields bound over the level's (overrideTerrain), re-applied when the level changes */
type TerrainOverride = Partial<Pick<TerrainField, 'heightAt' | 'normalAt' | 'splatAt' | 'trailDistance' | 'cabinMask' | 'pondMask' | 'waterLevel' | 'streamAt'>>;
let override: TerrainOverride | null = null;
/** bind a level's field, under the override when there is one */
function bindBase(T: TerrainField): TerrainField { bound.base = T; return bind(override === null ? T : { ...T, ...override }); }
/** the bound field, binding the active level's on first use */
function field(): TerrainField { return bound.T ?? bindBase(terrainOf(activeLevel())); }

const noStream = (): number | null => null;
/** surface height, metres */
export let heightAt: TerrainField['heightAt'] = (x, z) => field().heightAt(x, z);
/** unit surface normal by central differences */
export let normalAt: TerrainField['normalAt'] = (x, z, eps) => field().normalAt(x, z, eps);
/** splat weights for the four ground layers of the level */
export let splatAt: TerrainField['splatAt'] = (x, z) => field().splatAt(x, z);
/** distance to the nearest trail centreline */
export let trailDistance: TerrainField['trailDistance'] = (x, z) => field().trailDistance(x, z);
/** 0 off the cabin pads → 1 on them */
export let cabinMask: TerrainField['cabinMask'] = (x, z) => field().cabinMask(x, z);
/** 0 outside the pond basin → 1 at its centre */
export let pondMask: TerrainField['pondMask'] = (x, z) => field().pondMask(x, z);
/** still-water surface height (far below the terrain when the level has no pond) */
export let waterLevel: TerrainField['waterLevel'] = () => field().waterLevel();
/** running water's surface at (x, z) (a creek), or null off it */
export let streamAt: NonNullable<TerrainField['streamAt']> = (x, z) => (field().streamAt ?? noStream)(x, z);
/** Trail polylines (xz). The first four enter at the edge midpoints. */
export let TRAILS: TerrainField['trails'] = [];
/** The level's cabin pads (x, z and yaw), flattened into its terrain. */
export let CABIN_SITES: TerrainField['cabinSites'] = [];
/** The level's pond (r = 0 when it has none — check `hasPond()`). */
export let POND: PondDef = NO_POND;

/** whether the running level has a pond (`POND` is a zero-size placeholder when it has none) */
export function hasPond(): boolean { return field().pond !== null; }

function bind(T: TerrainField): TerrainField {
  bound.T = T;
  heightAt = T.heightAt; setTerrainHeight(heightAt); normalAt = T.normalAt; splatAt = T.splatAt;
  trailDistance = T.trailDistance; cabinMask = T.cabinMask; pondMask = T.pondMask; waterLevel = T.waterLevel; streamAt = T.streamAt ?? noStream;
  TRAILS = T.trails; CABIN_SITES = T.cabinSites; POND = T.pond ?? NO_POND;
  return T;
}

const initial = selectedLevel();
if (initial !== null) bindBase(terrainOf(initial));
else setTerrainHeight(heightAt);
setTerrainPlacement((x, z) => normalAt(x, z), () => waterLevel());
// the field's runtime vertical shift (TerrainField.datum, 0 unless a level is shifted): the authored frame for saved poses
setTerrainDatum(() => field().datum ?? 0);
// a new level rebinds the analytic field (its bake is installed when it loads); the same field configured again keeps
// whatever is bound, an installed bake included
onLevelChange((level) => { const T = terrainOf(level); if (T !== bound.base) bindBase(T); });

/**
 * The baked grid (src/engine/world/BakedTerrain.ts, public/assets/baked/<slug>/terrain.bin) replaces the
 * analytic field with lookups over the terrain mesh's own vertices — the same numbers the mesh is
 * built from, so collision and planting sit exactly on the rendered surface. A level change
 * rebinds the analytic functions again (the next level's bake is installed when it loads).
 */
export function _installBakedTerrain(baked: Pick<TerrainField, 'heightAt' | 'normalAt' | 'splatAt'>): void {
  // the field's `datum` (a level shifted vertically at runtime): the bake holds the unshifted heights; normals are the same
  const datum = field().datum ?? 0, bakedHeight = baked.heightAt;
  heightAt = datum === 0 ? bakedHeight : (x, z) => bakedHeight(x, z) + datum;
  setTerrainHeight(heightAt); normalAt = baked.normalAt; splatAt = baked.splatAt;
}

/**
 * Bind terrain fields over the level's (a flat, dry world for a test or a playground: `{ heightAt: () => 0, waterLevel:
 * () => -100 }`) until the returned restore runs; a level change keeps them over the new level's field. Every reader
 * sees the same binding (the live exports here, the placement port), so nothing needs a module mock (E422).
 */
export function overrideTerrain(over: TerrainOverride): () => void {
  const prev = override;
  override = { ...prev, ...over };
  bindBase(bound.base ?? terrainOf(activeLevel()));
  return () => { override = prev; bindBase(bound.base ?? terrainOf(activeLevel())); };
}

/** whether (x, z) lies inside the level's square, `margin` metres in from its edge */
export function inChunk(x: number, z: number, margin = 0): boolean {
  return Math.abs(x) <= CHUNK_HALF - margin && Math.abs(z) <= CHUNK_HALF - margin;
}
