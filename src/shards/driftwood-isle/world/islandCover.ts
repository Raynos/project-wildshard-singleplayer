import type { CoverGrid } from './coverTint';
import { TIER } from '@wildshard/engine/core/tier';
import { ISLAND_COVER_FILES } from '../data/islandCoverFiles';
import { ISLAND_LOOK } from '../data/islandRows';
import { readDriftwoodBlob } from '../runtime/boot/blobAssets';
import type { ShardProduct } from '@wildshard/game/shardfile/shardProduct';

/** Required boot content: a bad header, placement count or grid refuses the world stage. */
export function requiredIslandCover(bytes: ArrayBuffer | null, used: number, floats: number | undefined): Float32Array {
  if (bytes === null || floats === undefined) throw new Error('Required island cover is missing');
  // the baked file: a 16-byte header (magic, version, the placements it was baked from, floats), then the f32s
  const head = bytes.byteLength === 16 + floats * 4 ? new Uint32Array(bytes, 0, 4) : null, { magic, version } = ISLAND_LOOK.coverFile;
  const block = head?.[0] === magic && head[1] === version && head[2] === used && head[3] === floats ? new Float32Array(bytes, 16, floats) : null;
  if (block === null || !block.every(Number.isFinite)) throw new Error('Required island cover is corrupt or mismatched; rebuild its declared boot file');
  return block;
}

/** Required declared boot file; immutable URL caching and hash admission precede borrowing its storage. */
export async function loadIslandCover(product?: ShardProduct):Promise<Parameters<typeof CoverGrid.create>> {
 const file=ISLAND_COVER_FILES[TIER],input=await readDriftwoodBlob(file.url,product);
 const bytes=Uint8Array.from(input).buffer;
 if(bytes.byteLength!==file.bytes)throw new Error('Required island cover is corrupt or mismatched; rebuild its declared boot file');
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),hash=Array.from(digest,v=>v.toString(16).padStart(2,'0')).join('');
 if(hash!==file.hash)throw new Error('Required island cover is corrupt or mismatched; rebuild its declared boot file');
 return [requiredIslandCover(bytes,file.used,file.floats),file.rect];
}
