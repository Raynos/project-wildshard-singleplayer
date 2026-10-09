export const WITNESS_MANIFEST: RegExp;
export function isWitnessManifest(file: string): boolean;
export function manifestOutcome(text: string): string;
export function withInputs(text: string, inputs: string): string;
export function witnessSlugs(root: string): string[];
export function refreshWitnesses(root: string, cache: string): Promise<Record<string, string>>;
