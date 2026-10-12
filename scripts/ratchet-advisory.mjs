import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hardRules } from './guard-counts.mjs';
import { approvedIncreases } from './regenerate-committed.mjs';

/** Classify advisory counts only; the pusher still verifies receipts and all gates.
 * Unknown failures and hard rules cannot be classified as approved debt.
 * @param {string} output
 * @param {import('./regenerate-committed.mjs').GeneratedApproval} receipt
 * @param {Set<string>} hard
 * @returns {boolean}
 */
export function ratchetApproved(output, receipt, hard) {
  if (receipt.approver !== 'wildshard-new') return false;
  const parts = output.trim().split('Ratchet rose:\n');
  if (parts.length !== 2) return false;
  for (const warning of parts[0].trim().split('\n').filter(Boolean)) {
    const match = /^src\/[^:]+: wildshard\/[a-z-]+ was (\d+), now (\d+) \(central regeneration will lower the debt\)$/u.exec(warning);
    if (!match || Number(match[2]) >= Number(match[1])) return false;
  }
  /** @type {import('./generated-policy.mjs').GeneratedIncrease[]} */
  const rows = [];
  for (const line of parts[1].split('\n')) {
    const match = /^(src\/[^:]+): (wildshard\/[a-z-]+) was (\d+), now (\d+)$/u.exec(line);
    if (!match) return false;
    const [, file, key, previous, current] = match;
    const before = Number(previous), after = Number(current);
    if (hard.has(key) || !Number.isSafeInteger(before) || !Number.isSafeInteger(after) || after <= before) return false;
    rows.push({ kind: 'debt', file, key, before, after });
  }
  return rows.length > 0 && approvedIncreases(receipt, rows).length === rows.length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [config, receipt] = process.argv.slice(2);
    if (!config || !receipt || process.argv.length !== 4) throw new Error('Usage: ratchet-advisory.mjs <immutable-lint-config> <approval>');
    process.exitCode = ratchetApproved(readFileSync(0, 'utf8'), JSON.parse(readFileSync(receipt, 'utf8')), hardRules(config)) ? 0 : 1;
  } catch (error) {
    console.error(`Ratchet advisory receipt unavailable: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
