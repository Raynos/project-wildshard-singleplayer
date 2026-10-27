import type { Mirror } from './build-mirror.mjs';
import type { ProcessEnv } from 'node:process';

interface CommittedEnvironment extends ProcessEnv {
  WS_GIT_NATIVE_REPORT_ONLY?: string;
  GIT_DIR: string;
  GIT_WORK_TREE: string;
  GIT_INDEX_FILE: string;
}

export interface CommittedCheckPorts {
  open: (revision: string, options: { repo: string }) => Mirror;
  gitDirectory: (root: string) => string;
  run: (command: string, args: string[], options: {
    cwd: string; encoding: 'utf8'; maxBuffer: number; env: CommittedEnvironment;
  }) => { status: number | null; stdout: string | null; stderr: string | null; error?: Error };
}
export function runCommittedCheck(root: string, base: string, tip: string, phase: string,
  files: string[], ports?: CommittedCheckPorts, checkerDirectory?: string): { status: number; stdout: string; stderr: string };
