export function layer(file: string): string;
export function resolveImport(file: string, specifier: string, files: ReadonlySet<string>): string | null;
export function rewriteImport(file: string, destination: string, specifier: string, files: ReadonlySet<string>, moves: ReadonlyMap<string, string>): string;
export function rewriteImports(file: string, destination: string, text: string, files: ReadonlySet<string>, moves: ReadonlyMap<string, string>): string;
export function rewritePaths(text: string, moves: ReadonlyMap<string, string>): string;
export interface GlobRow { file: string; row: string; from: string[]; to: string[] | string }
export function rewriteGlobs(file: string, text: string, globs: GlobRow[], row: string): string;
export interface Collision { from: string; to: string; kind: string; other: string }
export function collisions(moves: ReadonlyMap<string, string>, files: ReadonlySet<string>): Collision[];
export function applyEdits(text: string, edits: { start: number; end: number; text: string }[]): string;
