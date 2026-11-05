import { validateDefinedJson } from '../../src/sharddev/sections';
import { encodeCanonicalJson } from '../../src/sdk/immutable';

/** Test-only serialized value oracle; no shipping section or schema registry. */
export function validateFixtureJsonValue(schema: Uint8Array, value: unknown): unknown {
  return validateDefinedJson(schema, new TextEncoder().encode(encodeCanonicalJson(value)));
}
