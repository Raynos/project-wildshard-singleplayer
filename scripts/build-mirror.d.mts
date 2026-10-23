export interface Mirror {
  dir: string;
  sha: string;
  release: () => void;
}

export interface MirrorOptions {
  repo?: string;
  slot?: string;
  full?: boolean;
  env?: NodeJS.ProcessEnv;
  linkModules?: boolean;
}

export function mirrorRoot(env?: NodeJS.ProcessEnv, repo?: string): string;
export function openMirror(rev: string, options?: MirrorOptions): Mirror;

export function scratchCaller(path: string, repo?: string): boolean;
export function assertMirrorCaller(): void;
export function mainMirrorRevision(rev: string, repo?: string): string;
