import * as v from 'valibot';
import { MigrationsSchema as schema, parseMigrations as parse, type DeclaredMigrations as Data } from '@wildshard/game/shardfile/migrations';
/** Sequential declarative state-version edits; custom migration hooks remain reserved and null. */
export const MigrationsSchema = v.pipe(schema);
/** Portable author migration declarations addressed by stable field IDs. */
export type DeclaredMigrations = Data;
/** Validate bounded default, rename, drop and value-map operations without executing author code. */
export function parseMigrations(input: unknown): Data { return parse(input); }
