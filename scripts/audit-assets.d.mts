export interface InventoryRow {
  slug: string; tier: string; files: readonly string[]; packFiles: readonly string[];
  packed: readonly string[]; gpu: Readonly<Record<string, string>>; ktxFiles: readonly string[];
}
export function auditInventory(rows: readonly InventoryRow[], exists: (url: string) => boolean): string[];
