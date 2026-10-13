export function failedSteps(out: string): string[];
export function failingTestFiles(out: string): string[];
export function failureCommands(steps: readonly string[]): string[][] | null;
export function probeFailure(root: string, sha: string, files: readonly string[], commands?: readonly string[][], keepPassing?: (work: string, snapshot: string) => void): boolean;
export function probeSnapshot(work: string): string;
export function newestPassing(candidates: readonly string[], passes: (sha: string) => boolean): number;
export function newerGateFix(root: string, tip: string, out: string): string | null;
export function greenPrefix(root: string, tip: string, out: string, mode?: 'vitest' | 'witness'): string | null;
export function failingLintFiles(out: string): string[];
