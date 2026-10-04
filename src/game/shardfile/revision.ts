import type { Shardfile } from './schema';
import { assertMigrationCompatibility } from './migrations';
import { StateSchema } from './state';
import * as v from 'valibot';

const lineage = v.object({ identity: v.object({ slug: v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.-]*$/u)),
  revision: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(Number.MAX_SAFE_INTEGER)) }), state: StateSchema });
type StateLineage = v.InferOutput<typeof lineage>;
/** Read only strict portable state and identity from a previously visited product. Its legacy geometry and scripts remain unadmitted. */
export function parseStateLineage(input: unknown): StateLineage { return v.parse(lineage, input); }

/** Preserve saved field identities across validated author revisions; declaration ordering is immaterial. */
export function assertStateCompatibility(previous: StateLineage, next: Shardfile): void {
  v.parse(v.literal(previous.identity.slug, 'State revisions must name the same shard'), next.identity.slug);
  if (next.identity.revision < previous.identity.revision) throw new Error('State revisions cannot move backwards');
  assertMigrationCompatibility(previous.state, next.state, next.migrations);
}
