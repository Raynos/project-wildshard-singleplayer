// oxlint-disable-next-line import/no-nodejs-modules -- Run the build-only plot generators (plain .mjs) in Node, as the kit test does.
import { execFileSync } from 'node:child_process';
import { expect, test } from 'vitest';

// RM14 (night-market-remaster): a second idea is a style row, not generator code. The same layout built through the same
// kit.mjs / kitGlb.mjs with different tile letters and a second palette retints the shared library without changing its geometry.
test('a second style row retints the shared kit by palette slot with its own tile letters', () => {
  const kit = new URL('../src/shards/open-plots/generators/kit.mjs', import.meta.url).href;
  const glb = new URL('../src/shards/open-plots/generators/kitGlb.mjs', import.meta.url).href;
  const builders = new URL('../src/shards/open-plots/generators/nightMarket.mjs', import.meta.url).href;
  const program = `import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {buildLayout, parseLayout, Soup} from ${JSON.stringify(kit)};
import {nightMarketBuilders} from ${JSON.stringify(builders)};
import {prepareModelKit} from ${JSON.stringify(glb)};
import {normalizeWorldGlb} from ${JSON.stringify(new URL('../src/sdk/bake/world.ts', import.meta.url).href)};
const layout = JSON.parse(readFileSync('src/shards/open-plots/data/layouts/night-market.json', 'utf8'));
const linear = hex => [1, 3, 5].map(at => { const c = Number.parseInt(hex.slice(at, at + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
const files = new Map(layout.kit.map(family => [family, new Uint8Array(readFileSync('public/assets/open-plots/kit/' + family + '.glb'))]));
const build = async (hexes, rows, tiles) => {
  const palette = Object.fromEntries(Object.entries(hexes).map(([key, hex]) => [key, linear(hex)])); palette.picture = [0.2, 0.2, 0.2];
  const parts = Object.fromEntries(['Paving', 'Kit', 'Water', 'Glow', 'Pool', 'Poster', 'far', 'solid', 'detailKit', 'detailGlow', 'coarse'].map(name => [name, new Soup()]));
  const models = await prepareModelKit(palette, files,normalizeWorldGlb);
  buildLayout(parseLayout(rows, tiles), parts, palette, (r, c) => (r * 7 + c * 3) % 2, { ...models, lanternEmitter: () => undefined }, tiles);
  const colours = parts.detailKit.part('detailKit').colours, green = [];
  for (let i = 0; i < colours.length; i += 3) if (colours[i] === 0 && colours[i + 2] === 0 && colours[i + 1] > 0) green.push(i);
  return { vertices: colours.length / 3, green: green.length, positions: parts.detailKit.part('detailKit').positions.length, positionsHash: createHash('sha256').update(JSON.stringify(parts.detailKit.part('detailKit').positions)).digest('hex') };
};
const mapping = { H:'A', G:'B', S:'D', C:'E', L:'F', N:'I', P:'J' };
const rows = layout.rows.map(row => row.split(/\\s+/u).map(cell => mapping[cell[0]] + cell.slice(1)).join(' '));
const letters = { A:'house', B:'garden', D:'stalls', E:'canal', F:'bend', I:'forecourt', J:'plaza' };
const night = await build(layout.palette, layout.rows, nightMarketBuilders()), second = await build({ ...layout.palette, roof: '#00ff00' }, rows, nightMarketBuilders(letters));
console.log(JSON.stringify({ night, second }));`;
  const out: unknown = JSON.parse(execFileSync(process.execPath, ['--import', './scripts/bake-loader.mjs', '--input-type=module', '-e', program], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim().split('\n').at(-1) ?? 'null');
  const rows = out as { night: { vertices: number; green: number; positions: number; positionsHash: string }; second: { vertices: number; green: number; positions: number; positionsHash: string } };
  // the same layout places the same models: the same geometry, only the roof slot's colour moved
  expect(rows.second.positions).toBe(rows.night.positions);
  expect(rows.second.positionsHash).toBe(rows.night.positionsHash);
  expect(rows.night.green).toBe(0);
  expect(rows.second.green).toBeGreaterThan(1000);
  expect(rows.second.green).toBeLessThan(rows.second.vertices);
}, 240_000);
