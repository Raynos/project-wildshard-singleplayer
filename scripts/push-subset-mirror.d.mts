import type { Mirror } from './build-mirror.mjs';
import type { CommittedCheckPorts } from './push-committed-check.mjs';

export interface PushSubsetMirrorPorts {
  open: (revision: string, options: { repo: string; deadline: number }) => Mirror;
  gitDirectory: CommittedCheckPorts['gitDirectory'];
  run: CommittedCheckPorts['run'];
}
export function runCommittedSubset(root: string, tip: string, files: string[],
  deadline: number, ports?: PushSubsetMirrorPorts): { status: number; stdout: string; stderr: string };
