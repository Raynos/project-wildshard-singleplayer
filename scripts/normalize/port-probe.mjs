/** F7: port the former world global in surviving scripts and current usage docs. */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const LEGACY = ['__', 'world'].join('');
const WORLD = '__wildshard.world';
const DOCS = ['docs/SUBAGENT-BRIEF.md', 'docs/RUNNING.md', 'docs/BENCH.md', 'docs/design/scorecard.md', 'docs/design/LOOK-LOOP.md', 'docs/design/nalati/look-pass.md', 'AGENTS.md', 'README.md'];
async function files(root) {
  const result = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) result.push(...await files(path));
    else if (entry.isFile() && /\.(?:mjs|js|mts|ts|md|py|sh|json)$/.test(path)) result.push(path);
  }
  return result;
}

const paths = [...await files('scripts'), ...DOCS, ...await files('.claude/skills')];
let count = 0;
for (const path of paths) {
  // F2b owns its in-flight probe-native harness; F6c owns the independent move codemod.
  if (path === 'scripts/parity.mjs' || path.startsWith('scripts/parity/') || path.startsWith('scripts/normalize/') || path === 'scripts/types/wildshard-probe.d.ts') continue;
  const original = await readFile(path, 'utf8');
  const pattern = new RegExp(`\\b${LEGACY}\\b`, 'g');
  const code = /\.(?:mjs|js|mts|ts|py|sh)$/.test(path);
  const text = original.replaceAll(pattern, (_match, offset) => {
    if (!code) return WORLD;
    // A wait-for-ready expression may run before installProbe: preserve the old guard.
    const rest = original.slice(offset + LEGACY.length);
    return rest.startsWith('?.') || !rest.startsWith('.') ? '__wildshard?.world' : WORLD;
  });
  if (text === original) continue;
  count++;
  if (!process.argv.includes('--dry-run')) await writeFile(path, text);
  console.log(path);
}
console.log(`${count} files ${process.argv.includes('--dry-run') ? 'would be ported' : 'ported'}`);
