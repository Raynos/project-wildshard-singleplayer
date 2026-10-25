export interface RelatedSelection {
  files: string[];
  direct: string[];
  nearest: string[];
  candidates: number;
  omitted: number;
}
export function selectRelatedSuites(sources: ReadonlyMap<string, string>, changed: readonly string[], paths?: readonly string[], limit?: number, imports?: ReadonlyMap<string, readonly string[]>): RelatedSelection;
