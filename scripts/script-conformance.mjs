#!/usr/bin/env node
// The only cross-engine sim gate: exact script inputs + recorded physics replies, Node V8 versus Playwright WebKit.
// Run through scripts/browser-lane.sh; no game, audio, device chores or preview server is needed.
import { build } from 'vite';
import { webkit, devices } from 'playwright';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { compileScript } from './compile-script.mjs';
import { CONFORMANCE_SOURCE } from '../test/fixtures/script-conformance/source.mjs';

const root = resolve(import.meta.dirname, '..');
const bytes = await compileScript(CONFORMANCE_SOURCE), ticks = 120;
const queries = Array.from({ length: ticks }, (_v, i) => [1, 2].map((entity) => ({ kind: (i + 1) % 4 + 1, input: Array.from({ length: 8 }, (_n, at) => i + 1 + at), entity, reply: [entity * 0.25, i + 1, 0] }))).flat();
const input = { bytes: Array.from(bytes), queries, ticks, checkpoint: 37 };
const bundled = await build({ root, configFile: false, publicDir: false, logLevel: 'warn', build: { write: false, minify: false, lib: { entry: resolve(root, 'test/fixtures/script-conformance/run.ts'), formats: ['es'] } } });
const outputs = Array.isArray(bundled) ? bundled : [bundled];
const chunk = outputs.flatMap((output) => output.output).find((output) => output.type === 'chunk' && output.isEntry);
if (chunk?.type !== 'chunk') throw new Error('Missing conformance runner bundle');
const url = `data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`;
/** @type {unknown} */
const api = await import(url);
/** @param {unknown} value @returns {value is {runConformance:(input: typeof input)=>unknown}} */
function isRunner(value) { return typeof value === 'object' && value !== null && 'runConformance' in value && typeof value.runConformance === 'function'; }
if (!isRunner(api)) throw new Error('Invalid conformance runner');
const expected = JSON.stringify(api.runConformance(input));
const browser = await webkit.launch({ headless: true });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'] });
  const page = await context.newPage();
  // Muting does not depend on a game URL or WebKit support for Chromium's --mute-audio flag.
  await page.addInitScript(() => { HTMLMediaElement.prototype.play = () => Promise.resolve(); });
  await page.goto('about:blank');
  const result = await page.evaluate(async ({ moduleUrl, tape }) => {
    const loaded = await import(moduleUrl);
    return JSON.stringify(loaded.runConformance(tape));
  }, { moduleUrl: url, tape: input });
  if (result !== expected) throw new Error('Node/WebKit effects, fuel or restored state differ');
  console.log(JSON.stringify({ gate: 'script-conformance', pass: true, engines: ['Node V8', 'Playwright WebKit'], ticks, calls: ticks * 2, queries: queries.length, checkpoint: input.checkpoint, wasmBytes: bytes.length, transcriptHash: createHash('sha256').update(expected).digest('hex') }));
} finally { await browser.close(); }
