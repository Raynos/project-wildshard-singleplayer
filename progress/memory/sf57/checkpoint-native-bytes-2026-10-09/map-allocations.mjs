import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), { TraceMap, originalPositionFor } = require('/Users/raynos/node_modules/@jridgewell/trace-mapping');
const [input, dist, out] = process.argv.slice(2), data = JSON.parse(readFileSync(input, 'utf8')), maps = new Map();
function original(url, line, column) {
  if (!url.startsWith('http:')) return null;
  const path = new URL(url).pathname;
  try {
    if (!maps.has(path)) maps.set(path, new TraceMap(JSON.parse(readFileSync(join(dist, path + '.map'), 'utf8'))));
    return originalPositionFor(maps.get(path), { line, column });
  } catch { return null; }
}
const rows = data.buffers.rows.map(row => ({ ...row, sources: [...row.stack.matchAll(/(http:\/\/127\.0\.0\.1:\d+\/[^\s():]+):(\d+):(\d+)/gu)].map(match => original(match[1], Number(match[2]), Number(match[3]) - 1)).filter(Boolean) }));
const frames = [];
function walk(node) {
  if (node.selfSize > 0) frames.push({ selfSize: node.selfSize, frame: node.callFrame, source: original(node.callFrame.url, node.callFrame.lineNumber + 1, node.callFrame.columnNumber) });
  for (const child of node.children) walk(child);
}
walk(data.profile.head);
frames.sort((a,b) => b.selfSize - a.selfSize);
writeFileSync(out, JSON.stringify({ version: data.version, errors: data.errors, routes: data.routes.map(row => ({ name:row.name,failures:row.failures })), constructors: rows, largeConstructorCount: data.buffers.count, estimatedConstructorBytes: data.buffers.bytes, boxedArrayCount: rows.filter(row => row.name==='Array').length, boxedArrayElements: rows.filter(row => row.name==='Array').reduce((sum,row)=>sum+row.elements,0), sampledFrames: frames },null,2));
console.log(out, 'boxed arrays', rows.filter(row => row.name==='Array').map(row=>({elements:row.elements,source:row.sources[0]})));
