import * as v from 'valibot';
import { ACCENTS as palette, ACCENT_IDS as ids, AccentSchema as schema, parseAccent as parse, type AccentId as Id } from '@wildshard/game/shardfile/accent';

/** The platform's 20 shard accents, keyed by the required shardfile palette ID. */
export const ACCENTS = { ...palette };
/** The admitted palette IDs in palette order; the road's cyan is excluded. */
export const ACCENT_IDS = [...ids];
/** A shard accent from the fixed platform palette. */
export type AccentId = Id;
/** Strict required accent grammar; reserved road cyan and raw colours are refused. */
export const AccentSchema = v.pipe(schema);
/** Validate author metadata and return a typed palette ID. */
export function parseAccent(input: unknown): Id { return parse(input); }
