// oxlint-disable-next-line import/no-nodejs-modules -- Run the build-only plot generators (plain .mjs) in Node, as the kit test does.
import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';

// RM14 (night-market-remaster): a second idea is a style row, not generator code. The same layout built through the same
// kit.mjs / kitGlb.mjs with a second palette retints the shared kit library by palette slot and changes nothing else.
test('a second style row retints the shared kit by palette slot with no generator change', () => {
  const kit = new URL('../src/shards/open-plots/generators/kit.mjs', import.meta.url).href;
  const glb = new URL('../src/shards/open-plots/generators/kitGlb.mjs', import.meta.url).href;
  const program = `import {readFileSync} from 'node:fs';
import {buildLayout, parseLayout, Soup} from ${JSON.stringify(kit)};
import {prepareModelKit} from ${JSON.stringify(glb)};
import {normalizeWorldGlb} from ${JSON.stringify(new URL('../src/sdk/bake/world.ts', import.meta.url).href)};
const layout = JSON.parse(readFileSync('src/shards/open-plots/data/layouts/night-market.json', 'utf8'));
const linear = hex => [1, 3, 5].map(at => { const c = Number.parseInt(hex.slice(at, at + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
const files = new Map(layout.kit.map(family => [family, new Uint8Array(readFileSync('public/assets/open-plots/kit/' + family + '.glb'))]));
const build = async hexes => {
  const palette = Object.fromEntries(Object.entries(hexes).map(([key, hex]) => [key, linear(hex)])); palette.picture = [0.2, 0.2, 0.2];
  const parts = Object.fromEntries(['Paving', 'Kit', 'Water', 'Glow', 'Pool', 'Poster', 'far', 'solid', 'detailKit', 'detailGlow', 'coarse'].map(name => [name, new Soup()]));
  const models = await prepareModelKit(palette, files,normalizeWorldGlb);
  buildLayout(parseLayout(layout.rows), parts, palette, (r, c) => (r * 7 + c * 3) % 2, { ...models, lanternEmitter: () => undefined });
  const colours = parts.detailKit.part('detailKit').colours, green = [];
  for (let i = 0; i < colours.length; i += 3) if (colours[i] === 0 && colours[i + 2] === 0 && colours[i + 1] > 0) green.push(i);
  return { vertices: colours.length / 3, green: green.length, positions: parts.detailKit.part('detailKit').positions.length };
};
const night = await build(layout.palette), second = await build({ ...layout.palette, roof: '#00ff00' });
console.log(JSON.stringify({ night, second }));`;
  const out: unknown = JSON.parse(execFileSync(process.execPath, ['--import', './scripts/bake-loader.mjs', '--input-type=module', '-e', program], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim().split('\n').at(-1) ?? 'null');
  const rows = out as { night: { vertices: number; green: number; positions: number }; second: { vertices: number; green: number; positions: number } };
  // the same layout places the same models: the same geometry, only the roof slot's colour moved
  expect(rows.second.positions).toBe(rows.night.positions);
  expect(rows.night.green).toBe(0);
  expect(rows.second.green).toBeGreaterThan(1000);
  expect(rows.second.green).toBeLessThan(rows.second.vertices);
}, 240_000);
