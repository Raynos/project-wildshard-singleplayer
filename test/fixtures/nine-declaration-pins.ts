import { expect } from 'vitest';
import { beforeHalfWorld, previousHalfDeclaration, previousHalfHashes } from './nine-half-world';
import { inputs } from './nine-product-inputs';
import { layoutBlobs } from '../../src/shards/nine-dragon-stack/generators/layoutBlobs';
import { bakedLayout } from '../../src/shards/nine-dragon-stack/generators/layoutProjection';
import { architectureGraphs } from '../../src/shards/nine-dragon-stack/generators/architectureGraphs';
import { encodeCanonicalJson, hashImmutableBytes } from '../../src/sdk/immutable';
import type { Shardfile } from '../../src/sdk/shardfile';
import worldFiles from './nine-world-files.json' with { type: 'json' };

const signature = (value: unknown): { bytes: number; hash: string } => {
  const source = new TextEncoder().encode(encodeCanonicalJson(value));
  return { bytes: source.byteLength, hash: hashImmutableBytes(source) };
};

/** NR2: the layout wire names every kit's aFace / aPat half floats f16; its predecessor named the merged kits' u16.
 *  The predecessor wire is the current one with each attribute label from the predecessor layout and its references
 *  renamed back, so only its hash moves. */
function previousLayoutWire(): { readonly current: string; readonly previous: string } {
  const blob = layoutBlobs(inputs.ownedWorld, inputs.scenes)[0]; if (blob === undefined) throw new Error('Missing Nine layout wire');
  const value: unknown = JSON.parse(new TextDecoder().decode(blob.bytes)), former = bakedLayout(beforeHalfWorld.layout).rows.geometries;
  const rows: unknown = typeof value === 'object' && value !== null ? Reflect.get(value, 'rows') : undefined;
  const geometries: unknown = typeof rows === 'object' && rows !== null ? Reflect.get(rows, 'geometries') : undefined;
  if (!Array.isArray(geometries) || geometries.length !== former.length) throw new Error('Nine layout wire rows differ');
  for (const [i, row] of geometries.entries()) {
    const attrs: unknown = typeof row === 'object' && row !== null ? Reflect.get(row, 'attrs') : undefined, old = former[i]?.attrs;
    if (!Array.isArray(attrs) || old === undefined || attrs.length !== old.length) throw new Error('Nine layout wire channels differ');
    for (const [j, attr] of attrs.entries()) { const was = old[j]; if (Array.isArray(attr) && was !== undefined && attr[0] === was[0]) attr[1] = was[1]; }
  }
  return { current: blob.file.hash, previous: hashImmutableBytes(new TextEncoder().encode(previousHalfHashes(JSON.stringify(value)))) };
}

/** Nine's complete declaration, attributed. The declaration pinned at 734805 B / c80c8026 (ba4dab6764) moved twice.
 *  T8 (82ac81812d, e389eb998e, b1f6916531) added the 16 L1 rows and the 12 coarse files only they draw, none in the
 *  library: without them it is 735799 B. The rest is I3's regridded world (978526b2f7): every file row but 17 is a world
 *  file the independently regenerated world fixture pins (f1af1023d3), and those 17 are pinned here by hash. */
/** NR12: the coarse L1 parents draw in the `nine-coarse-facade` graph as the props family; its predecessor had no such look
 *  material (nor its graph file) and the plain `pbr` family. Everything else is unchanged. */
function previousCoarseFamily(product: Shardfile): Shardfile {
  const graph = product.look.materials['nine-coarse-facade'];
  if (graph === undefined || product.props === null || product.props.family !== 'nine-coarse-facade') throw new Error('Missing Nine coarse family');
  // inline before packing; a packed graph names its file row
  const file: unknown = Reflect.get(graph, 'file');
  const materials = Object.fromEntries(Object.entries(product.look.materials).filter(([id]) => id !== 'nine-coarse-facade'));
  return { ...product, look: { ...product.look, materials }, props: { ...product.props, family: 'pbr' },
    files: product.files.filter(row => row.hash !== file), library: product.library.filter(hash => hash !== file) };
}

/** a JSON value with the windows' corner read back to `positionLocal` (the same shape: one op name differs) */
function cornerBefore<T>(value: T): T { return JSON.parse(JSON.stringify(value).replace('"op":"positionGeometry"', '"op":"positionLocal"')); }

/** NR3: the `nine-windows` graph reads the quad's own corner (`positionGeometry`); its predecessor read `positionLocal`. */
function previousWindowsCorner(product: Shardfile): Shardfile {
  const windows = product.look.materials['nine-windows'];
  if (windows === undefined || !JSON.stringify(windows).includes('"op":"positionGeometry"')) throw new Error('Missing Nine windows corner');
  return { ...product, look: { ...product.look, materials: { ...product.look.materials, 'nine-windows': cornerBefore(windows) } } };
}

/** NR13: the kit graphs (`nine-architecture`, `-cut`) carry the wet treads' glints and LEGACY's surface paint strengths;
 *  their predecessors are the same graphs built as before (`architectureGraphs({ nr13: false })`). */
function previousKitGlints(product: Shardfile): Shardfile {
  const before = architectureGraphs({ nr13: false }), materials = { ...product.look.materials };
  for (const id of ['nine-architecture', 'nine-architecture-cut']) {
    const material = materials[id], graph = before[id];
    if (material === undefined || graph === undefined || !('family' in material) || material.family !== 'graph' || !JSON.stringify(material).includes('"treadGlint"')) throw new Error(`Missing Nine kit glints: ${id}`);
    materials[id] = { ...material, graph };
  }
  return { ...product, look: { ...product.look, materials } };
}

export function expectNineDeclaration(current: Shardfile): void {
  // The independently pinned 411-file source proof defines the only allowed
  // reference renaming; full declaration pins remain unchanged below.
  const wire = previousLayoutWire();
  const product = JSON.parse(JSON.stringify(previousHalfDeclaration(previousCoarseFamily(previousWindowsCorner(previousKitGlints(current))))).replaceAll(wire.current, wire.previous)) as Shardfile;
  const fine = new Set(product.tiles.filter(tile => tile.lod === 0).flatMap(tile => tile.files));
  const coarse = new Set(product.tiles.filter(tile => tile.lod === 1).flatMap(tile => tile.files).filter(file => !fine.has(file)));
  expect(coarse.size).toBe(12); expect(product.library.filter(file => coarse.has(file))).toEqual([]);
  expect(product.tiles.filter(tile => tile.lod !== 0 && tile.lod !== 1)).toEqual([]);
  expect(signature({ ...product, tiles: product.tiles.filter(tile => tile.lod === 0), files: product.files.filter(file => !coarse.has(file.hash)) }))
    .toEqual({ bytes: 735799, hash: '2f6528020c26bdf3c628aa9088550baa4689456b09e689d5b90621c54e456ffd' });
  const world = new Set(worldFiles.map(row => row.hash));
  expect(signature(product.files.filter(file => !world.has(file.hash)).map(file => file.hash).sort()))
    .toEqual({ bytes: 1141, hash: '67a5183e4aa385f2c15a32302856e41dd421917f145ba7ac50ad096e7c7c9b8b' });
  expect(signature(product)).toEqual({ bytes: 741684, hash: 'bb6b8ed8c0dde17b00ea3e6815d7292a51ebe09017284bfe092e465b8d21a23a' });
}
