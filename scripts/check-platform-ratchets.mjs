// SF1b: immutable predecessor lists, never the candidate's own allowance, set the limit.
import { compareCoupling, compareWeaponTransfers, WEAPON_TRANSFER_BOOTSTRAP, WEAPON_TRANSFER_LIST } from './shard-coupling.mjs';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { compareLegacyInventory, LEGACY_INVENTORY } from './legacy-shards.mjs';

export const PLATFORM_LISTS = ['lint/row-functions.json', 'lint/edge-exemptions.json', 'lint/shard-platform.json', 'lint/sim-closure.json', 'lint/sim-schema-leaves.json', 'lint/shard-coupling.json', WEAPON_TRANSFER_LIST, 'lint/runtime-performance.json', LEGACY_INVENTORY];

/** Explicit file inputs work in an index export and in a post-commit export with no .git. */
export function comparePlatformList(list, baselineFile, candidateFile) {
  if (list === LEGACY_INVENTORY) {
    if (!existsSync(candidateFile)) return existsSync(baselineFile) ? [`${list}: frozen policy removed; retire its rows instead`] : [];
    const before = existsSync(baselineFile) ? JSON.parse(readFileSync(baselineFile, 'utf8')) : { version: 1, sealed: false, shards: {} };
    return compareLegacyInventory(before, JSON.parse(readFileSync(candidateFile, 'utf8')), [], 'Legacy-Crash-Fix: hash updates are checked by commit-msg');
  }

  if (list === WEAPON_TRANSFER_LIST) {
    if (!existsSync(candidateFile)) return existsSync(baselineFile) ? [`${list}: transfer policy was removed; retire its entries instead`] : [];
    const before = existsSync(baselineFile) ? JSON.parse(readFileSync(baselineFile, 'utf8')).transfers : WEAPON_TRANSFER_BOOTSTRAP;
    return compareWeaponTransfers(before, JSON.parse(readFileSync(candidateFile, 'utf8')).transfers);
  }
  if (list === 'lint/runtime-performance.json') {
    if (!existsSync(candidateFile)) return [`${list}: reviewed policy was removed; retire its sites instead`];
    const after = JSON.parse(readFileSync(candidateFile, 'utf8'));
    if (!existsSync(baselineFile)) {
      // E435 / SF62: coordinator-reviewed bootstrap, 441 exact sites / 626 violations; never a new-site escape.
      const digest = createHash('sha256').update(JSON.stringify(after.sites)).digest('hex');
      return digest === '77308f0fdfbbb38ae8d19cd97d5d9940a396fd1f16edf1a009ef878f5aace0de' && after.baselineAt === 'fadcee06196f345f706aa9f7e01a3bb027968a20' ? [] : [`${list}: bootstrap differs from the reviewed inventory`];
    }
    const before = JSON.parse(readFileSync(baselineFile, 'utf8')), failures = [];
    if (after.baselineAt !== before.baselineAt || after.about !== before.about || Object.keys(after).sort().join(',') !== Object.keys(before).sort().join(',')) failures.push(`${list}: review metadata changed`);
    for (const [site, item] of Object.entries(after.sites)) {
      const previous = before.sites[site];
      if (!previous) failures.push(`${list}: new runtime site ${site}`);
      else {
        if (item.count > previous.count) failures.push(`${list}: ${site} count rose`);
        if (item.row !== previous.row) failures.push(`${list}: ${site} retirement owner changed`);
      }
      if (!Number.isSafeInteger(item.count) || item.count <= 0 || Object.keys(item).sort().join(',') !== 'count,row') failures.push(`${list}: invalid site ${site}`);
    }
    return failures;
  }
  const before = JSON.parse(readFileSync(baselineFile, 'utf8'));
  const after = JSON.parse(readFileSync(candidateFile, 'utf8'));
  const failures = [];
  if (list === 'lint/row-functions.json') {
    for (const field of after.fields) if (!before.fields.includes(field)) failures.push(`${list}: new function allowance ${field}`);
  } else if (list === 'lint/edge-exemptions.json') {
    for (const slug of Object.keys(after.levels)) if (!Object.hasOwn(before.levels, slug)) failures.push(`${list}: new edge exemption ${slug}`);
  } else if (list === 'lint/shard-platform.json') {
    // G291 changes the measured conversion ratio, not these historical no-copy policies.
    // G291/G294 is report-only until reviewed; never rewrite or relax the predecessor baselines.
    for (const [slug, lines] of Object.entries(before.baseline)) {
      if (after.baseline[slug] !== lines) failures.push(`${list}: ${slug} baseline must stay ${lines}`);
    }
    for (const [slug, lines] of Object.entries(after.baseline)) {
      if (!Object.hasOwn(before.baseline, slug) && !['thin-ice', 'blender-template', 'pastel-plain', 'ink-cel-valley'].includes(slug)) failures.push(`${list}: unknown shard ${slug}`);
      if (!Number.isSafeInteger(lines) || lines <= 0) failures.push(`${list}: invalid baseline for ${slug}`);
      if (['blender-template', 'pastel-plain', 'ink-cel-valley'].includes(slug) && after.enforced[slug] !== 0) failures.push(`${list}: ${slug} needs its zero runtime ceiling from its first commit`);
      if (slug === 'thin-ice' && !Object.hasOwn(after.enforced, slug)) failures.push(`${list}: thin-ice needs its 20 % ceiling from its first commit`);
    }
    for (const [slug, ceiling] of Object.entries(before.enforced)) {
      if (!Object.hasOwn(after.enforced, slug) || after.enforced[slug] > ceiling) failures.push(`${list}: ${slug} ceiling rose or was removed (was ${ceiling})`);
    }
    for (const [slug, ceiling] of Object.entries(after.enforced)) {
      if (!Object.hasOwn(after.baseline, slug)) failures.push(`${list}: unknown enforced shard ${slug}`);
      if (!Number.isSafeInteger(ceiling) || ceiling < 0 || ceiling > Math.floor(after.baseline[slug] * 0.2)) failures.push(`${list}: ${slug} ceiling exceeds 20 % of its baseline`);
    }
  } else if (list === 'lint/shard-coupling.json') {
    failures.push(...compareCoupling(before.shards, after.shards).map((failure) => `${list}: ${failure}`));
  } else if (list === 'lint/sim-schema-leaves.json') {
    for (const [path, item] of Object.entries(after)) {
      const previous = before[path];
      if (!previous) failures.push(`${list}: new schema leaf ${path}`);
      else if (Object.keys(item).length !== Object.keys(previous).length || Object.entries(item).some(([key, value]) => value !== previous[key])) failures.push(`${list}: ${path} review or removal owner changed`);
    }
  } else if (list === 'lint/sim-closure.json') {
    for (const [site, item] of Object.entries(after.violations)) {
      const previous = before.violations[site];
      if (!previous) failures.push(`${list}: new sim site ${site}`);
      else {
        if (item.count > previous.count) failures.push(`${list}: ${site} count rose ${previous.count} → ${item.count}`);
        if (item.row !== previous.row) failures.push(`${list}: ${site} owner changed ${previous.row} → ${item.row}`);
      }
      if (!Number.isSafeInteger(item.count) || item.count <= 0) failures.push(`${list}: invalid count for ${site}`);
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
