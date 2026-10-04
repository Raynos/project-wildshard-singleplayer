import type { Shardfile } from './schema';
import * as v from 'valibot';

/** Preserve saved field identities across validated author revisions; declaration ordering is immaterial. */
export function assertStateCompatibility(previous: Shardfile, next: Shardfile): void {
  v.parse(v.literal(previous.identity.slug, 'State revisions must name the same shard'), next.identity.slug);
  const oldIds = new Map([...previous.state.shared.map((field) => [field.id, `shared/${field.name}`] as const), ...previous.state.player.map((field) => [field.id, `player/${field.name}`] as const)]);
  for (const scope of ['shared', 'player'] as const) {
    const fields = new Map(next.state[scope].map((field) => [field.name, field]));
    for (const field of previous.state[scope]) {
      const replacement = fields.get(field.name);
      if (replacement === undefined || replacement.id !== field.id || replacement.type !== field.type) throw new Error(`State field ${scope}/${field.name} must preserve its id and type`);
    }
    for (const field of next.state[scope]) {
      const owner = oldIds.get(field.id);
      if (owner !== undefined && owner !== `${scope}/${field.name}`) throw new Error(`State id ${field.id} cannot be reused`);
    }
  }
}
