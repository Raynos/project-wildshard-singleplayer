// oxlint-disable-next-line import/no-nodejs-modules -- Run the real producer behind the unchanged native simulation loader guard.
import { execFileSync } from 'node:child_process';
import { BoxGeometry } from 'three';
import { expect, test } from 'vitest';
import { nativeSpecimenCatalogue } from '../src/shards/driftwood-isle/generators/nativeSpecimens';
import inventory from '../src/shards/driftwood-isle/data/fixedGeometry.json' with { type: 'json' };

test('the complete native rest catalogue is renderer-free and retains exact cross-realm bytes', () => {
  const geometry = new Map(inventory.draws.map((draw, index) => [draw.slot, new BoxGeometry(0.2 + index / 1000, 0.3, 0.4).translate(index / 1000, 0, 0)]));
  try {
    const expected = nativeSpecimenCatalogue(geometry, inventory.groups.npc);
    const code = `import { BoxGeometry } from 'three';
      import { nativeSpecimenCatalogue } from './src/shards/driftwood-isle/generators/nativeSpecimens.ts';
      import inventory from './src/shards/driftwood-isle/data/fixedGeometry.json' with { type: 'json' };
      const geometry = new Map(inventory.draws.map((draw, index) => [draw.slot, new BoxGeometry(0.2 + index / 1000, 0.3, 0.4).translate(index / 1000, 0, 0)]));
      try { console.log(JSON.stringify(nativeSpecimenCatalogue(geometry, inventory.groups.npc))); }
      finally { for (const shape of geometry.values()) shape.dispose(); }`;
    const output = execFileSync(process.execPath, ['--experimental-transform-types', '--import', './scripts/sim-node-loader.mjs', '--input-type=module', '-e', code], { encoding: 'utf8', timeout: 30_000 });
    expect(output.trim()).toBe(JSON.stringify(expected));
    expect(expected.models).toHaveLength(4);
  } finally { for (const shape of geometry.values()) shape.dispose(); }
});
