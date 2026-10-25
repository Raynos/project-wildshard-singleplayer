import * as v from 'valibot';
import { assertMigrationCompatibility } from './migrations';
import { StateSchema } from './state';
import type { Shardfile } from './shardSchema';
import { isJsonDataWithFileSchemas } from './json';
import { SHARDFILE_VERSION } from './version';
import { SHARDFILE_ADMISSION_LIMITS as limits } from './admissionLimits';

const identity = v.object({ slug: v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.-]*$/u)),
  revision: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(Number.MAX_SAFE_INTEGER)) });
const lineage = v.object({ identity, state: StateSchema });
type StateLineage = v.InferOutput<typeof lineage>;
/** Read only strict portable state and identity from a previously visited product. Its legacy geometry and scripts remain unadmitted. */
export function parseStateLineage(input: unknown): StateLineage { return v.parse(lineage, input); }

const path = v.pipe(v.string(), v.maxLength(240), v.regex(/^(?:[a-zA-Z0-9_-][a-zA-Z0-9_.-]*\/)*[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/u));
const measured = { path, hash: v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u)),
  bytes: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(Number.MAX_SAFE_INTEGER)) };
const inventory = v.object({ format: v.literal('wildshard.shardfile'), formatVersion: v.literal(2), sdk: v.literal('0.2'),
  version: v.literal(SHARDFILE_VERSION), identity,
  sections: v.pipe(v.array(v.strictObject({ ...measured, name: v.pipe(v.string(), v.regex(/^[a-z][a-zA-Z0-9-]*\/[a-zA-Z][a-zA-Z0-9_-]*$/u)),
    schema: v.pipe(v.string(), v.maxLength(240)) })), v.maxLength(256)),
  schemas: v.pipe(v.array(v.strictObject(measured)), v.maxLength(128)) });
export interface OutputLineageIndex {
  readonly identity: { readonly slug: string; readonly revision: number };
  readonly sections: readonly { readonly path: string; readonly hash: string; readonly bytes: number; readonly name: string; readonly schema: string }[];
  readonly schemas: readonly { readonly path: string; readonly hash: string; readonly bytes: number }[];
}
/** Cached historical inventory proves only bounded, immutable section transport.
 * Obsolete host/asset declarations are never parsed or admitted by this reader. */
export function parseOutputLineageIndex(input: unknown): OutputLineageIndex {
  if (!isJsonDataWithFileSchemas(input)) throw new Error('Shardfile descriptor requires bounded plain JSON');
  const index = v.parse(inventory, input), paths = new Set(['shard.json', 'validation.json']), names = new Set<string>();
  if (index.sections.reduce((total, row) => total + row.bytes, 0) > limits.sourceBytes) throw new Error('Output sections exceed the source byte cap');
  for (const row of [...index.sections, ...index.schemas]) {
    if (row.path.split('/').some(part => part === '.' || part === '..') || paths.has(row.path)) throw new Error('Duplicate or escaping output path');
    paths.add(row.path);
  }
  for (const row of index.sections) {
    if (names.has(row.name) || row.path !== `sections/${row.name}.json`) throw new Error('Duplicate or mismatched section path');
    names.add(row.name);
  }
  if (!index.sections.some(row => row.name === 'state/state' && row.schema === 'wildshard:state/state@1')) throw new Error('Missing historical state section');
  return index;
}

/** Preserve saved field identities across validated author revisions; declaration ordering is immaterial. */
export function assertStateCompatibility(previous: StateLineage, next: Shardfile): void {
  v.parse(v.literal(previous.identity.slug, 'State revisions must name the same shard'), next.identity.slug);
  if (next.identity.revision < previous.identity.revision) throw new Error('State revisions cannot move backwards');
  assertMigrationCompatibility(previous.state, next.state, next.migrations);
}

