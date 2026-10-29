import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {assembleOutputShardfile, parseOutputIndex} from '../../src/format/outputIndex';
import {entryReadSet} from './entryReadSet';
import {bootProductTotals} from './bootProducts';
import type {EntryDownloadRow} from '../../src/game/shardfile/entryTransport';
import ts from '@typescript/typescript6';
import {gridEntryDownloads} from './gridEntryDownloads';
import {entryTotals} from './entryTotals';

/** Read-ahead addresses only: the browser still runs original per-file
 * admission. Packs keep their original phase boundaries and complete hashes. */
export function writeEntryDownloads(outDir: string, root: string): {entryDownloads: Readonly<Record<string, Readonly<Record<'phone' | 'desktop', string>>>>; entryIndexes: Readonly<Record<string, string>>} {
  const result: Record<string, Record<'phone' | 'desktop', string>> = {}, indexes: Record<string, string> = {};
  for (const prefix of Object.keys(bootProductTotals(root))) {
    const directory = prefix.split('/')[2];
    if (directory === undefined) throw new Error('Missing entry product directory');
    const product = resolve(root, 'out', directory), bytes = readFileSync(join(product, 'shard.json'));
    const input: unknown = JSON.parse(bytes.toString('utf8')), index = parseOutputIndex(input);
    if (index.runtime !== null && (!('kind' in index.runtime) || index.runtime.kind !== 'client-plan')) continue;
    const sections = new Map<string, unknown>();
    for (const row of index.sections) {
      const body = readFileSync(join(product, row.path));
      if (body.length !== row.bytes || createHash('sha256').update(body).digest('hex') !== row.hash) throw new Error('Entry section differs from index');
      sections.set(row.name, JSON.parse(body.toString('utf8')));
    }
    const source = assembleOutputShardfile(input, sections);
    indexes[directory] = `${prefix}shard.json?v=${createHash('sha256').update(bytes).digest('hex').slice(0, 8)}`;
    const pair = {phone: '', desktop: ''};
    for (const tier of ['phone', 'desktop'] as const) {
    const wanted = entryReadSet(source, tier, index, sections);
    const rows: EntryDownloadRow[] = [], packed = new Set<string>(), metadata = new Set([...index.sections, ...index.schemas].map(row => row.hash));
    for (const pack of index.packs ?? []) {
      if (!pack.entries.some(row => wanted.has(row.hash))) continue;
      rows.push({path: `${prefix}${pack.path}`, bytes: pack.bytes, members: pack.entries.map(row => row.hash), phase: pack.entries.every(row => metadata.has(row.hash)) ? 'metadata' : 'body'});
      for (const row of pack.entries) packed.add(row.hash);
    }
    for (const file of [...index.sections, ...index.schemas, ...index.files.map(row => ({path: row.path, hash: row.hash, bytes: row.compressed}))]) {
      if (wanted.has(file.hash) && !packed.has(file.hash)) rows.push({path: `${prefix}${file.path}`, bytes: file.bytes, members: [file.hash], phase: metadata.has(file.hash) ? 'metadata' : 'body'});
    }
    // Never speculate beyond the bounded loan. Preserve order (section packs
    // first); unscheduled files retain ordinary demand, including desktop.
    let total = 0;
    const bounded = rows.filter(row => { if (total + row.bytes > 48_000_000) return false; total += row.bytes; return true; }).slice(0, 256);
    const text = JSON.stringify(bounded), hash = createHash('sha256').update(text).digest('hex').slice(0, 16);
    const name = `assets/entry-${directory}-${hash}.json`;
    writeFileSync(join(outDir, name), text); pair[tier] = `/${name}`;
    }
    result[directory] = pair;
  }
  return {entryDownloads: result, entryIndexes: indexes};
}

/** Required plain web-build step, after the complete module bank exists.
 * Module-only compiler fixtures retain their existing independent contract. */
export function writeEntryBootstrap(outDir: string, root: string): void {
  const file = join(outDir, 'index.html'), html = readFileSync(file, 'utf8');
  const expression = /(<script type="application\/json" id="boot-module-files">)([^<]+)(<\/script>)/u;
  const match = expression.exec(html);
  if (match?.[2] === undefined) throw new Error('Missing entry module bank');
  const bank: unknown = JSON.parse(match[2]);
  if (typeof bank !== 'object' || bank === null || Array.isArray(bank)) throw new Error('Invalid entry module bank');
  const facts = writeEntryDownloads(outDir, root);
  const grid = gridEntryDownloads(root);
  // Existing isolated transport-writer fixtures supply only their own tiny
  // common bank. The real module producer always supplies products/code.
  const totals = 'products' in bank ? entryTotals(bank, grid, root) : undefined;
  const bootstrap = ts.transpileModule(readFileSync(new URL('../../src/game/shardfile/entryTransport.ts', import.meta.url), 'utf8').replaceAll(/^export /gmu, ''), {
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext},
  }).outputText;
  const json = JSON.stringify({...bank, ...facts, gridEntryDownloads: grid, entryTotals: totals}).replaceAll('<', String.raw`\u003c`);
  writeFileSync(file, html.replace(expression, () => `<script type="application/json" id="boot-module-files">${json}</script><script>(()=>{${bootstrap}\ninstallEntryDownloadTotal();installEntryTransport();})();</script>`));
}
