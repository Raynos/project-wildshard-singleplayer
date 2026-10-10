export function failedSteps(out: string): string[];
export function failingTestFiles(out: string): string[];
export function newestPassing(candidates: readonly string[], passes: (sha: string) => boolean): number;
export function greenPrefix(root: string, tip: string, out: string): string | null;
