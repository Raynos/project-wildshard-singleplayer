import inventory from '../data/fixedGeometry.json' with { type: 'json' };

/** One authored inventory supplies build assets and inert client geometry declarations. */
export const FIXED_MODEL_FILES: Record<string, string> = Object.fromEntries(inventory.draws.map(row => [row.slot, row.source]));
export const FIXED_DRAW_ROWS: { slot: string; channels: string[][]; }[] = inventory.draws.map(({ slot, channels }) => ({ slot, channels }));

/** Original fixed-model logical identities come from the authored draw inventory, never a generated hash manifest. */
export const FIXED_MODEL_NAMES: Readonly<Record<string, string>> = Object.fromEntries([...inventory.draws].sort((a, b) => a.source < b.source ? -1 : a.source > b.source ? 1 : 0).map(({ source }) => {
  const filename = source.slice(source.lastIndexOf('/') + 1);
  if (!filename.endsWith('.glb') || filename === '.glb') throw new Error('Invalid authored fixed-model identity');
  return [source, `models/fixed/${filename}`];
}));
