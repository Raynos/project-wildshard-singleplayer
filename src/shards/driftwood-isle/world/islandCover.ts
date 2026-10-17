import * as THREE from 'three';
import { TIER } from '@wildshard/engine/core/tier';
import ISLAND_COVER_FILES from '../data/islandCoverFiles.json' with { type: 'json' };
import { readDriftwoodBlob } from '../runtime/boot/blobAssets';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';

/** E156, baked (generators/islandCover.ts `bakeFullIslandCover`): the ground wears the cover. The cover plants fade into
 *  `ground` (sampled through `groundRect`); each terrain wears its per-vertex cover bytes, which its graph reads `flat`
 *  (data/lookGraphs.json, the cover mix): part 0 the faceted ground, then the island's terrain tiles in load order. */
export interface IslandCover { readonly ground: THREE.DataTexture; readonly groundRect: readonly number[]; wear: (geometry: THREE.BufferGeometry, part: number) => void }

/** Required declared boot file; immutable URL caching and hash admission precede borrowing its storage. */
export async function loadIslandCover(product?: ShardProduct): Promise<IslandCover> {
  const file = ISLAND_COVER_FILES[TIER], bytes = Uint8Array.from(await readDriftwoodBlob(file.url, product)).buffer;
  if (bytes.byteLength !== file.bytes) throw new Error('Required island cover is corrupt or mismatched; rebuild its declared boot file');
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), hash = Array.from(digest, v => v.toString(16).padStart(2, '0')).join('');
  if (hash !== file.hash) throw new Error('Required island cover is corrupt or mismatched; rebuild its declared boot file');
  const { width, height } = file.texture, ground = new THREE.DataTexture(new Uint16Array(bytes, 0, width * height * 4), width, height, THREE.RGBAFormat, THREE.HalfFloatType);
  ground.magFilter = THREE.LinearFilter; ground.minFilter = THREE.LinearFilter; ground.colorSpace = THREE.NoColorSpace; ground.needsUpdate = true;
  return { ground, groundRect: file.groundRect, wear: (geometry, part) => {
    const [at, count] = file.parts[part] ?? [0, -1];
    if (geometry.getAttribute('position').count !== count) throw new Error('Required island cover does not match its terrain; rebuild its declared boot file');
    geometry.setAttribute('aCover', new THREE.BufferAttribute(new Uint8Array(bytes, at, count * 4), 4, true));
    geometry.setAttribute('aCoverSide', new THREE.BufferAttribute(new Uint8Array(bytes, at + count * 4, count), 1, true));
  } };
}
