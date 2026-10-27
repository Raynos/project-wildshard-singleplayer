import type { Mirror } from './build-mirror.mjs';
import type { CommittedCheckPorts } from './push-committed-check.mjs';

export interface PushSubsetMirrorPorts {
  open: (revision: string, options: { repo: string; deadline: number }) => Mirror;
  gitDirectory: CommittedCheckPorts['gitDirectory'];
  run: CommittedCheckPorts['run'];
}
export function runCommittedSubset(root: string, tip: string, files: string[],
  deadline: number, ports?: PushSubsetMirrorPorts): { status: number; stdout: string; stderr: string };
export interface SubsetWriterPorts {
  stdout: (text: string) => Promise<void>;
  stderr: (text: string) => Promise<void>;
}
/** Keep the control record complete before diagnostics reach a merged parent pipe. */
export function writeCommittedSubset(result: { stdout: string; stderr: string }, ports?: SubsetWriterPorts): Promise<void>;
