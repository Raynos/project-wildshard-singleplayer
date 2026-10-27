import type { GateSelection } from './gate-selection.mjs';
import type { CommitJob, CommitResult } from './precommit-jobs.mjs';

export interface PushSubsetJob extends CommitJob { after: string[] }
export interface PushSubsetResult extends CommitResult { blocked?: string[] }
export interface PushSubsetPorts {
  run: (root: string, jobs: CommitJob[], deadline: number,
    env: NodeJS.ProcessEnv, signal: AbortSignal) => Promise<CommitResult[]>;
}
/** Build commands only from the shared candidate selection and its product registry. */
export function pushSubsetJobs(selection: GateSelection, changed: readonly string[],
  paths: readonly string[], products: Readonly<Record<string, readonly string[]>>): PushSubsetJob[];
/** Run independent steps together; a refused producer blocks its readers. */
export function runPushSubset(root: string, jobs: PushSubsetJob[], deadline: number,
  env?: NodeJS.ProcessEnv, ports?: PushSubsetPorts): Promise<PushSubsetResult[]>;
/** Observed refusals remain fatal even when their process also reached the cap. */
export function pushSubsetVerdict(results: readonly PushSubsetResult[]): {
  failed: string[]; unfinished: string[];
};
export function pushSubsetControlRecord(results: readonly PushSubsetResult[]): {
  results: PushSubsetResult[]; verdict: { failed: string[]; unfinished: string[] };
};
/** CI replays named unfinished steps plus their actual prerequisites. */
export function selectPushSteps(jobs: readonly PushSubsetJob[], names: readonly string[]): PushSubsetJob[];
/** Replay the unchanged native intake only after ordinary declared generation. */
export function nativeOutputReplayJob(jobs: readonly PushSubsetJob[], roots: readonly string[]): PushSubsetJob;
