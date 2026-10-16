import * as v from 'valibot';
import { defineSection, emitDefinedSections } from '@wildshard/sdk/sections';
import fixed from './fixedBlobs.generated.json' with { type: 'json' };
import reef from './reefBlobs.generated.json' with { type: 'json' };
import ground from './groundBlobs.generated.json' with { type: 'json' };
import dressing from './dressingBlobs.generated.json' with { type: 'json' };
import zipline from './ziplineBlobs.generated.json' with { type: 'json' };

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
const AssetsSchema = v.strictObject({
  byUrl: v.record(v.pipe(v.string(), v.maxLength(512)), v.pipe(v.string(), v.maxLength(240))),
});
/** Build-only mapping for the runtime's checked logical-name mirrors. */
export const DRIFTWOOD_ASSET_NAMES = byUrl;
/** Build-only source declarations and an explicit, retiring URL-to-name bridge. */
export const DRIFTWOOD_OUTPUT = {
  blobs: [...canonical.values()].map(row => {
    if (row.kind !== 'glb') return row;
    const result = { ...row };
    return Object.assign(result, { options: { meshopt: true } });
  }),
  custom: emitDefinedSections([defineSection('custom/assets', AssetsSchema, { byUrl })]),
};
