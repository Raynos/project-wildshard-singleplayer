import type { CoverGrid } from './coverTint';
import { TIER } from '@wildshard/engine/core/tier';
import { ISLAND_COVER_FILES } from '../data/islandCoverFiles';
import { decodeFloatBlock } from '../runtime/looks/bakedIsland';
import { ISLAND_LOOK } from '../data/islandRows';

/** Required boot content: a bad header, placement count or grid refuses the world stage. */
export function requiredIslandCover(bytes: ArrayBuffer | null, used: number, floats: number | undefined): Float32Array {
  if (bytes === null || floats === undefined) throw new Error('Required island cover is missing');
  const block = decodeFloatBlock(bytes, used, floats, ISLAND_LOOK.coverFile.magic, ISLAND_LOOK.coverFile.version);
  if (block === null || !block.every(Number.isFinite)) throw new Error('Required island cover is corrupt or mismatched; rebuild its declared boot file');
  return block;
}

/** Required declared boot file; immutable URL caching and hash admission precede borrowing its storage. */
export async function loadIslandCover():Promise<Parameters<typeof CoverGrid.create>> {
 const file=ISLAND_COVER_FILES[TIER],response=await fetch(file.url,{cache:'force-cache'});
 if(!response.ok)throw new Error('Required island cover is missing');
 const bytes=await response.arrayBuffer();
 if(bytes.byteLength!==file.bytes)throw new Error('Required island cover is corrupt or mismatched; rebuild its declared boot file');
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),hash=Array.from(digest,v=>v.toString(16).padStart(2,'0')).join('');
 if(hash!==file.hash)throw new Error('Required island cover is corrupt or mismatched; rebuild its declared boot file');
 return [requiredIslandCover(bytes,file.used,file.floats),file.rect];
}
