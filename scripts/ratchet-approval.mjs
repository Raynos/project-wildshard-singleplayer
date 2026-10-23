// Policy increases require one exact coordinator approval per increased row.
/** @param {Record<string, Record<string, number>>} before
 * @param {Record<string, Record<string, number>>} after @param {string} message */
export function ratchetApprovalFailures(before, after, message) {
  // The repository requires a blank line before the final attribution.
  const content = message.trimEnd().replace(/\n\nAssisted-by:[^\n]+$/u, '');
  const unfolded = content.replaceAll(/\n[ \t]+/gu, ' ');
  const footer = unfolded.split(/\n\s*\n/u).at(-1) ?? '';
  const approvals = unfolded.split('\n').filter(line => line.startsWith('Ratchet-Approved:'));
  const expected = new Set();
  for (const [rule, rows] of Object.entries(after)) {
    if (!rule.startsWith('wildshard/')) continue;
    for (const [file, count] of Object.entries(rows)) {
      const delta = count - (before[rule]?.[file] ?? 0);
      if (delta > 0) expected.add(`Ratchet-Approved: wildshard-new ${rule} ${file} +${delta}`);
    }
  }
  const failures = [];
  const seen = new Set();
  for (const line of approvals) {
    if (!footer.split('\n').includes(line) || !expected.has(line) || seen.has(line)) failures.push(`Invalid or unmatched ratchet approval: ${line}`);
    seen.add(line);
  }
  for (const line of expected) if (!seen.has(line)) failures.push(`Missing ratchet approval: ${line}`);
  return failures;
}
