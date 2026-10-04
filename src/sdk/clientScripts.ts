import * as v from 'valibot';
import { ClientScriptsSchema as schema, parseClientScripts as parse, type ShardClientScripts as Data } from '@wildshard/game/shardfile/clientScripts';
/** Strict presentation-only module/target declarations, with bounded pose and particle recipes. */
export const ClientScriptsSchema = v.pipe(schema);
/** Data-only author contract for isolated client scripts. */
export type ShardClientScripts = Data;
/** Parse bounded visual commands and copied state-read selections. */
export function parseClientScripts(input: unknown): Data { return parse(input); }
