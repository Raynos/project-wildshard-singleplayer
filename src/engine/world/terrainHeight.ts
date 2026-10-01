/** Placement-height port. Collision queries still use the physics world. */
let sample: (x: number, z: number) => number = () => 0;
export function setTerrainHeight(fn: (x: number, z: number) => number): void { sample = fn; }
export function terrainHeight(x: number, z: number): number { return sample(x, z); }

let normal: (x: number, z: number) => [number, number, number] = () => [0, 1, 0];
let water: () => number = () => -1000;
export function setTerrainPlacement(normalFn: typeof normal, waterFn: typeof water): void { normal = normalFn; water = waterFn; }
export function terrainNormal(x: number, z: number): [number, number, number] { return normal(x, z); }
export function terrainWaterLevel(): number { return water(); }
