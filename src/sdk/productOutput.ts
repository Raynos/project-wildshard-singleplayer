// oxlint-disable-next-line import/no-nodejs-modules -- Author builds emit immutable product files.
import { mkdirSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The caller supplies its owned output directory.
import { resolve } from 'node:path';
import { parseShardfile, type Shardfile } from '@wildshard/format/shardSchema';
import { MemoryAdmission, validationRevision, validationSourceBytes } from '@wildshard/format/product';
import { preflightDeclaredCosts, validateShardfileAssets } from '@wildshard/format/assetAdmission';
import { encodeCanonicalJson, hashImmutableBytes } from './immutable';
import { performanceReport, performanceReportLines, performanceTargetIssues } from './reportCard';

function memory(policy: 'warn' | 'refuse'): MemoryAdmission | undefined { return policy === 'warn' ? new MemoryAdmission(() => true) : undefined; }

/** Refuse the same target overages as the author CLI; warning policy belongs only to trusted checkout callers. */
export function assertProductTargets(source: Shardfile, policy: 'warn' | 'refuse'): void {
  if (!performanceTargetIssues(source, policy).some(issue => issue.severity === 'refusal')) return;
  const unmeasured = { scripts: { p95Micros: 0, maxMicros: 0, samples: 0 }, fuel: { p95: 0, max: 0, samples: 0 } };
  throw new Error(performanceReportLines(performanceReport(source, unmeasured, policy)).join('\n'));
}

/** Admit declared costs and actual immutable bytes through the browser's defining contracts, without a config loader. */
export function admitProduct(input: unknown, assets: ReadonlyMap<string, Uint8Array>, policy: 'warn' | 'refuse' = 'refuse'): Shardfile {
  const source = parseShardfile(input);
  preflightDeclaredCosts(source, memory(policy));
  assertProductTargets(source, policy);
  return validateShardfileAssets(source, assets, hashImmutableBytes, memory(policy));
}

/** Emit a complete product: canonical shard.json, every charged local/commons asset and the informational validation receipt.
 * Config builds and author-only cold producers share this writer. No client, runtime, cache or retained product is read.
 * Default admission refuses overages; a trusted caller alone may request the existing warning policy. */
export function writeProduct(input: unknown, assets: ReadonlyMap<string, Uint8Array>, destination: string, policy: 'warn' | 'refuse' = 'refuse'): Shardfile {
  const shard = admitProduct(input, assets, policy);
  shard.files.sort((a, b) => a.hash.localeCompare(b.hash));
  shard.tiles.sort((a, b) => a.lod - b.lod || a.x - b.x || a.z - b.z);
  mkdirSync(destination, { recursive: true });
  const emitted = new Set<string>();
  for (const [ref, bytes] of assets) {
    const hash = ref.replace('commons:', '');
    if (emitted.has(hash)) continue;
    writeFileSync(resolve(destination, hash), bytes); emitted.add(hash);
  }
  writeFileSync(resolve(destination, 'shard.json'), encodeCanonicalJson(shard));
  writeFileSync(resolve(destination, 'validation.json'), encodeCanonicalJson({ revision: validationRevision(), sourceHash: hashImmutableBytes(validationSourceBytes(shard)), worst: preflightDeclaredCosts(shard, memory(policy)).worst }));
  return shard;
}
