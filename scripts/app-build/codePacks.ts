import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

export interface CodePacks {
  readonly files: readonly string[];
  readonly entries: Readonly<Record<string, readonly [url: string, bytes: number, decoded: number, members: readonly number[]]>>;
}

/** A transport envelope only. Original module bytes, URLs, imports and evaluation
 * order are unchanged. Each selected entry contains exactly its existing bank. */
export function writeCodePacks(out: string, entries: Readonly<Record<string, readonly (readonly [string, number])[]>>): CodePacks {
  const files: string[] = [], indexes = new Map<string, number>();
  const packs: Record<string, readonly [string, number, number, readonly number[]]> = {};
  for (const [entry, rows] of Object.entries(entries)) {
    const selected = new Map(rows.filter(([url]) => url.endsWith('.js')));
    if (selected.size === 0) continue;
    const bodies: Buffer[] = [], header: [string, number, number, string][] = [], members: number[] = [];
    let offset = 0;
    for (const [url, expected] of [...selected].sort(([a], [b]) => a.localeCompare(b))) {
      if (!/^\/assets\/[a-zA-Z0-9_.-]+\.js$/u.test(url)) throw new Error('Invalid code pack member URL');
      const bytes = readFileSync(join(out, url.slice(1)));
      if (bytes.length !== expected) throw new Error('Code pack member differs from its bank');
      header.push([url, offset, bytes.length, createHash('sha256').update(bytes).digest('hex')]);
      bodies.push(bytes); offset += bytes.length;
      let index = indexes.get(url);
      if (index === undefined) { index = files.length; files.push(url); indexes.set(url, index); }
      members.push(index);
    }
    const metadata = Buffer.from(JSON.stringify(header)), prefix = Buffer.alloc(12);
    prefix.write('WSCODE01'); prefix.writeUInt32LE(metadata.length, 8);
    const decoded = prefix.length + metadata.length + offset;
    if (decoded > 32 * 1024 * 1024 || metadata.length > 1024 * 1024 || selected.size > 4096) throw new Error('Oversized code pack');
    const wire = gzipSync(Buffer.concat([prefix, metadata, ...bodies]));
    const hash = createHash('sha256').update(wire).digest('hex'), url = `/assets/code/${hash}.pack`;
    mkdirSync(join(out, 'assets/code'), { recursive: true });
    writeFileSync(join(out, url.slice(1)), wire);
    packs[entry] = [url, wire.length, decoded, members];
  }
  return { files, entries: packs };
}
