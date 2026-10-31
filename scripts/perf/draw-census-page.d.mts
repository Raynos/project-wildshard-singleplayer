import type { NativeFrame, AttributionFrame } from './draw-census-report.mjs';
/** Native counters, with optional property counts confined to the attribution window. */
export function drawFrames(options: {frames: number; attribution: boolean; propertyCalls?: boolean}): Promise<(NativeFrame & Partial<AttributionFrame> & {frame: number})[]>;
