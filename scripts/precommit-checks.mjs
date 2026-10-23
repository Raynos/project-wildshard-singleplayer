// Cheap staged-source guards; the caller owns the common wall deadline.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { compareCounts, hardRules, readLintConfig } from './guard-counts.mjs';
import { untypedLintConfig } from './push-lint-config.mjs';
import { legacyInventory, registeredLegacyFile } from './legacy-shards.mjs';

/** Preserve ordinary rules; only the two approved whole-program rules defer.
 * @param {unknown} raw */
export function fastCommitLintConfig(raw) {
  const config = untypedLintConfig(raw);
  const serialized = JSON.stringify(config);
  const expensive = Object.fromEntries(['wildshard/no-authored-html', 'wildshard/no-shard-host-callback']
    .filter(rule => serialized.includes(`"${rule}"`)).map(rule => [rule, 'off']));
  const overrides = Reflect.get(config, 'overrides');
  Object.assign(config, { rules: { ...Reflect.get(config, 'rules'), ...expensive },
    overrides: [...(Array.isArray(overrides) ? overrides : []), { files: ['**/*'], rules: expensive }] });
  return config;
}

/** @param {string[]} files @param {string} executable */
export function fastLint(files, executable) {
  const config = fastCommitLintConfig({ options: { typeAware: false }, ...readLintConfig('.oxlintrc.json') });
  writeFileSync('.commit-fast-lint.json', JSON.stringify(config));
  const result = spawnSync(executable, ['--threads=2', '-c', '.commit-fast-lint.json', ...files], { encoding: 'utf8', stdio: 'inherit' });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) throw new Error('Fast staged lint refused');
}

/** @param {string[]} files @param {string} executable */
export async function stagedRatchet(files, executable) {
  const { comparePlatformList } = await import('./check-platform-ratchets.mjs');
  const root = process.cwd(), baseline = JSON.parse(readFileSync('.commit-baseline-ratchet.json', 'utf8'));
  /** @type {Record<string, Record<string, number>>} */
  const current = {};
  const hard = hardRules('.oxlintrc.json'), frozen = legacyInventory(root);
  const selected = files.filter(file => file.startsWith('src/'));
  if (selected.length > 0) {
    const counted = JSON.parse(readFileSync('.oxlintrc.ratchet.json', 'utf8'));
    counted.rules['wildshard/no-authored-html'] = 'off'; counted.rules['wildshard/no-shard-host-callback'] = 'off';
    writeFileSync('.commit-ratchet-lint.json', JSON.stringify(counted));
    const result = spawnSync(executable, ['--threads=2', '-c', '.commit-ratchet-lint.json', '-f', 'json', ...selected], {
      encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, WILDSHARD_RATCHET_FILE: resolve('.commit-baseline-ratchet.json'), WS_HTML_LINT_FILES: JSON.stringify(selected) },
    });
    if (result.error !== undefined) throw result.error;
    if (result.status !== 0 && result.status !== 1) throw new Error(`Ratchet lint failed: ${result.stderr}`);
    const output = JSON.parse(result.stdout);
    if (!Array.isArray(output.diagnostics) || result.status === 1 && output.diagnostics.length === 0) throw new Error('Ratchet lint returned no diagnostics');
    for (const diagnostic of output.diagnostics) {
      const match = /^wildshard\(([^)]+)\)$/u.exec(diagnostic.code ?? '');
      if (match === null || typeof diagnostic.filename !== 'string') throw new Error(`Unexpected ratchet diagnostic: ${JSON.stringify(diagnostic)}`);
      const key = `wildshard/${match[1]}`, file = relative(root, resolve(diagnostic.filename));
      if (!hard.has(key) && registeredLegacyFile(frozen, file)) continue;
      const rows = Object.hasOwn(current, key) ? current[key] : {};
      rows[file] = (Object.hasOwn(rows, file) ? rows[file] : 0) + 1; current[key] = rows;
    }
  }
  const failures = compareCounts(baseline, current, hard, files, false, true, true).failures;
  const policy = JSON.parse(readFileSync('lint/ratchet.json', 'utf8'));
  failures.push(...comparePlatformList('lint/ratchet.json', resolve('.commit-baseline-ratchet.json'), resolve('lint/ratchet.json')));
  // An edited allowance must not hide a new detection in this same commit.
  for (const [rule, rows] of Object.entries(policy)) {
    if (!rule.startsWith('wildshard/')) continue;
    for (const [file, count] of Object.entries(rows)) if (count > (baseline[rule]?.[file] ?? 0)) failures.push(`${file}: ${rule} staged allowance rose`);
  }
  if (failures.length > 0) throw new Error(failures.join('\n'));
}

if (import.meta.main) {
  const mode = process.argv[2], files = JSON.parse(readFileSync('.commit-files.json', 'utf8'));
  try {
    if (mode === 'fast') fastLint(files, process.argv[3] ?? 'oxlint');
    else if (mode === 'ratchet') await stagedRatchet(files, process.argv[3] ?? 'oxlint');
    else if (mode === 'deleted') {
      const { deletedReferences } = await import('./push-checks.mjs');
      const errors = deletedReferences(process.cwd(), JSON.parse(readFileSync('.commit-deleted.json', 'utf8')));
      if (errors.length > 0) throw new Error(errors.join('\n'));
    } else if (mode === 'closed') {
      if (!existsSync('lint/ratchet.json')) throw new Error('Missing staged closed-component policy');
      const policy = JSON.parse(readFileSync('lint/ratchet.json', 'utf8'));
      const { closedComponentSources } = await import('./check-closed-components.mjs');
      const errors = closedComponentSources(process.cwd(), policy.closedComponents, policy.closingComponents);
      if (errors.length > 0) throw new Error(errors.join('\n'));
    } else throw new Error('Unknown pre-commit guard');
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
