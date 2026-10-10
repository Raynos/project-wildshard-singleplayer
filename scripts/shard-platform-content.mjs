// G304: report the built world envelope separately from the source-code ratio.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

function privateFiles(folder, root) {
  if (!existsSync(folder)) return [];
  return readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(folder, entry.name);
    if (entry.isDirectory()) return ['node_modules', 'dist'].includes(entry.name) ? [] : privateFiles(path, root);
    // look/map.baked.json is the map bake's freshness stamp (a hash and an image URL); no runtime code reads it
    if (entry.name === 'map.baked.json' && folder.endsWith('/look')) return [];
    return /\.bin$|\.baked\.json$/u.test(entry.name) ? [relative(root, path)] : [];
  });
}
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const rows = value => Array.isArray(value) && value.every(record);
const present = value => value !== undefined && value !== null;

/** Read only an emitted shard.json; a missing/invalid product never masquerades as zero world content. */
export function shardContent(slug, root, products = resolve(root, 'public/shardfiles')) {
  const path = resolve(products, slug, 'shard.json');
  const privateBinaries = [...privateFiles(resolve(root, 'src/shards', slug), root), ...privateFiles(resolve(root, 'public/assets/baked', slug), root)].sort((a, b) => a.localeCompare(b));
  const absent = status => ({ status, product: relative(root, path), privateBinaries, tiles: null, files: null, colliders: null, trustedSimulation: null, structuralWorld: null });
  if (!existsSync(path)) return absent('missing');
  let source;
  try { source = JSON.parse(readFileSync(path, 'utf8')); } catch { return absent('invalid'); }
  if (!record(source) || !rows(source.tiles) || !rows(source.files)
    || source.tiles.some(tile => ![0, 1].includes(tile.lod)) || source.files.some(file => typeof file.hash !== 'string' || typeof file.kind !== 'string')
    || (present(source.props) && (!record(source.props) || !rows(source.props.colliders ?? [])
      || (source.props.colliders ?? []).some(collider => !rows(collider.shapes) || collider.shapes.some(shape => shape.kind === 'treads' && (!Number.isSafeInteger(shape.count) || shape.count < 1)))))
    || (present(source.meshCollision) && (!record(source.meshCollision) || !rows(source.meshCollision.tiles) || !rows(source.meshCollision.panels)))
    || (present(source.nativeGround) && (!record(source.nativeGround) || typeof source.nativeGround.file !== 'string'))
    || (present(source.runtime) && (!record(source.runtime) || typeof source.runtime.entry !== 'string'))) return absent('invalid');
  // Binaries a schema row hands to the platform's own decoder are tiles, not shard-private: mesh collision chunks and panels
  // (game shardfile/meshCollision), the heightfield's collider and tile payloads (shardfile/terrain), the look's LUT.
  const platformDecoded = new Set([...(source.meshCollision?.tiles ?? []), ...(source.meshCollision?.panels ?? []), ...(source.terrain?.tiles ?? [])]
    .map(row => row.file).concat(source.terrain?.collider ?? [], source.look?.grade?.lut ?? []).filter(file => typeof file === 'string'));
  const kinds = new Map();
  let platformBinaries = 0;
  for (const file of source.files) {
    kinds.set(file.kind, (kinds.get(file.kind) ?? 0) + 1);
    if (file.kind === 'binary' && platformDecoded.has(file.hash)) platformBinaries++;
    else if (file.kind === 'binary') privateBinaries.push(`shard.json files:${file.hash} (opaque binary; decoder ownership requires audit)`);
  }
  if (present(source.nativeGround)) privateBinaries.push(`shard.json nativeGround:${source.nativeGround.file} (trusted native collider owner)`);
  const descriptors = source.props?.colliders ?? [];
  const colliders = { descriptors: descriptors.length, shapes: descriptors.reduce((count, collider) => count + collider.shapes.reduce((total, shape) => total + (shape.kind === 'treads' ? shape.count : 1), 0), 0),
    meshTiles: source.meshCollision?.tiles.length ?? 0, meshPanels: source.meshCollision?.panels.length ?? 0, heightfield: present(source.terrain) };
  const trustedSimulation = present(source.runtime);
  // This is a structural candidate, not a claim that a partial world covers all native geometry.
  const structuralWorld = source.tiles.length > 0 && source.files.length > 0
    && (colliders.heightfield || colliders.meshTiles > 0 || colliders.descriptors > 0)
    && !present(source.nativeGround) && !trustedSimulation && privateBinaries.length === 0;
  return { status: 'built', product: relative(root, path), privateBinaries,
    tiles: { total: source.tiles.length, l0: source.tiles.filter(tile => tile.lod === 0).length, l1: source.tiles.filter(tile => tile.lod === 1).length },
    files: { total: source.files.length, kinds: Object.fromEntries(kinds), platformBinaries }, colliders, trustedSimulation, structuralWorld };
}
