/** Preserve a static-preview error transport's original payload for CI diagnosis, including nonfatal lifecycle diagnostics. */
export function bootErrorReport(url: string, method: string, body: string | null): unknown;
/** Only nonfatal boot-after-hide/nav-navigate diagnostics following observed grid navigation are acknowledged. */
export function bootLifecycleDiagnostic(report: unknown, observedGridNavigation: boolean): boolean;
/** Read the installed catalogue in the actual built title document. */
export function bootCatalogue(): { slug: string; status: string; legacy: boolean }[];
/** Required public and Developer page-ready cases, excluding hidden levels and frozen copies. */
export function bootCases(catalogue: readonly { slug: string; status: string; legacy: boolean }[], group?: 'all' | 'public' | 'developer'): readonly (readonly ['standalone' | 'grid', string, boolean])[];
