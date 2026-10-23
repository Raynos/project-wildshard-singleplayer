/** Independent Chromium floors, with the G658 M1 steady-state MiB targets. */
export const coreMemoryTargets: readonly Readonly<{shard: string; name: string; limitBytes: number}>[];
/** Distinct loaded script URLs, without fetching or retaining response bodies. */
export function scriptResourceURLs(entries?: readonly {name: string}[]): string[];
/** Compare the original 120-second renderer+GPU reading; missing/errors fail as unknown. */
export function coreMemorySummary(input: unknown): {shard: string; name: string; limitBytes: number; totalBytes: number | null; passed: boolean}[];
export interface SimulatorCoreProcess {pid: number; startAbstime: number; physicalFootprintBytes: number}
export interface SimulatorCoreFootprint {webContent: SimulatorCoreProcess[]; gpu: SimulatorCoreProcess[]; rendererBytes: number; gpuBytes: number}
export function simulatorCoreFootprint(input: unknown): SimulatorCoreFootprint;
/** Caller owns sim-lane; reads only processes below its Simulator launchd. */
export function readSimulatorCoreFootprint(device: string): SimulatorCoreFootprint;
