// oxlint-disable-next-line import/no-nodejs-modules -- Own miniature validator trees exercise the build's real revision function.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Temporary fixture lifetime.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve fixture paths.
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { shardfileValidationRevision } from '../scripts/shardfile-validation-revision.mjs';

it('invalidates exact verdicts on a defining parser or pinned dependency change, but ignores generated inventory churn', () => {
  const root = mkdtempSync(join(tmpdir(), 'validator-revision-'));
  try {
    for (const folder of ['src/engine', 'src/game']) mkdirSync(join(root, folder), { recursive: true });
    writeFileSync(join(root, 'package.json'), '{}'); writeFileSync(join(root, 'pnpm-lock.yaml'), 'lock: one');
    writeFileSync(join(root, 'src/engine/parser.ts'), 'export const parser = 1;');
    const first = shardfileValidationRevision(root); expect(shardfileValidationRevision(root)).toBe(first);
    writeFileSync(join(root, 'src/game/inventory.generated.ts'), 'export const count = 1;');
    expect(shardfileValidationRevision(root)).toBe(first);
    writeFileSync(join(root, 'pnpm-lock.yaml'), 'lock: two');
    const dependency = shardfileValidationRevision(root); expect(dependency).not.toBe(first);
    writeFileSync(join(root, 'src/engine/parser.ts'), 'export const parser = 2;');
    expect(shardfileValidationRevision(root)).not.toBe(dependency);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
