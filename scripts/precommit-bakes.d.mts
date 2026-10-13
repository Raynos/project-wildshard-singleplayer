export const NATIVE_BAKES: string[][];
export function nativeBakePlan(root: string): Promise<{slug: string; file: string; command: string[]}[]>;
export function regenerateCheapBakes(root: string, product?: {url?: string; revision?: string; stagedPaths?: string[]; guardRequirement?: string}): Promise<string[]>;
export function refreshRecordedCommitInputs(root: string, witnessCache: string): Promise<string[]>;
export function refreshCommitMeasurements(root: string, stagedPaths: string[] | undefined, guardRequirement?: string): Promise<string[]>;
