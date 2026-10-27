/** Bind a completed main push and both successful same-run producers before artifact restoration. */
export function quarantineSource(input: unknown, pages: unknown,
  expected: { run: string; sha: string; repository: string }): { sha: string; run: string };
