// Download bench (E525): the boot's downloads, headless, on a virtual phone link.
//
//   node --experimental-transform-types --import ./scripts/bake-loader.mjs scripts/download-bench/main.mjs <command>
//
//   spawn   [--base URL]           the real downloadSpawnManifest (src/game/client/boot/spawnDownload.ts) on the link
//   levers  [--base URL] [--brotli] every download lever, measured on the spawn set (mirror checked against `spawn`)
//   replay  <phone-loading.json>…  the whole recorded boot graph replayed: as recorded, free CPU, free network, faster links
//
// Options: --preset phone|lte|fast5g (default phone = scripts/phone-loading `phone`: 10 Mb/s, 100 ms),
//          --server-ms N (server think time added to each request; default 0), --json (machine output).
// --base defaults to live. Bodies are fetched once into tmp/download-spike/bodies/ (see bodies.mjs).
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { body } from './bodies.mjs';
import { extractGraph, replay } from './graph.mjs';
import { bundleSmall, brotliBest, mirror, packed } from './levers.mjs';
import { createLink, PRESETS } from './link.mjs';
import { runRealSpawn, spawnAddress, spawnFiles } from './spawn.mjs';

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  base: { type: 'string', default: 'https://wildshard-singleplayer.vercel.app/' },
  preset: { type: 'string', default: 'phone' }, 'server-ms': { type: 'string', default: '0' },
  brotli: { type: 'boolean', default: false }, json: { type: 'boolean', default: false },
} });
const [command, ...rest] = positionals;
const preset = /** @type {Record<string, import('./link.mjs').LinkOptions>} */ (PRESETS)[values.preset ?? 'phone'];
if (preset === undefined) throw new Error(`unknown preset ${values.preset}`);
const link = { ...preset, serverMs: Number(values['server-ms']) };
const base = values.base ?? '';
const s = (/** @type {number} */ ms) => Number((ms / 1000).toFixed(2));
const mb = (/** @type {number} */ bytes) => Number((bytes / 1e6).toFixed(2));

/** @type {Record<string, unknown>[]} */ const rows = [];
const row = (/** @type {Record<string, unknown>} */ r) => { rows.push(r); if (!values.json) console.log(Object.entries(r).map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`).join('  ')); };

if (command === 'spawn') {
  const r = await runRealSpawn(base, link);
  row({ run: 'real downloadSpawnManifest', seconds: s(r.ms), wireMB: mb(r.stats.bytes), requests: r.stats.requests, manifest: r.address.url });
} else if (command === 'levers') {
  const address = await spawnAddress(base), { files } = await spawnFiles(base, address);
  const manifestWire = (await body(new URL(address.url, base).href)).meta.wireBytes;
  const wire = files.reduce((t, f) => t + f.wireBytes, 0);
  const real = await runRealSpawn(base, link);
  const m = (/** @type {typeof files} */ set, opts = {}, l = link) => mirror(set, l, { manifestBytes: manifestWire, ...opts });
  const baseline = await m(files);
  row({ lever: 'check: mirror(8 lanes) vs real module', mirror: s(baseline), real: s(real.ms) });
  row({ lever: 'floor: wire bytes / bandwidth', seconds: s((wire + manifestWire) / link.downBps * 1000), wireMB: mb(wire), files: files.length });
  row({ lever: 'baseline: 8 lanes, HTTP/2', seconds: s(baseline) });
  for (const lanes of [4, 16, 32, 1000]) row({ lever: `lanes ${lanes}`, seconds: s(await m(files, { lanes })) });
  row({ lever: 'HTTP/1.1: 6 connections', seconds: s(await m(files, {}, { ...link, maxConns: 6 })) });
  row({ lever: 'bundle files < 64 KB into one pack', seconds: s(await m(bundleSmall(files))), requests: bundleSmall(files).length });
  for (const n of [1, 4, 16]) row({ lever: `${n} pack(s) for the whole set`, seconds: s(await m(packed(files, n), { lanes: Math.max(1, n) })) });
  const isKind = (/** @type {string} */ k) => (/** @type {{ url: string }} */ f) => new URL(f.url).pathname.includes(`/${k}/`) || new URL(f.url).pathname.endsWith(`.${k}`);
  const uncompressed = files.filter(f => f.encoding === 'identity');
  row({ lever: 'served without compression', files: uncompressed.length, wireMB: mb(uncompressed.reduce((t, f) => t + f.wireBytes, 0)), kinds: [...new Set(uncompressed.map(f => f.contentType))] });
  // defer: the set minus a kind (what each kind costs on the link)
  for (const kind of ['js', 'glb', 'bin', 'ktx2', 'wasm', 'json', 'image']) {
    const kept = files.filter(f => !isKind(kind)(f));
    row({ lever: `defer every ${kind}`, seconds: s(await m(kept)), savedMB: mb((wire - kept.reduce((t, f) => t + f.wireBytes, 0))) });
  }
  const bySize = [...files].sort((a, b) => a.wireBytes - b.wireBytes);
  for (const keepMB of [6, 4]) {
    let acc = 0; const kept = bySize.filter(f => (acc += f.wireBytes) <= keepMB * 1e6);
    row({ lever: `only ${keepMB} MB before control (smallest files first)`, seconds: s(await m(kept)), files: kept.length });
    row({ lever: `only ${keepMB} MB, small files bundled`, seconds: s(await m(bundleSmall(kept))), requests: bundleSmall(kept).length });
    row({ lever: `only ${keepMB} MB, one pack, started at the title`, seconds: s(Math.max(0, await m(packed(kept, 1)) - 3000)) });
  }
  row({ lever: 'start at the title (3 s earlier: harness title dwell)', seconds: s(Math.max(0, baseline - 3000)) });
  for (const [name, p] of Object.entries(PRESETS)) row({ lever: `link ${name}`, seconds: s(await m(files, {}, { ...p })) });
  if (values.brotli) {
    const best = await brotliBest(files);
    row({ lever: 'brotli q11 for every body (min of served, q11)', seconds: s(await m(best)), wireMB: mb(best.reduce((t, f) => t + f.wireBytes, 0)) });
    const ktx = await brotliBest(files.filter(isKind('ktx2')));
    row({ lever: 'brotli q11 on KTX2 only', ktx2MB: mb(files.filter(isKind('ktx2')).reduce((t, f) => t + f.wireBytes, 0)), brMB: mb(ktx.reduce((t, f) => t + f.wireBytes, 0)) });
  }
} else if (command === 'replay') {
  for (const file of rest) {
    const g = extractGraph(JSON.parse(readFileSync(file, 'utf8')));
    /** @type {Record<string, number>} */ const out = {};
    for (const [k, l, cpu] of /** @type {[string, import('./link.mjs').LinkOptions, number][]} */ ([['asRecorded', link, 1], ['freeCpu', link, 0], ['freeNet', { downBps: 1e12, latencyMs: 0 }, 1], ['lte', PRESETS.lte, 1], ['fast5g', PRESETS.fast5g, 1]])) {
      out[k] = s((await replay(g, createLink(l), { cpu })).controlMs);
    }
    row({ run: file.split('/').at(-2), recorded: s(g.recordedMs), ...out, requests: g.nodes.length, wireMB: mb(g.nodes.reduce((t, n) => t + n.bytes, 0)) });
  }
} else {
  console.log('usage: main.mjs spawn | levers [--brotli] | replay <phone-loading.json>… [--base URL] [--preset phone|lte|fast5g]');
  if (command !== undefined) throw new Error(`unknown command ${command}`);
}
if (values.json) console.log(JSON.stringify(rows, null, 1));
