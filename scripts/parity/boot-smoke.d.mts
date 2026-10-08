/** Preserve a static-preview error transport's original payload for CI diagnosis, without suppressing the failure. */
export function bootErrorReport(url: string, method: string, body: string | null): unknown;
