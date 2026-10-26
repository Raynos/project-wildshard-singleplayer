import { bakeOwned, type BakedScene } from '@wildshard/sdk/bake';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { SKY_IDENTITY } from './piece';
import { SKY_PIECES, skyReachScene } from './scene';

/** Original logical piece files; the caller owns publication and optional scene diagnostics. */
export function skyWorldPieceFiles(pieces: BakedScene['pieces']): Map<string, Uint8Array> {
  if (pieces.length !== SKY_PIECES.length) throw new Error('Sky world piece inventory differs');
  const files = new Map<string, Uint8Array>(), text = new TextEncoder();
  for (const [index, { glb, kinds, colliders, rows }] of pieces.entries()) {
    const piece = SKY_PIECES[index];
    if (piece === undefined) throw new Error('Missing Sky world piece declaration');
    files.set(`baked/${piece.glb}.glb`, glb.slice());
    files.set(`data/${piece.rows}.json`, text.encode(`${JSON.stringify({ glb: hashImmutableBytes(glb), kinds, colliders, ...rows }, null, 2)}\n`));
  }
  return files;
}

/** Compile the authored static world pieces into owned bytes without publishing files. */
export function skyWorldPieceSource(): Map<string, Uint8Array> {
  return skyWorldPieceFiles(bakeOwned(skyReachScene(), SKY_IDENTITY).pieces);
}
