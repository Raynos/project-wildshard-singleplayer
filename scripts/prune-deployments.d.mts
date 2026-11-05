export const KEEP_PROMOTED: number;
export const STAGED_GRACE_MS: number;
export interface Deployment { uid: string; created: number; state?: string; target?: string | null; readySubstate?: string | undefined; }
export function prunable(deployments: readonly Deployment[], context: { liveId: string; aliased: ReadonlySet<string>; now: number }): Deployment[];
