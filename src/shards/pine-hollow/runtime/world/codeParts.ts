/**
 * Pine Hollow's code-built parts from their offline bake (SHARD-PLATFORM W2: ../generators/codeParts.ts writes the
 * hollow log, the token shelf, the stand-in people, the zipline trolley, the canoe, the zip-line cable and the cave's
 * roof patch into one geometry pack): fetched once (`loadCodeParts`, awaited by the quest's install, the landmarks' and
 * the models' `prepare`), then each part read back exactly as
 * the builder left it, a fresh copy per call (`codePart`).
 */
import type * as THREE from 'three';
import { fetchDeflated, GeometryPack, packedRows } from '@wildshard/sdk/kit/geometryPack';
import meta from '../../data/codeParts.json' with { type: 'json' };

/** a baked part's name */
export type CodePartName = keyof typeof meta.parts;

let pending: Promise<void> | null = null, pack: GeometryPack | null = null;

async function fetchPack(): Promise<void> {
  try { pack = new GeometryPack(await fetchDeflated(meta.url), packedRows(meta.rows), 'pine code parts'); }
  catch (error: unknown) { pending = null; throw error; }
}

/** Fetch the pack (once; a failed fetch is retried on the next call). */
export function loadCodeParts(): Promise<void> {
  pending ??= fetchPack();
  return pending;
}

/** A fresh copy of part `name` (after `loadCodeParts`). */
export function codePart(name: CodePartName): THREE.BufferGeometry {
  if (pack === null) throw new Error(`[pine code parts] ${name}: loadCodeParts() first`);
  return pack.geometry(meta.parts[name]);
}
