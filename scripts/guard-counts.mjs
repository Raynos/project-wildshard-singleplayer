// E362 AG16/17: shared full-tree and staged-path ratchet policy.
import { readFileSync } from 'node:fs';
import { parseSync } from 'vite';

/** Read JSONC as data, never as executable configuration. */
export function readLintConfig(file) {
  const parsed = parseSync('config.js', `const config = ${readFileSync(file, 'utf8')};`);
  if (parsed.errors.length > 0) throw new Error(`Cannot parse lint config: ${file}`);
  const read = (node) => {
    if (node?.type === 'Literal') return node.value;
    if (node?.type === 'ArrayExpression') return node.elements.map(read);
    if (node?.type === 'ObjectExpression') return Object.fromEntries(node.properties.map((p) => [p.key?.value ?? p.key?.name, read(p.value)]));
    throw new Error(`Lint config must contain only JSON data: ${file}`);
  };
  return read(parsed.program.body[0]?.declarations?.[0]?.init);
}

/** Hard custom rules in the src override. */
export function hardRules(file) {
  const config = readLintConfig(file);
  const result = new Set();
  for (const override of config.overrides ?? []) {
    if (!override.files?.includes('src/**')) continue;
    for (const [name, severity] of Object.entries(override.rules ?? {})) {
      if (name.startsWith('wildshard/') && (severity === 'error' || (Array.isArray(severity) && severity[0] === 'error'))) result.add(name);
    }
  }
  return result;
}

/** Only the supplied paths participate in a staged check; omitted paths mean the whole tree. */
export function compareCounts(baseline, current, hard, paths, update = false, defer = false) {
  const failures = [], warnings = [];
  const selected = paths ? new Set(paths) : null;
  for (const key of new Set([...Object.keys(baseline), ...Object.keys(current)])) {
    if (!key.startsWith('wildshard/')) continue;
    const previous = baseline[key] ?? {}, now = current[key] ?? {};
    for (const file of new Set([...Object.keys(previous), ...Object.keys(now)])) {
      if (selected && !selected.has(file)) continue;
      const was = previous[file] ?? 0, count = now[file] ?? 0;
      if (count > was) (defer && !hard.has(key) ? warnings : failures).push(`${file}: ${key} was ${was}, now ${count}${defer && !hard.has(key) ? ' (requires coordinator approval in the pusher regeneration commit)' : ''}`);
      else if (was > 0 && count === 0 && !update && !defer) failures.push(`${file}: ${key} is clean; run pnpm lint:ratchet --update in this commit`);
      else if (count < was) warnings.push(`${file}: ${key} was ${was}, now ${count} (partial slack; lower the ratchet)`);
    }
    if (!selected && Object.hasOwn(baseline, key) && Object.values(now).every((n) => n === 0) && !hard.has(key)) {
      failures.push(`${key} reached zero: move it to .oxlintrc.json's src override before removing its ratchet section`);
    }
  }
  return { failures, warnings };
}
