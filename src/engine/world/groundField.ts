import type { TerrainField } from '../level/data';

/** Analytic placement floor only: never a mesh, water body or collider. */
const STRUCTURE_FLOOR = -1000;
const STRUCTURE_FIELD: TerrainField = {
  heightAt: () => STRUCTURE_FLOOR,
  normalAt: () => [0, 1, 0],
  splatAt: () => [1, 0, 0, 0],
  trailDistance: () => Number.POSITIVE_INFINITY,
  cabinMask: () => 0,
  pondMask: () => 0,
  waterLevel: () => STRUCTURE_FLOOR - 1,
  streamAt: () => null,
  trails: [], cabinSites: [], pond: null,
};

/** Authored terrain wins; a structures-only world samples a placement floor at y = -1000 m. */
export function terrainFieldFor(ground: { terrain?: TerrainField; structures?: true | object }, id: string): TerrainField {
  if (ground.terrain !== undefined) return ground.terrain;
  if (ground.structures !== undefined) return STRUCTURE_FIELD;
  throw new Error(`No terrain for ${id}`);
}
