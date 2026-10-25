#!/usr/bin/env node
// Controlled compile-only kernel, never a page-memory or WebKit verdict.
// node --expose-gc --experimental-vm-modules scripts/js-payload-heap.mjs CHUNK.js
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SourceTextModule } from 'node:vm';
import { getHeapCodeStatistics } from 'node:v8';

const file = process.argv[2];
if (file === undefined || !file.endsWith('.js') || typeof globalThis.gc !== 'function') throw new Error('Expected a JS chunk and --expose-gc --experimental-vm-modules');
const wire = readFileSync(file);
if (wire.length === 0 || wire.length > 32 * 1024 * 1024) throw new Error('Invalid chunk size');
globalThis.gc();
const before = process.memoryUsage(), beforeCode = getHeapCodeStatistics();
const compiled = new SourceTextModule(wire.toString('utf8'), { identifier: resolve(file) });
globalThis.gc();
const after = process.memoryUsage(), afterCode = getHeapCodeStatistics();
console.log(JSON.stringify({ file: compiled.identifier, node: process.version, rawBytes: wire.length,
  before, after, heapDeltaBytes: after.heapUsed - before.heapUsed,
  externalDeltaBytes: after.external - before.external,
  heapAndExternalDeltaBytes: after.heapUsed + after.external - before.heapUsed - before.external,
  bytecodeDeltaBytes: afterCode.bytecode_and_metadata_size - beforeCode.bytecode_and_metadata_size,
  limits: 'Isolated Node/V8 module compilation only: imports are not linked, code is not evaluated. Explicit GC occurs only in this offline kernel. Source bytes are buffered before baseline; the compiled source string and metadata stay live. Not whole-page, retained JSON, iOS or native G682 memory.' }));
