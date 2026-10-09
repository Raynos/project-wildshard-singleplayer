export const LEGACY_INVENTORY: 'lint/legacy-shards.json';
export interface LegacyRow { primary: string; source: string; files: Readonly<Record<string, string>>; compatibility?: Readonly<Record<string, { original: string; current: string; reason: string }>> }
export interface LegacyInventory { version: 1; sealed: boolean; shards: Readonly<Record<string, LegacyRow>> }
export function legacyInventory(root: string): LegacyInventory;
export function legacyPrimary(root: string, slug: string): string | undefined;
export function registeredLegacyFile(inventory: LegacyInventory, file: string): boolean;
export function checkLegacyInventory(root: string, inventory?: LegacyInventory): string[];
export function compareLegacyInventory(before: LegacyInventory, after: LegacyInventory, changed: readonly string[], message: string): string[];
export function checkLegacyCommit(root: string, message: string): string[];
export function legacyManifestRules(text: string, slug: string): string[];
