import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Docs are deliberately excluded from Vercel; publish their IDs with the build inputs. */
export function genAskIds(root = process.cwd()) {
  const legacy = resolve(root, 'project/archive/2026-09-22-asks-table.md');
  if (!existsSync(legacy)) return;
  const ids = new Set([...readFileSync(legacy, 'utf8').matchAll(/^\| (E\d+) \|/gmu)].map((match) => match[1]));
  for (const file of readdirSync(resolve(root, 'docs/tasks/asks'))) if (/^E\d+\.md$/u.test(file)) ids.add(file.slice(0, -3));
  writeFileSync(resolve(root, 'lint/ask-ids.json'), `${JSON.stringify([...ids].sort(), null, 2)}\n`);
}
