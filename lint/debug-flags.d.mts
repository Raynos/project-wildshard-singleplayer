import type { parseSync } from 'vite';

export interface DebugFlag { id: string; ask: string; reviewBy: string; file?: string; purpose?: 'developer' }
export function debugFlags(root: string): DebugFlag[];
export function declaredDebugRows(program: ReturnType<typeof parseSync>['program']): unknown[];
export function askExists(root: string, id: string): boolean;
export function validateFlags(rows: readonly DebugFlag[], options: { today: string; max: number; raisedBy?: readonly string[]; askExists: (id: string) => boolean }): { errors: string[]; overdue: string[] };
