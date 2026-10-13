import type { CommonsPack } from '@wildshard/sdk/commons';
import aliases from './aliases.json' with { type: 'json' };

/** Emit the unchanged clip aliases shared by Driftwood and Nine; no rig or playback service runs here. */
export function starterArmClipsPack(provenance: { credit: string; licence: string }): CommonsPack {
  return { id: 'arm-clips', version: '1.0.0', entries: [{ id: 'aliases', kind: 'binary',
    bytes: new TextEncoder().encode(JSON.stringify(aliases)), ...provenance }] };
}

