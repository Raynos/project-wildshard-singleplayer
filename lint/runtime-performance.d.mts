export interface RuntimePerformanceIssue { kind: string; start: number; end: number; line: number; site: string; message: string }
export interface RuntimePerformanceDebt { count: number; row: string }
export function runtimePerformanceSites(source: string, filename?: string): RuntimePerformanceIssue[];
export function runtimePerformanceViolations(source: string, filename: string, baseline?: Readonly<Record<string, RuntimePerformanceDebt>>): RuntimePerformanceIssue[];
