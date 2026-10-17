import { GROUND_FILES } from './groundFiles';
import { PALM_FILES } from './palmFiles';
import { HIBISCUS_FILES } from './hibiscusFiles';
import { REEF_FILES } from './reefFiles';
import { FIXED_MODEL_FILES } from './modelFiles';
import fixed from '../data/fixedBlobs.generated.json' with { type: 'json' };
import reef from '../data/reefBlobs.generated.json' with { type: 'json' };
import ground from '../data/groundBlobs.generated.json' with { type: 'json' };
import dressing from '../data/dressingBlobs.generated.json' with { type: 'json' };
import zipline from '../data/ziplineBlobs.generated.json' with { type: 'json' };

const manifests = [fixed, reef, ground, dressing, zipline];
const blobs = manifests.flatMap(row => row.blobs);
const canonical = new Map<string, (typeof blobs)[number]>();
const names = new Map<string, string>();
for (const row of blobs) {
  const previous = canonical.get(row.source);
  if (previous !== undefined && previous.kind !== row.kind) throw new Error('Asset source changes kind');
  canonical.set(row.source, previous ?? row);
  const name = previous?.name ?? row.name, old = names.get(row.name);
  if (old !== undefined && old !== name) throw new Error('Asset name changes content');
  names.set(row.name, name);
}
const byUrl: Record<string, string> = {};
for (const manifest of manifests) for (const [url, declared] of Object.entries(manifest.byUrl)) {
  const name = names.get(declared), previous = byUrl[url];
  if (name === undefined || (previous !== undefined && previous !== name)) throw new Error('Asset URL has conflicting or missing content');
  byUrl[url] = name;
}
/** Stable draw slots are authored asset-index aliases, resolved only after product admission. */
export const DRIFTWOOD_FIXED_SOURCES = Object.fromEntries(Object.entries(FIXED_MODEL_FILES).map(([slot, url]) => {
  const name = byUrl[url];
  if (name === undefined) throw new Error(`Missing fixed source: ${slot}`);
  return [slot, name];
}));
for (const [slot, name] of Object.entries(DRIFTWOOD_FIXED_SOURCES)) byUrl[`fixed:${slot}`] = name;
/** Stable draw labels resolve only through the admitted asset index, including deduplicated variants. */
function registerDraws(label: string, value: unknown): void {
  if (typeof value === 'string') {
    const name = byUrl[value];
    if (name === undefined) throw new Error(`Missing authored draw: ${label}`);
    byUrl[label] = name;
  } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) registerDraws(`${label}:${key}`, child);
  } else throw new Error('Draw file labels require named source leaves');
}
for (const [family, files] of Object.entries({ ground: GROUND_FILES, palms: PALM_FILES, hibiscus: HIBISCUS_FILES, reef: REEF_FILES })) registerDraws(`draw:${family}`, files);
/** Build-only mapping for the runtime's checked logical-name mirrors. */
export const DRIFTWOOD_ASSET_NAMES = byUrl;
/** Build-only source declarations and an explicit, retiring URL-to-name bridge. */
export const DRIFTWOOD_OUTPUT = {
  blobs: [...canonical.values()].map(row => {
    if (row.kind !== 'glb') return row;
    const result = { ...row };
    return Object.assign(result, { options: { meshopt: true } });
  }),
  custom: {byUrl},
};
