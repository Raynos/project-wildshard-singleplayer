import { skyWorldPieceSource } from './worldPieceBytes';
import { skyWorldPackFiles } from './worldPackBytes';
import { bakeSkyIsles } from './isles';

/** Supply every original world input the map consumes, without public geometry or metadata reads. */
export function skyMapWorldSources(compress: (bytes: Uint8Array) => Uint8Array): Map<string, Uint8Array> {
  const sources = new Map<string, Uint8Array>();
  for (const [name, bytes] of skyWorldPieceSource()) {
    if (name.startsWith('baked/')) sources.set(`../../../public/assets/far-reach/${name}`, bytes);
    else if (name === 'data/geometries.json') sources.set(name, bytes);
  }
  for (const [name, bytes] of skyWorldPackFiles('isles', bakeSkyIsles(), compress)) {
    sources.set(name.startsWith('baked/') ? `../../../public/assets/far-reach/${name}` : name, bytes);
  }
  return sources;
}
