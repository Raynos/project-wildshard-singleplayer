import type { ParsedCommandLine, ParseConfigFileHost } from '@typescript/typescript6';

export interface StagedFiles { paths: string[]; blobs?: ReadonlyMap<string, string>; read: (name: string) => string | undefined }
export function stagedFiles(root: string): StagedFiles;
export function stagedProjects(root: string, staged: StagedFiles): {
  projects: Map<string, ParsedCommandLine>; project: (config: string) => ParsedCommandLine;
  name: (file: string) => string; host: ParseConfigFileHost;
};
export function stagedProjectFailures(root: string, files: string[]): string[];
