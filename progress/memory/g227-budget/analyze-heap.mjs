// Use WebKit's own dominators/shortest-root algorithm, with exact source integrity.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { gunzipSync } from 'node:zlib';
const [input, algorithmFile] = process.argv.slice(2);
if (!input) throw new Error('Pass INPUT.heap.json[.gz] [official HeapSnapshot.js]');
const algorithm = 'https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WebInspectorUI/UserInterface/Workers/HeapSnapshot/HeapSnapshot.js';
const expected = '16b13b7737ed4f83615fd971c40966dd43c22e0d9e42769632a747520d4280d4';
const source = algorithmFile ? readFileSync(algorithmFile, 'utf8') : await (await fetch(algorithm)).text();
const hash = createHash('sha256').update(source).digest('hex');
if (hash !== expected) throw new Error('WebKit heap algorithm changed; review it before changing the recorded integrity');
const context = { console }; vm.createContext(context); vm.runInContext(source, context);
const bytes = readFileSync(input), text = (input.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString('utf8');
const data = JSON.parse(text);
if (data.version !== 3 || data.nodes.length % 4 !== 0) throw new Error('Expected WebKit Inspector v3 nodes');
const heap = new context.HeapSnapshot(1, 1, text), rows = [], retained = [];
for (let i = 0; i < data.nodes.length; i += 4) {
  const row = { id: data.nodes[i], size: data.nodes[i + 1], class: data.nodeClassNames[data.nodes[i + 2]] };
  if (row.size >= 500000) rows.push(row);
  const retainedSize = heap._nodeOrdinalToRetainedSizes[i / 4];
  if (retainedSize >= 1000000 && row.id !== 0) retained.push({ ...row, retainedSize });
}
rows.sort((a, b) => b.size - a.size); retained.sort((a, b) => b.retainedSize - a.retainedSize);
const detail = row => ({ ...row, node: heap.nodeWithIdentifier(row.id), path: heap.shortestGCRootPath(row.id), retainers: heap.retainers(row.id) });
// Small source-level suspects can be absent from the largest-object tables. Match the exact property pair, not size.
const propertyPairs = new Map(), propertyType = data.edgeTypes.indexOf('Property');
for (let i = 0; i < data.edges.length; i += 4) {
  if (data.edges[i + 2] !== propertyType) continue;
  const name = data.edgeNames[data.edges[i + 3]];
  if (name !== 'plain' && name !== 'ao') continue;
  const owner = data.edges[i], fields = propertyPairs.get(owner) ?? {};
  fields[name] = heap.nodeWithIdentifier(data.edges[i + 1]); propertyPairs.set(owner, fields);
}
const colourBackups = [...propertyPairs].filter(([, fields]) => fields.plain && fields.ao).map(([id, fields]) => ({
  owner: heap.nodeWithIdentifier(id), fields, path: heap.shortestGCRootPath(id), retainers: heap.retainers(id),
}));
const report = { source: input, algorithm, algorithmSha256: hash, totalReportedBytes: heap._totalSize, categories: heap._categories,
  note: 'Heap/external payload categories are subsets of WC. Nested dominator retained sizes overlap; never sum them. Native-root-only ArrayBuffers require exact identity, not equal-size owner guesses.',
  colourBackups, largest: rows.slice(0, 80).map(detail), largestRetained: retained.slice(0, 60).map(detail) };
const out = input.replace(/\.heap\.json(?:\.gz)?$/u, '.heap-analysis.json');
if (out === input) throw new Error('Input name must end .heap.json[.gz]');
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ out, totalReportedBytes: report.totalReportedBytes, largest: rows.slice(0, 12), largestRetained: retained.slice(0, 8) }, null, 2));
