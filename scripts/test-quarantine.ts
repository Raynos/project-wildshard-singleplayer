/// <reference types="node" />
/** G758/G788: every separated suite still executes in CI with an owner.
 * Expiry restores blocking coverage automatically; it never deletes a test. */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as v from 'valibot';

const Entry = v.strictObject({ file: v.string(), owner: v.string(), openedAt: v.string(), expiresAt: v.string(), reason: v.string() });
const Registry = v.strictObject({ version: v.literal(1), entries: v.array(Entry) });
export type QuarantineEntry = v.InferOutput<typeof Entry>;

export function activeQuarantines(input: unknown, now = Date.now()): readonly QuarantineEntry[] {
  if (!Number.isFinite(now)) throw new Error('Invalid quarantine clock');
  const registry = v.parse(Registry, input), seen = new Set<string>();
  for (const row of registry.entries) {
    const start = Date.parse(row.openedAt), end = Date.parse(row.expiresAt);
    if (!/^test\/[a-zA-Z0-9_/-]+\.test\.ts$/u.test(row.file) || row.file.split('/').includes('..') || seen.has(row.file)
      || row.owner.trim() === '' || row.reason.trim() === '' || !Number.isFinite(start) || !Number.isFinite(end)
      || end <= start || end - start > 24 * 60 * 60 * 1000) throw new Error('Invalid test quarantine entry');
    seen.add(row.file);
  }
  return registry.entries.filter(row => now >= Date.parse(row.openedAt) && now < Date.parse(row.expiresAt));
}

/** No cohort means the full local/nightly suite, including quarantined cases. */
export function quarantineCohort(paths: readonly string[], entries: readonly QuarantineEntry[], cohort: string | undefined): string[] {
  if (cohort === undefined) return [...paths];
  const quarantined = new Set(entries.map(row => row.file));
  return paths.filter(file => quarantined.has(file) === (cohort === 'quarantine'));
}

export function readQuarantines(root: string, includeExpired = false): readonly QuarantineEntry[] {
  const input: unknown = JSON.parse(readFileSync(resolve(root, 'scripts/test-quarantine.json'), 'utf8'));
  const active = activeQuarantines(input);
  // The reporting job keeps every listed test, even after expiry. Blocking
  // cohorts restore expired tests too. This avoids losing a test if the clock
  // crosses expiry between the product-free and reporting jobs of one run.
  const entries = includeExpired ? v.parse(Registry, input).entries : active;
  for (const row of entries) {
    if (!existsSync(resolve(root, row.file))) throw new Error(`Missing quarantined test: ${row.file}`);
    console.info(`Quarantine: ${row.file}; owner=${row.owner}; fix by ${row.expiresAt}; ${row.reason}`);
  }
  return entries;
}
