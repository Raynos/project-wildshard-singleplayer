import { expect, test } from 'vitest';
import { facadeWindowPackets } from '../src/shards/nine-dragon-stack/generators/facadeWindowPackets';
import { facadeWindowBlobs } from '../src/shards/nine-dragon-stack/generators/facadeWindows';
import { addWindowNodes } from '../src/shards/nine-dragon-stack/generators/facadeWindowRecipe';
import { parseWorldScene } from '../src/format/clientChannels';
import { NINE_WORLD_SCENES } from '../src/shards/nine-dragon-stack/generators/worldScenes';

test('binary window rows cover each original packet exactly in its existing three draws', () => {
  const packets = facadeWindowBlobs(), rows = facadeWindowPackets();
  expect(rows.map(row => row.count)).toEqual([4096, 4096, 1720]);
  for (const [i, row] of rows.entries()) {
    const packet = packets[i]; if (packet === undefined) throw new Error('Missing source window packet');
    let end = 0;
    for (const attribute of row.attributes) {
      expect(attribute.packet.file).toBe(packet.file.name);
      expect(attribute.packet.storage).toBe('f32');
      expect(attribute.packet.byteOffset).toBe(end);
      expect(attribute.packet.count).toBe(row.count);
      end += attribute.packet.count * attribute.width * 4;
    }
    expect(end).toBe(packet.bytes.length);
  }
});

test('the window draws fit the two existing recipe envelopes without embedded matrix arrays', () => {
  const empty = parseWorldScene({ imports: [], scene: { version: 1, root: 'root', textures: [], materials: [], nodes: [{ kind: 'group', id: 'root', children: [] }] } });
  const dressing = addWindowNodes(empty, [0, 1]), cards = addWindowNodes(empty, [2]);
  const copies = (recipe: typeof empty): number => recipe.scene.nodes.reduce((sum, node) => sum + (node.kind === 'mesh' ? node.instances ?? 0 : 0), 0);
  expect(copies(dressing)).toBe(8192); expect(copies(cards)).toBe(1720);
  for (const node of [...dressing.scene.nodes, ...cards.scene.nodes]) if (node.kind === 'mesh') expect(node.matrices).toBeUndefined();
});

test('admitted window steps keep independent mutable geometry ports and the original packet bindings', () => {
  for (const [id, indices] of [['dressing', [0, 1]], ['cards-open', [2]], ['cards-capped', [2]]] as const) {
    const step = NINE_WORLD_SCENES.steps.find(row => row.id === id);
    if (step === undefined) throw new Error(`Missing window step ${id}`);
    const rows = facadeWindowPackets().filter((_, index) => indices.some(value => value === index));
    expect(step.instanceAttributes).toEqual(rows.flatMap(row => row.attributes));
    for (const row of rows) {
      expect(step.geometry[`window-quad-${row.id}`]).toEqual({ library: 'shapes', model: 'window-quad' });
      expect(step.publish[row.id]).toEqual({ kind: 'object', part: row.id });
    }
  }
});
