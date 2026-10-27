import type { Mirror } from './build-mirror.mjs';
import type { GateSelection } from './gate-selection.mjs';
import type { CommitJob, CommitResult, runCommitJobs } from './precommit-jobs.mjs';

export interface CandidateCheckPlan {
  immediate: CommitJob[];
  preparation: CommitJob[];
  consumers: CommitJob[];
}
export interface CandidatePlanOptions {
  signal?: AbortSignal;
  token?: string;
  execute?: typeof runCommitJobs;
}
export function candidateCheckPlan(checker: string, selection: GateSelection, changed: readonly string[], registry: Readonly<Record<string, readonly string[]>>): CandidateCheckPlan;
export function runCandidatePlan(repository: string, mirror: Mirror, plan: CandidateCheckPlan, deadline: number, options?: CandidatePlanOptions): Promise<CommitResult[]>;
export function candidateStepOutcomes(results: readonly CommitResult[], token: string): {failures: string[]; deferred: string[]};
