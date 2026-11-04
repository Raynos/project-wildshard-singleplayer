/**
 * How a shard is entered: its shardfile (SHARD-PLATFORM SF65, Jake's G237–G241; G531; QD7 LD5).
 *
 * Every card enters through one ENTER WORLD, in the public build and in Developer. LD5 removed SF65's LEGACY / SHARDFILE
 * pair, its Developer row and the saved per-tab choice: an old saved `legacy` choice is inert.
 *
 *   shardEntries(manifest)              // what the shard declares: { legacy, shardfile }
 *   defaultEntry(entries)               // SHARDFILE when the shard has one, else its own TypeScript
 *   shardEntry(manifest)                // the boot: the shard's one admitted entry
 *
 * What a shard can be entered as is its own data (`ShardManifest.entries`), never a shard name in game code. A shard
 * with no TypeScript plugin (`ShardManifest.load` absent: the template, booted from its built shardfile alone, and the
 * manifest admitted from a shardfile) has no legacy TypeScript: G241's SHARDFILE ONLY.
 */
import type { ShardEntries, ShardEntryMode, ShardManifest } from './manifest';

/** A manifest without `entries`: a shard with no TypeScript plugin is shardfile only (G241), any other is its TypeScript alone. */
export function shardEntries(manifest: Pick<ShardManifest, 'load' | 'entries'>): ShardEntries {
  if (manifest.entries !== undefined) return manifest.entries;
  return manifest.load === undefined ? { legacy: false, shardfile: true } : { legacy: true, shardfile: false };
}

/** G531 (supersedes G326's per-card flip): the shardfile whenever the shard has one; a legacy-only manifest (a frozen copy)
 *  boots as itself. */
export function defaultEntry(entries: ShardEntries): ShardEntryMode { return entries.shardfile ? 'shardfile' : 'legacy'; }

/** The way this page enters the shard: its one admitted entry (LD5: no choice is read). */
export function shardEntry(manifest: Pick<ShardManifest, 'load' | 'entries'>): ShardEntryMode {
  return defaultEntry(shardEntries(manifest));
}
