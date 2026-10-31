import type { NativeFrame, AttributionFrame } from './draw-census-report.mjs';
/** Native counters, with optional property counts confined to the attribution window. */
export function drawFrames(options: {frames: number; attribution: boolean; propertyCalls?: boolean; systemIds?: string[]}): Promise<(NativeFrame & Partial<AttributionFrame> & {frame: number; systems?: Record<string, {calls: number; ms: number}>})[]>;
