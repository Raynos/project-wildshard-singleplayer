// oxlint-disable-next-line import/no-nodejs-modules -- Static compiler checks run in the actual Node process, outside runtime coverage.
import { execFileSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Use the exact test runner's Node and compiler installation.
import { execPath } from 'node:process';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve the committed compiler fixture without a shell.
import { fileURLToPath } from 'node:url';
import type { ApiRow, ApiSurface } from '../../scripts/gen-api.mjs';

function run(kind: string, root: string, files: readonly string[], timeout: number): unknown {
  return JSON.parse(execFileSync(execPath, [fileURLToPath(new URL('../fixtures/authoring-compiler.mjs', import.meta.url)), kind, root, ...files], { encoding: 'utf8', timeout }));
}
function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid compiler result');
  return value as Record<string, unknown>;
}
function rows(value: unknown): Record<string, ApiRow[]> {
  return Object.fromEntries(Object.entries(record(value)).map(([key, list]) => {
    if (!Array.isArray(list)) throw new Error('Invalid compiler inventory');
    return [key, list.map((item: unknown) => {
      const row = record(item);
      if (typeof row['name'] !== 'string' || typeof row['from'] !== 'string' || typeof row['kind'] !== 'string' || typeof row['doc'] !== 'string'
        || (row['gameOnly'] !== undefined && typeof row['gameOnly'] !== 'boolean')) throw new Error('Invalid compiler binding');
      return { name: row['name'], from: row['from'], kind: row['kind'], doc: row['doc'], ...(row['gameOnly'] === undefined ? {} : { gameOnly: row['gameOnly'] }) };
    })];
  }));
}
/** Fresh complete public inventory, including both actual context interfaces. */
export function authoringInventory(root: string): ApiSurface {
  const result = record(run('api', root, [], 10_000));
  return { indexes: rows(result['indexes']), contexts: rows(result['contexts']) };
}
/** Exact semantic example diagnostics with the repository's unchanged strict options. */
export function compileAuthoringExamples(root: string, files: readonly string[] = []): string[] {
  const result = run('examples', root, files, 20_000);
  if (!Array.isArray(result)) throw new Error('Invalid compiler diagnostics');
  return result.map((item: unknown) => {
    if (typeof item !== 'string') throw new Error('Invalid compiler diagnostic');
    return item;
  });
}
