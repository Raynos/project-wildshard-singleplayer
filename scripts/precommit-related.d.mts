import type { Plugin } from 'vite';
import type { CommitJob, CommitResult } from './precommit-jobs.mjs';
import type { StagedFiles } from './precommit-projects.mjs';

export function stagedInputOverride(root: string, staged: StagedFiles): Plugin;
export function relatedDeadline(started?: string, wall?: number, clock?: number): number;
export function relatedWorker(root: string, files: string[]): Promise<void>;
export function warmTypeJobs(root: string, files: string[]): CommitJob[];
export function commitRelated(root: string, changed: string[], deadline?: number): Promise<void>;
export function relatedTestFailed(result: CommitResult, token: string): boolean;
