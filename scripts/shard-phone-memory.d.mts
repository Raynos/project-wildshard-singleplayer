/** Independent Chromium floors, with the G658 M1 steady-state MiB targets. */
export const coreMemoryTargets: readonly Readonly<{shard: string; name: string; limitBytes: number}>[];
export const helloWorldMemoryTarget: Readonly<{shard: 'hello'; name: string; limitBytes: null}>;
export const helloWorldMemoryHTML: string;
export function serveHelloWorldMemory(): Promise<{url: string; close: () => Promise<void>}>;
export function helloWorldMemoryFloor(input: unknown): {phase: string; rendererBytes: number; gpuBytes: number; totalBytes: number; menuLimitBytes: number; templateLimitBytes: number};
/** Select one existing target or all four, retaining their original identities. */
export function selectedCoreMemoryTargets(selection: string): readonly (typeof coreMemoryTargets[number] | typeof helloWorldMemoryTarget)[];
/** Existing device fixture exposing the explicit SHARDFILE button for compiled-only floors. */
export const compiledFloorSave: Readonly<{scope: 'device'; key: 'debug.global.legacyShardButtons'; data: 'on'}>;
/** Distinct loaded script URLs, without fetching or retaining response bodies. */
export function scriptResourceURLs(entries?: readonly {name: string}[]): string[];
/** Compare the original 120-second renderer+GPU reading; missing/errors fail as unknown. */
export function coreMemorySummary(input: unknown): {shard: string; name: string; limitBytes: number; totalBytes: number | null; passed: boolean}[];
export interface SimulatorCoreProcess {pid: number; startAbstime: number; physicalFootprintBytes: number}
export interface SimulatorCoreFootprint {webContent: SimulatorCoreProcess[]; gpu: SimulatorCoreProcess[]; rendererBytes: number; gpuBytes: number}
export function simulatorCoreFootprint(input: unknown): SimulatorCoreFootprint;
/** Caller owns sim-lane; reads only processes below its Simulator launchd. */
export function readSimulatorCoreFootprint(device: string): SimulatorCoreFootprint;
