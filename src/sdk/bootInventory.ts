import { filePolicy } from '@wildshard/engine/boot/filePolicy';
import { CLOUD_FIELD_URL } from '@wildshard/engine/boot/bakedApi';

/** Authoring inputs are explicit presence/byte tables, never a live download service. */
export type BootInventory = Readonly<Record<string, number | true>>;
/** One concrete output tier. */
export type BootTier = 'phone' | 'desktop';
/** A declared texture encoding. */
export type BootTextures = 'img' | 'ktx2';
/** Ordered reads by loading phase. */
export type BootSources = Readonly<Record<'sky' | 'baked' | 'terrain' | 'trees' | 'physics' | 'cabins' | 'props' | 'art' | 'music' | 'sfx', readonly string[]>>;
/** A resolved value for each output tier and texture mode. */
export interface BootModes<T> { readonly modes: Readonly<Record<BootTier, Readonly<Record<BootTextures, T>>>> }
/** Explicit per-tier GPU aliases, with author aliases overriding shared assets. */
export type BootGpuFiles = Readonly<Record<BootTier, Readonly<Record<string, string>>>>;

/** Resolve phone fallbacks and GPU aliases using only the supplied inventory.
 * Ordering and duplicate handling remain the caller's responsibility. */
export function bootFilePolicy(tier: BootTier, mode: BootTextures, table: BootGpuFiles, inventory: BootInventory): { phone: (url: string) => string; gpu: (url: string) => string } {
  if (inventory === undefined || inventory === null) throw new Error('Boot authoring requires an explicit inventory');
  const { phone, gpu } = filePolicy(tier, mode, table, inventory);
  return { phone, gpu };
}

/** Shared sky bytes participate only when explicitly present in the author inventory. */
export function sharedBootTextures(inventory: BootInventory): string[] {
  return CLOUD_FIELD_URL in inventory ? [CLOUD_FIELD_URL] : [];
}
