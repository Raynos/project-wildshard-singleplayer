/** SHA256 for every bounded regular checkpoint file. */
export function checkpointHashes(directory: string): Record<string, string>;
/** Validate transport metadata and return the original native outcome. */
export function readWitnessManifest(file: string | URL): Record<string, unknown>;
/** Small generated manifest carrying every checkpoint SHA256. */
export function cachedWitnessManifest(directory: string): string;
/** Darwin compares normative bit identity; every platform verifies its local cache independently. */
export function compareWitnessManifests(expected: string, actual: string, platform?: string): void;
