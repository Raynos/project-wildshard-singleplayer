import { bakeOwned, type BakedScene } from '@wildshard/sdk/bake';
import type { BakedKind } from '@wildshard/sdk/bake/kinds';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { SKY_IDENTITY } from './piece';
import { SKY_PIECES, skyReachScene } from './scene';

/** Typed original piece metadata; additional authored fields keep their own JSON values. */
export interface SkyWorldPieceRows extends Readonly<Record<string, unknown>> {
  readonly glb: string;
  readonly kinds: readonly BakedKind[];
  readonly colliders: readonly SkyWorldCollider[];
}

/** Original boxed contact wire retained by the baked scene library. */
export interface SkyWorldCollider {
  readonly kind: string; readonly x: number; readonly y: number; readonly z: number;
  readonly hx: number; readonly hy: number; readonly hz: number; readonly surface: string;
  readonly yaw?: number; readonly rot?: { readonly x: number; readonly y: number; readonly z: number; readonly w: number };
}
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
function collider(value: unknown): value is SkyWorldCollider {
  if (!record(value) || typeof value['kind'] !== 'string' || typeof value['surface'] !== 'string'
    || !['x', 'y', 'z', 'hx', 'hy', 'hz'].every(key => finite(value[key]))
    || value['yaw'] !== undefined && !finite(value['yaw'])) return false;
  const rot = value['rot'];
  return rot === undefined || record(rot) && ['x', 'y', 'z', 'w'].every(key => finite(rot[key]));
}

/** Derive fresh owned metadata directly from the authored pieces, before any JSON publication. */
export function skyWorldPieceValues(): ReadonlyMap<string, SkyWorldPieceRows> {
  const pieces = bakeOwned(skyReachScene(), SKY_IDENTITY).pieces;
  if (pieces.length !== SKY_PIECES.length) throw new Error('Sky world piece inventory differs');
  return new Map(pieces.map(({ glb, kinds, colliders, rows }, index) => {
    const contacts = colliders.map(value => {
      if (!collider(value)) throw new Error('Sky world boxed contact wire differs');
      return value;
    });
    const piece = SKY_PIECES[index];
    if (piece === undefined) throw new Error('Missing Sky world piece declaration');
    return [piece.glb, structuredClone({ glb: hashImmutableBytes(glb), kinds, colliders: contacts, ...rows })];
  }));
}

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
