// SF57 leak5: rewrite minified production frames on stdin to source file:line via the build's source maps.
//   node symstack.mjs <dist dir> <file>
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/Users/raynos/projects/games/wildshard-singleplayer/node_modules/.pnpm/node_modules/');
const { SourceMapConsumer } = require('source-map-js');
const dist = process.argv[2]; const maps = new Map();
const input = readFileSync(process.argv[3] ?? 0, 'utf8');
console.log(input.replace(/http:\/\/127\.0\.0\.1:\d+\/assets\/([^/:]+\.js):(\d+):(\d+)/g, (m, a, l, c) => {
  if (!maps.has(a)) { const p = `${dist}/assets/${a}.map`; maps.set(a, existsSync(p) ? new SourceMapConsumer(JSON.parse(readFileSync(p, 'utf8'))) : null); }
  const k = maps.get(a); if (!k) return m;
  const pos = k.originalPositionFor({ line: Number(l), column: Number(c) - 1 });
  return pos.source ? `${pos.source.replace(/^.*?(src\/|node_modules\/)/, '$1')}:${pos.line} ${pos.name ?? ''}` : m;
}));
