export function committedExport(root: string, sha: string, target: string): void;
export function regenerateCommitted(root: string, approvalFile?: string): Promise<string>;
export function checkCommitted(root: string, sha: string): Promise<void>;
