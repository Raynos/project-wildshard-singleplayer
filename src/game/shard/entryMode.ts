/**
 * LEGACY or SHARDFILE: which way SHARD SELECT enters a shard (SHARD-PLATFORM SF65, Jake's G237–G241).
 *
 * With Settings ▸ Developer on, every shard card on SHARD SELECT has two entry buttons: LEGACY (the original TypeScript
 * shard) and SHARDFILE (its current port state: the shardfile plus whatever TypeScript is not ported yet). The public build
 * keeps one ENTER WORLD and always boots the shard's `public` entry. The choice is never a URL switch: the deck writes it
 * into a session-scoped save slot before the fresh page loads, and the shard's plugin asks for it while it builds its world.
 *
 *   shardEntries(manifest)             // what the shard declares: { legacy, shardfile, public }
 *   chooseShardEntry(slug, 'shardfile') // SHARD SELECT, before it travels
 *   shardEntry(manifest)               // the boot: Developer on → this tab's choice (when the shard has it), else public
 *
 * What a shard can be entered as is its own data (`ShardManifest.entries`), never a shard name in game code. A shard
 * with no TypeScript plugin (`ShardManifest.load` absent: the template, booted from its built shardfile alone, and the
 * manifest admitted from a shardfile) has no legacy TypeScript: G241's SHARDFILE ONLY · NO LEGACY.
 */
import * as v from 'valibot';
import { app } from '@wildshard/engine/app/runtime';
import { isDev } from '@wildshard/engine/core/devMode';
import type { ShardEntries, ShardEntryMode, ShardManifest } from './manifest';

const MODES = ['legacy', 'shardfile'] as const satisfies readonly ShardEntryMode[];
const schema: v.GenericSchema<unknown, Readonly<Record<string, ShardEntryMode>>> = v.record(v.string(), v.picklist(MODES));

/** A manifest without `entries`: a shard with no TypeScript plugin is shardfile only (G241), any other is its TypeScript alone. */
export function shardEntries(manifest: Pick<ShardManifest, 'load' | 'entries'>): ShardEntries {
  if (manifest.entries !== undefined) return manifest.entries;
  return manifest.load === undefined ? { legacy: false, shardfile: true, public: 'shardfile' } : { legacy: true, shardfile: false, public: 'legacy' };
}

/** Whether the shard can be entered this way at all (a disabled button otherwise: NOT YET / SHARDFILE ONLY). */
export function hasEntry(entries: ShardEntries, mode: ShardEntryMode): boolean { return mode === 'legacy' ? entries.legacy : entries.shardfile; }

type Store = typeof app.saves;
/** This tab's choices, one per shard. Session scope: a reload keeps the mode you entered with; a fresh launch starts on
 *  each shard's public entry again. */
export interface ShardEntryChoices {
  choose: (slug: string, mode: ShardEntryMode) => void;
  read: (slug: string) => ShardEntryMode | null;
}
/** The injectable store lets a Node test run the real round trip. */
export function shardEntryChoices(store: Store): ShardEntryChoices {
  const slot = store.define({ key: 'shardEntry', scope: 'session', version: 1, schema, initial: (): Readonly<Record<string, ShardEntryMode>> => ({}) });
  return {
    choose: (slug, mode) => { const all = slot.read(); if (all[slug] !== mode) slot.write({ ...all, [slug]: mode }); },
    read: (slug) => slot.read()[slug] ?? null,
  };
}
let page: ShardEntryChoices | null = null;
function pageChoices(): ShardEntryChoices {
  page ??= shardEntryChoices(app.saves);
  return page;
}

/** SHARD SELECT records the way in before it travels (the next page reads it in `shardEntry`). */
export function chooseShardEntry(slug: string, mode: ShardEntryMode, choices: ShardEntryChoices = pageChoices()): void {
  choices.choose(slug, mode);
}

/** The way this page enters the shard: with Developer on, this tab's choice when the shard has that entry; otherwise
 *  (and always in the public build) the shard's public entry, unchanged. */
export function shardEntry(manifest: Pick<ShardManifest, 'slug' | 'load' | 'entries'>, developer: boolean = isDev(),
  choices: () => ShardEntryChoices = pageChoices): ShardEntryMode {
  const entries = shardEntries(manifest);
  if (!developer) return entries.public;
  const chosen = choices().read(manifest.slug);
  return chosen !== null && hasEntry(entries, chosen) ? chosen : entries.public;
}
