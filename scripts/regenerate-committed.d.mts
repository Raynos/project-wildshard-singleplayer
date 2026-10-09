import type { GeneratedIncrease } from './generated-policy.mjs';

export function committedExport(root: string, sha: string, target: string): void;
export function regenerateCommitted(root: string, approvalFile?: string): Promise<string>;
export function checkCommitted(root: string, sha: string): Promise<void>;
export function verifiedStamp(root: string, sha: string): string;
export interface GeneratedApproval { approver?: string; increases?: readonly GeneratedIncrease[]; standing?: readonly { kind: string; key: string }[] }
export function approvedIncreases(approval: GeneratedApproval, increases: readonly GeneratedIncrease[]): GeneratedIncrease[];
