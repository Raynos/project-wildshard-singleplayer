/** Preserve a static-preview error transport's original payload for CI diagnosis, including nonfatal lifecycle diagnostics. */
export function bootErrorReport(url: string, method: string, body: string | null): unknown;
/** Only nonfatal boot-after-hide/nav-navigate diagnostics following observed grid navigation are acknowledged. */
export function bootLifecycleDiagnostic(report: unknown, observedGridNavigation: boolean): boolean;
