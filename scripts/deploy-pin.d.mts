/** Latest real built-dist boot status for this exact SHA; older successes cannot override newer failures. */
export function bootGreen(sha: string, query?: (args: string[]) => string): boolean;
/** Select the newest successful push CI that also passed a real boot on the exact same SHA. */
export function newestCiGreen(query?: (args: string[]) => string, log?: (line: string) => void, now?: number): string;
/** Bind an exact historical pin to a version successfully read from production in its release job. */
export function logProvesProduction(sha: string, log: string): boolean;
/** Prove a build was previously live, using its verified status or historical successful release logs. */
export function productionLive(sha: string, query?: (args: string[]) => string): boolean;
/** Whether this exact commit already passed the complete main push-CI workflow. */
export function ciGreen(sha: string, query?: (args: string[]) => string): boolean;
/** Whether the hourly release slot is free: no release run started in the last hour and none is queued or running (G284). */
export function releaseSlot(now?: number, query?: (args: string[]) => string, windowMs?: number): { free: boolean, why: string };

/** A newer CI-green candidate is waiting for exact-SHA smoke; selection has no pin yet. */
export class PendingBootSmokeError extends Error { constructor(sha: string); sha: string; }
/** Wait within the same release for a newer pending proof; timeout refuses instead of selecting an older pin. */
export function newestCiGreenAfterBoot(query?: (args: string[]) => string, log?: (line: string) => void, options?: { now?: () => number; wait?: (ms: number) => Promise<void>; maxWaitMs?: number }): Promise<string>;
