export interface MoveRow { from: string; f6: string | null; final: string | null; row: string }
export interface MoveMap {
  files: MoveRow[];
  tests: MoveRow[];
  globs: { file: string; row: string; from: string[]; to: string[] | string }[];
  manual: { file: string; lines: number[]; edit: string }[];
}
export interface DryReport {
  ok: boolean;
  gitMoves: { from: string; to: string }[];
  rewrites: { from: string; to: string; steps: Record<string, number> }[];
  missing: { from: string; to: string }[];
  unresolvedImports: { file: string; line: number; specifier: string }[];
  edges: Record<string, number>;
  collisions: { from: string; to: string; kind: string; other: string }[];
}
export function selectedMoves(map: MoveMap, row: string, files: ReadonlySet<string>): { moves: Map<string, string>; missing: { from: string; to: string }[] };
export function planMove(map: MoveMap, row?: string, root?: string, mapPath?: string): { report: DryReport; contents: Map<string, string> };
