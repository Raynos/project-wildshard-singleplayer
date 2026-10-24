import { expect, test } from 'vitest';
import { prepareAssetDecoders } from '../src/format/product';
import { hashImmutableBytes } from '../src/sdk/immutable';
import { nineWorldLayout } from '../src/shards/nine-dragon-stack/generators/worldProduct';
import { nineLayoutSource } from '../src/shards/nine-dragon-stack/generators/layout';
import { withPortableMath } from '../src/commons/bake/portableMath';
import { bakedLayout, bakedLayoutProjection } from '../src/shards/nine-dragon-stack/generators/layoutProjection';
import { facadeWindowBlobs, type NineWindowLayout } from '../src/shards/nine-dragon-stack/generators/facadeWindows';
import { facadeWindowPackets } from '../src/shards/nine-dragon-stack/generators/facadeWindowPackets';
import { addWindowNodes, windowStep } from '../src/shards/nine-dragon-stack/generators/facadeWindowRecipe';
import { parseWorldScene } from '../src/format/clientChannels';

test('owned layout rows preserve every original projection and facade packet byte', async () => {
  await prepareAssetDecoders();
  const layout = withPortableMath(() => nineWorldLayout(nineLayoutSource()));
  expect(bakedLayout(layout)).toEqual(bakedLayout());
  expect(bakedLayoutProjection(layout)).toEqual(bakedLayoutProjection());
  const packets = (source?: NineWindowLayout) => facadeWindowBlobs(source).map(row => ({
    file: row.file, bytes: row.bytes.byteLength, hash: hashImmutableBytes(row.bytes),
  }));
  expect(packets(layout)).toEqual(packets());
  expect(facadeWindowPackets(layout)).toEqual(facadeWindowPackets());
  expect(windowStep([0, 1, 2], layout)).toEqual(windowStep([0, 1, 2]));
  expect(bakedLayoutProjection(layout, { lanterns: [] }).fixed.lanterns).toEqual([]);
  expect(() => bakedLayout({ ...layout, count: layout.count + 1 })).toThrow('record inventory');
  expect(() => bakedLayout({ ...layout, records: [undefined, ...layout.records.slice(1)] })).toThrow('record inventory');
});

test('a supplied window layout controls records, packet bindings and recipe instance counts', () => {
  const source: NineWindowLayout = { rows: { counts: { walkers: 0, sitters: 0, lanterns: 0, acs: 0,
    hooks: 0, hookMounts: 0, steam: 0, pieces: 0, windows: 1 } },
    records: Array.from({ length: 26 }, (_, index) => index === 0 ? '-0' : index + 0.25) };
  const blobs = facadeWindowBlobs(source), packets = facadeWindowPackets(source);
  expect(blobs).toHaveLength(1); expect(packets).toHaveLength(1);
  const blob = blobs[0];
  if (blob === undefined) throw new Error('Missing supplied window packet');
  expect(new Float32Array(blob.bytes.buffer, blob.bytes.byteOffset, 26)).toEqual(Float32Array.from(source.records, Number));
  expect(packets[0]?.count).toBe(1);
  expect(windowStep([0], source).instanceAttributes.map(row => row.packet?.count)).toEqual([1, 1, 1, 1]);
  const empty = parseWorldScene({ imports: [], scene: { version: 1, root: 'root', textures: [], materials: [], nodes: [{ kind: 'group', id: 'root', children: [] }] } });
  const recipe = addWindowNodes(empty, [0], source);
  expect(recipe.scene.nodes.filter(row => row.kind === 'mesh').map(row => row.instances)).toEqual([1]);
});
