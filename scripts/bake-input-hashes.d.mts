export const RECORDED_BAKES: readonly { file: string; script: string; bake: string }[];
export function isRecordedBake(file: string): boolean;
export function bakeOutcome(text: string): string;
export function refreshBakeInputs(root: string): Promise<Record<string, string>>;

/** Exact SHA256 input map; nonregular and absent files refuse generation. */
export function bakeInputHashes(root:string,paths:Iterable<string>):Record<string,string>;
