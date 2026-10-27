import * as v from 'valibot';
import { parseShardfileField } from '../../src/sdk/shardfile';
import { hashImmutableBytes } from '../../src/sdk/immutable';
import type { Shardfile } from '../../src/format/shardSchema';
import original from './nalati-render-rows.json' with { type: 'json' };
import pins from './nalati-render-source-files.json' with { type: 'json' };

type Header = Shardfile;
const envelope = v.strictObject({ version: v.literal(1), files: v.unknown(), tiles: v.unknown(), props: v.unknown() });
function renderRows(input: unknown) {
  const value = v.parse(envelope, input);
  const props = parseShardfileField('props', value.props);
  if (props === null) throw new Error('Missing Nalati render bindings');
  return { files: parseShardfileField('files', value.files), tiles: parseShardfileField('tiles', value.tiles), props };
}
function same(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Nalati render predecessor differs: ${label}`);
}

/** T8 adds sixteen fully pinned L1 rows. Remove only that admitted transport
 * extension for the unchanged complete pre-T8 header oracle; every prior field,
 * file and binding remains exact. This is never a live product fallback. */
export function predecessorRenderHeader(header: Header, metadata: Uint8Array): Header {
  const headerProps = header.props;
  if (headerProps === null) throw new Error('Missing Nalati header render bindings');
  const pin = pins.find(row => row.path === 'data/renderTiles.json');
  if (pin === undefined || metadata.byteLength !== pin.bytes || hashImmutableBytes(metadata) !== pin.sha256) {
    throw new Error('Nalati render metadata differs from its complete source pin');
  }
  const current = renderRows(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(metadata))), before = renderRows(original);
  const added = current.tiles.filter(tile => tile.lod === 1), hashes = new Set(added.flatMap(tile => tile.files));
  if (added.length !== 16 || hashes.size !== 16 || current.tiles.length !== before.tiles.length + 16
    || current.files.length !== before.files.length + 16 || before.tiles.some(tile => tile.lod !== 0)
    || before.files.some(file => hashes.has(file.hash))) throw new Error('Nalati L1 extension inventory differs');
  const key = (tile: { readonly lod: number; readonly x: number; readonly z: number }): string => `${String(tile.lod)}:${String(tile.x)}:${String(tile.z)}`;
  const keys = new Set(added.map(key)), originalHashes = new Set(current.files.map(file => file.hash));
  same(header.tiles, current.tiles, 'current tiles');
  same(headerProps, current.props, 'current bindings');
  same(header.files.filter(file => originalHashes.has(file.hash)), [...current.files].sort((a, b) => a.hash.localeCompare(b.hash)), 'current files');
  const restored = { files: current.files.filter(file => !hashes.has(file.hash)),
    tiles: current.tiles.filter(tile => !keys.has(key(tile))),
    props: { ...current.props, tiles: current.props.tiles.filter(tile => !hashes.has(tile.file)) } };
  same(restored, before, 'all original render rows');
  return { ...header, files: header.files.filter(file => !hashes.has(file.hash)),
    tiles: header.tiles.filter(tile => !keys.has(key(tile))),
    props: { ...headerProps, tiles: headerProps.tiles.filter(tile => !hashes.has(tile.file)) } };
}
