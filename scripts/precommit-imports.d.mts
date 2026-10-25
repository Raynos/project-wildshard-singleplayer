import type { StagedFiles } from './precommit-projects.mjs';

export function candidateImportSources(root: string, staged: StagedFiles): {
  sources: Map<string, string>; imports: Map<string, readonly string[]>; hits: number; misses: number;
};
