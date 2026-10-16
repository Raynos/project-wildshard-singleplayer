// Today's ruler on whatever tree is the cwd (a build-mirror slot synced to an old commit): G458's source-basis custom
// lines per shard, from the live checkout's scripts/shard-platform.mjs (sourceProgressLines). Prints one JSON line.
//   node scripts/build-mirror.mjs run <sha> --slot check -- node <repo>/progress/shard-platform/custom-vs-hours-2026-10-16/measure.mjs
import { resolve } from 'node:path';

const repo = resolve(import.meta.dirname, '../../..');
const { sourceProgressLines } = await import(`${repo}/scripts/shard-platform.mjs`);
const rows = sourceProgressLines(process.cwd());
console.log(JSON.stringify(Object.fromEntries(Object.entries(rows).map(([slug, r]) => [slug, { custom: r.customLines, legacy: r.legacyLines }]))));
