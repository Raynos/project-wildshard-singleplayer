interface FileRow { readonly hash: string; readonly name?: string }

const COLD_FILES = new Set(['geometry/fixed-kits.json', 'practice/card.webp', 'looks/jian-decal-desktop.png',
  'geometry/layout.json', 'signs/atlas-phone.json', 'signs/atlas-desktop.json']);

/** Volumes already have a selected URL reader. Practice opens its own layout,
 * and the phone never selects the desktop decal. Retained author headers have
 * no live consumer: their compiled placements, glyphs and light data do.
 * Their bytes remain published
 * and charged, with required/critical roots retaining their normal priority. */
export function nineDemandFiles(files: readonly FileRow[], volumes: readonly Pick<FileRow, 'hash'>[]): { hash: string }[] {
  const declared = new Set(files.map(file => file.hash)), demand = new Set<string>();
  for (const volume of volumes) {
    if (!declared.has(volume.hash)) throw new Error('Nine demand volume must be a published file');
    demand.add(volume.hash);
  }
  for (const file of files) if (file.name !== undefined && COLD_FILES.has(file.name)) demand.add(file.hash);
  return [...demand].sort((a, b) => a < b ? -1 : a > b ? 1 : 0).map(hash => ({ hash }));
}
