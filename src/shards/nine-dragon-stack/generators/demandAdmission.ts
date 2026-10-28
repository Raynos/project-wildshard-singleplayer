import type { AuthorWorldScenes } from '@wildshard/sdk/worldScenes';

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

/** Pool readers already select their device tier. Shared physical files keep
 * their early admission; only exclusive desktop bodies leave the phone copy. */
export function nineDesktopPoolFiles(files: readonly FileRow[], libraries: AuthorWorldScenes['libraries']): { hash: string }[] {
  const names = new Map<string, string>();
  for (const file of files) { names.set(file.hash, file.hash); if (file.name !== undefined) names.set(file.name, file.hash); }
  const desktop = new Set<string>(), shared = new Set<string>();
  const keep = (ref: string): void => { const hash = names.get(ref); if (hash !== undefined) shared.add(hash); };
  const cold = (ref: string): void => {
    const hash = names.get(ref); if (hash === undefined) throw new Error('Nine desktop pool must be a published file');
    desktop.add(hash);
  };
  for (const library of libraries) {
    if (library.kind === 'pool') for (const file of library.files) {
      const phone = typeof file.file === 'string' ? file.file : file.file.phone;
      const other = typeof file.file === 'string' ? file.file : file.file.desktop;
      if (file.tier === 'desktop') cold(other);
      else { keep(phone); if (file.tier === undefined && typeof file.file !== 'string') cold(other); }
    }
    else if (library.kind === 'whole') for (const model of library.models) for (const file of model.files) keep(file);
    else if (library.kind === 'owned') for (const model of library.models) for (const file of typeof model.file === 'string' ? [model.file] : Object.values(model.file)) keep(file);
    else keep(library.file);
  }
  return [...desktop].filter(hash => !shared.has(hash)).sort((a, b) => a < b ? -1 : a > b ? 1 : 0).map(hash => ({ hash }));
}
