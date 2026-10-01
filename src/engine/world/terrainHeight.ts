/** Placement-height port. Collision queries still use the physics world. */
let sample: (x: number, z: number) => number = () => 0;
export function setTerrainHeight(fn: (x: number, z: number) => number): void { sample = fn; }
export function terrainHeight(x: number, z: number): number { return sample(x, z); }
