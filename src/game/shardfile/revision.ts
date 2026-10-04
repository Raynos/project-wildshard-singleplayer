import type { Shardfile } from './schema';
import { assertMigrationCompatibility, type DeclaredMigrations } from './migrations';
import * as v from 'valibot';

/** Preserve saved field identities across validated author revisions; declaration ordering is immaterial. */
export function assertStateCompatibility(previous: Shardfile, next: Shardfile & { migrations?: DeclaredMigrations }): void {
  v.parse(v.literal(previous.identity.slug, 'State revisions must name the same shard'), next.identity.slug);
  assertMigrationCompatibility(previous.state, next.state, next.migrations);
}
