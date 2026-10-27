import { expect } from 'vitest';
import { encodeCanonicalJson, hashImmutableBytes } from '../../src/sdk/immutable';
import { parseGlb } from '../../src/sdk/assets';
import type { PreparedProjectOutput } from '../../src/sdk/projectOutput';
import { nineOutputReceipt } from './nine-output-receipt';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
const text = (bytes: Uint8Array): string => new TextDecoder('utf-8', { fatal: true }).decode(bytes);
const object = (value: Json): value is { [key: string]: Json } => value !== null && typeof value === 'object' && !Array.isArray(value);
const sorted = (values: readonly string[]): boolean => values.every((value, i) => i === 0 || value >= (values[i - 1] ?? ''));

/** Exact numeric-half writer/codec observations, followed only through owned content references. */
export class HalfOutputProof {
  private readonly changes = new Map<string, { before: Uint8Array; current: Uint8Array }>();
  readonly observe = (before: Uint8Array, current: Uint8Array): void => {
    if (hashImmutableBytes(before) !== hashImmutableBytes(current)) this.changes.set(hashImmutableBytes(before), { before, current });
  };

  expect(before: PreparedProjectOutput, current: PreparedProjectOutput): void {
    const files = (output: PreparedProjectOutput): Map<string, Uint8Array> => new Map([...output.assets, ...output.blobs.map(row => [row.file.hash, row.bytes] as const)]);
    const oldFiles = files(before), newFiles = files(current);
    const oldNamed = [...before.options.namedFiles ?? [], ...before.blobs.map(row => row.file)];
    const newNamed = [...current.options.namedFiles ?? [], ...current.blobs.map(row => row.file)];
    const logical = new Map(oldNamed.flatMap(row => {
      const next = newNamed.find(candidate => candidate.name === row.name && candidate.kind === row.kind);
      return row.name === undefined || next === undefined ? [] : [[row.name, { old: row, next }] as const];
    }));
    const refs = (value: string): string => value.replace(/[a-f0-9]{64}/gu, hash => {
      const pair = this.changes.get(hash); return pair === undefined ? hash : hashImmutableBytes(pair.current);
    });
    const rewrite = (value: Json, path = ''): Json => {
      if (typeof value === 'string') return refs(value);
      if (Array.isArray(value)) {
        const output = value.map((item, i) => rewrite(item, `${path}/${i}`));
        // These are declared hash-sorted world/declaration collections only.
        if (['/shardfile/library', '/library', '/props/wholeLibrary'].includes(path)
          && value.every(item => typeof item === 'string') && sorted(value)) output.sort((a, b) => String(a).localeCompare(String(b)));
        if (['/shardfile/files', '/files'].includes(path) && value.every(item => object(item) && typeof item['hash'] === 'string')
          && sorted(value.map(item => object(item) ? String(item['hash']) : ''))) output.sort((a, b) =>
            String(object(a) ? a['hash'] : '').localeCompare(String(object(b) ? b['hash'] : '')));
        return output;
      }
      if (!object(value)) return value;
      const output: { [key: string]: Json } = Object.fromEntries(Object.entries(value).map(([key, item]) => [refs(key), rewrite(item, `${path}/${key}`)]));
      const hash = value['hash'], pair = typeof hash === 'string' ? this.changes.get(hash) : undefined;
      if (pair !== undefined) {
        if (value['compressed'] === pair.before.byteLength) output['compressed'] = pair.current.byteLength;
        if (value['bytes'] === pair.before.byteLength) output['bytes'] = pair.current.byteLength;
        if (value['kind'] === 'glb') {
          const original = parseGlb(pair.before), cost = parseGlb(pair.current);
          expect(cost.triangles).toBe(original.triangles); expect(cost.draws).toBe(original.draws);
          Object.assign(output, cost);
        } else if (value['decoded'] === pair.before.byteLength) output['decoded'] = pair.current.byteLength;
      }
      const reference = value['file'] ?? value['url'];
      const descriptor = typeof reference === 'string' ? logical.get(reference) : undefined;
      if (descriptor !== undefined && value['bytes'] === descriptor.old.compressed) output['bytes'] = descriptor.next.compressed;
      return output;
    };
    const candidates: { before: Uint8Array; current: Uint8Array; name: string }[] = [];
    for (const [name, { old, next }] of logical) {
      const a = oldFiles.get(old.hash), b = newFiles.get(next.hash);
      if (a !== undefined && b !== undefined && old.kind === 'json') candidates.push({ before: a, current: b, name });
    }
    for (const kind of ['platform', 'custom'] as const) {
      for (const [name, bytes] of before.options[kind]?.files ?? []) {
        const next = current.options[kind]?.files.get(name);
        if (next === undefined) throw new Error(`Missing current half-control ${kind}/${name}`);
        candidates.push({ before: bytes, current: next, name: `${kind}/${name}` });
      }
    }
    let pending = candidates.filter(pair => hashImmutableBytes(pair.before) !== hashImmutableBytes(pair.current));
    for (let pass = 0; pending.length > 0 && pass <= candidates.length; pass++) {
      const count = pending.length;
      pending = pending.filter(pair => {
        const source = text(pair.before), value = JSON.parse(source) as Json;
        const projected = JSON.stringify(rewrite(value), null, source.includes('\n  "') ? 2 : undefined) + (source.endsWith('\n') ? '\n' : '');
        if (projected !== text(pair.current)) return true;
        this.observe(pair.before, pair.current); return false;
      });
      if (pending.length === count) break;
    }
    expect(pending.map(row => row.name), 'only numeric-half references/transport fields may change').toEqual([]);
    const expected = new Set<string>();
    for (const [hash, bytes] of oldFiles) {
      const output = this.changes.get(hash)?.current ?? bytes, name = hashImmutableBytes(output), actual = newFiles.get(name);
      if (actual === undefined) throw new Error(`Unexplained half-control asset ${hash} -> ${name}`);
      expect(actual.byteLength, hash).toBe(output.byteLength);
      expect(hashImmutableBytes(actual), hash).toBe(name); expected.add(name);
    }
    expect([...newFiles.keys()].sort()).toEqual([...expected].sort());
    const originalReceipt = JSON.parse(encodeCanonicalJson(nineOutputReceipt(before))) as Json;
    const expectedReceipt = rewrite(originalReceipt);
    if (!object(expectedReceipt)) throw new Error('Invalid predecessor receipt');
    const assets = expectedReceipt['assets'], blobs = expectedReceipt['blobs'];
    if (!Array.isArray(assets) || !Array.isArray(blobs)) throw new Error('Missing predecessor inventories');
    assets.sort((a, b) => String(object(a) ? a['name'] : '').localeCompare(String(object(b) ? b['name'] : '')));
    blobs.sort((a, b) => {
      const x = object(a) ? a['file'] : null, y = object(b) ? b['file'] : null;
      return String(x !== undefined && object(x) ? x['path'] : '').localeCompare(String(y !== undefined && object(y) ? y['path'] : ''));
    });
    expect(hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson(nineOutputReceipt(current)))))
      .toBe(hashImmutableBytes(new TextEncoder().encode(encodeCanonicalJson(expectedReceipt))));
  }
}
