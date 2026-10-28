import declared from '../data/bootAssets.json' with { type: 'json' };

/** Resolve exactly one authored rig input from the supplied tier's boot inventory. */
export function rigFileFrom(files: readonly string[], hull: string, tier: 'phone' | 'desktop'): string {
  const suffix = `/${hull}${tier === 'phone' ? '.phone' : ''}.rigged.glb`;
  const matches = files.filter(file => file.endsWith(suffix)), [file] = matches;
  if (matches.length !== 1 || file === undefined) throw new Error(`Rig needs one declared ${tier} source: ${hull}`);
  return file;
}

/** The hull book and offline coat painter consume the same declared original rig. */
export function nalatiRigFile(hull: string, tier: 'phone' | 'desktop'): string {
  return rigFileFrom(declared.world[tier], hull, tier);
}
