import type { PineScanPart } from './propShapes';
import type { PropRows } from './propRows';
import type { PineSources } from './pineSources';
/** The forest's trunks the props step round (the physics bake's `trees`: x, z, r). */
export function pineTrunkCircles(sources: PineSources): { x: number; z: number; r: number }[];
/** The props bake's rows (src/shards/pine-hollow/generators/bake-pine-props.mjs). */
export function bakePropRows(sources: PineSources): Promise<PropRows>;
/** The props bake's rows, built once per sources. */
export function pineProps(sources: PineSources): Promise<PropRows>;

/** Original scan parts and native world frames, without decoding images. */
export function pinePropScan(sources: PineSources, id: string): Promise<PineScanPart[]>;
