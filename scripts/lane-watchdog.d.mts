/** Latest lane-specific report resolving to a unique commit in newest-first git history. */
export function latestLaneCommit(history: string, text: string, name: string,
  pane: string, ledger: ReadonlyMap<string, string>, previous?: string):
  { sha: string; at: number } | undefined;
