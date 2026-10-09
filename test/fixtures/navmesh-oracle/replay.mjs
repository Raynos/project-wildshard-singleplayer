// SF72 navmesh oracle, plain Node (scripts/sim-node-loader.mjs refuses any renderer module): every shard's baked
// navmesh.bin read from disk, parsed by the renderer-free src/engine/physics/navmesh.ts and asked the recorded queries.
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { parseNavmesh } from '../../../src/engine/physics/navmesh';
import { ORACLE_SHARDS, oracleQueries } from './queries';

const recorded = JSON.parse(readFileSync(new URL('./source.json', import.meta.url), 'utf8')).shards;
const result = {};
ORACLE_SHARDS.forEach((slug, i) => {
  const bytes = readFileSync(new URL(`../../../public/assets/baked/${slug}/navmesh.bin`, import.meta.url));
  const nav = parseNavmesh(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  if (nav === null) throw new Error(`${slug}: navmesh.bin did not parse`);
  const answers = JSON.parse(JSON.stringify(oracleQueries(nav, 7200 + i)));
  const want = recorded[slug];
  const first = answers.findIndex((a, k) => !isDeepStrictEqual(a, want[k]));
  result[slug] = { layers: nav.layers.map((l) => l.radius), queries: answers.length, recorded: want.length, firstDifference: first };
});
process.stdout.write(`${JSON.stringify(result)}\n`);
