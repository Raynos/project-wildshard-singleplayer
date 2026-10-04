// SF1b: immutable predecessor lists, never the candidate's own allowance, set the limit.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PLATFORM_LISTS = ['lint/row-functions.json', 'lint/edge-exemptions.json', 'lint/shard-platform.json'];

/** Explicit file inputs work in an index export and in a post-commit export with no .git. */
export function comparePlatformList(list, baselineFile, candidateFile) {
  const before = JSON.parse(readFileSync(baselineFile, 'utf8'));
  const after = JSON.parse(readFileSync(candidateFile, 'utf8'));
  const failures = [];
  if (list === 'lint/row-functions.json') {
    for (const field of after.fields) if (!before.fields.includes(field)) failures.push(`${list}: new function allowance ${field}`);
  } else if (list === 'lint/edge-exemptions.json') {
    for (const slug of Object.keys(after.levels)) if (!Object.hasOwn(before.levels, slug)) failures.push(`${list}: new edge exemption ${slug}`);
  } else if (list === 'lint/shard-platform.json') {
    for (const [slug, lines] of Object.entries(before.baseline)) {
      if (after.baseline[slug] !== lines) failures.push(`${list}: ${slug} baseline must stay ${lines}`);
    }
    for (const [slug, lines] of Object.entries(after.baseline)) {
      if (!Object.hasOwn(before.baseline, slug) && slug !== 'thin-ice') failures.push(`${list}: unknown shard ${slug}`);
      if (!Number.isSafeInteger(lines) || lines <= 0) failures.push(`${list}: invalid baseline for ${slug}`);
      if (slug === 'thin-ice' && !Object.hasOwn(after.enforced, slug)) failures.push(`${list}: thin-ice needs its 20 % ceiling from its first commit`);
    }
    for (const [slug, ceiling] of Object.entries(before.enforced)) {
      if (!Object.hasOwn(after.enforced, slug) || after.enforced[slug] > ceiling) failures.push(`${list}: ${slug} ceiling rose or was removed (was ${ceiling})`);
    }
    for (const [slug, ceiling] of Object.entries(after.enforced)) {
      if (!Object.hasOwn(after.baseline, slug)) failures.push(`${list}: unknown enforced shard ${slug}`);
      if (!Number.isSafeInteger(ceiling) || ceiling < 0 || ceiling > Math.floor(after.baseline[slug] * 0.2)) failures.push(`${list}: ${slug} ceiling exceeds 20 % of its baseline`);
    }
  } else throw new Error(`Unknown platform list ${list}`);
  return failures;
}

export function checkPlatformRatchets(baselineRoot, candidateRoot) {
  return PLATFORM_LISTS.flatMap((list) => comparePlatformList(list, resolve(baselineRoot, list), resolve(candidateRoot, list)));
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [baseline, candidate] = process.argv.slice(2);
  if (!baseline || !candidate) throw new Error('Usage: check-platform-ratchets.mjs <baseline-root> <candidate-root>');
  const failures = checkPlatformRatchets(baseline, candidate);
  for (const failure of failures) console.error(failure);
  process.exitCode = failures.length > 0 ? 1 : 0;
}
