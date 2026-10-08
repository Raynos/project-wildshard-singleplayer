// oxlint-disable-next-line import/no-nodejs-modules -- Node fixture validates packet indexing against the committed compressed recordings.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { indexAac } from '../../../src/engine/audio/aacIndex';

const u32 = (...values: number[]): Uint8Array => {
  const bytes = new Uint8Array(values.length * 4), view = new DataView(bytes.buffer);
  values.forEach((value, i) => view.setUint32(i * 4, value)); return bytes;
};
function concat(...parts: Uint8Array[]): Uint8Array {
  const bytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0; for (const part of parts) { bytes.set(part, at); at += part.length; } return bytes;
}
const box = (type: string, ...parts: Uint8Array[]): Uint8Array => {
  const data = concat(...parts); return concat(u32(data.length + 8), new TextEncoder().encode(type), data);
};
const full = (type: string, ...parts: Uint8Array[]): Uint8Array => box(type, u32(0), ...parts);
function fixture(): Uint8Array {
  const aac = new Uint8Array(28), view = new DataView(aac.buffer);
  view.setUint16(6, 1); view.setUint16(16, 2); view.setUint16(18, 16); view.setUint32(24, 48000 * 65536);
  const specific = Uint8Array.of(5, 2, 0x11, 0x90);
  const config = concat(Uint8Array.of(4, 13 + specific.length, 0x40, 0x15), new Uint8Array(11), specific);
  const es = concat(Uint8Array.of(3, 3 + config.length, 0, 1, 0), config);
  const description = full('stsd', u32(1), box('mp4a', aac, full('esds', es)));
  const make = (offset: number): Uint8Array => box('moov', box('trak',
    box('edts', full('elst', u32(1, 20, 1024, 65536))),
    box('mdia', full('mdhd', u32(0, 0, 48000, 2040, 0)), full('hdlr', u32(0, 0x736f756e)),
      box('minf', box('stbl', description, full('stts', u32(2, 1, 1024, 1, 1016)),
        full('stsc', u32(1, 1, 2, 1)), full('stsz', u32(0, 2, 3, 4)), full('stco', u32(1, offset)))))));
  const header = box('ftyp', u32(0)), movie = make(0);
  return concat(header, make(header.length + movie.length + 8), box('mdat', Uint8Array.of(1, 2, 3, 4, 5, 6, 7)));
}
function field(bytes: Uint8Array, type: string): number {
  const tag = new TextEncoder().encode(type);
  for (let i = 4; i < bytes.length - 4; i++) if (tag.every((value, j) => value === bytes[i + j])) return i + 4;
  throw new Error(`Missing fixture ${type}`);
}
function modify(type: string, offset: number, value: number): Uint8Array {
  const bytes = fixture(); new DataView(bytes.buffer).setUint32(field(bytes, type) + offset, value); return bytes;
}

describe('bounded incremental AAC packet admission', () => {
  it('indexes only encoded packets, respects byteOffset and owns compact independent metadata', () => {
    const source = fixture(), padded = concat(new Uint8Array(9), source, new Uint8Array(7));
    const index = indexAac(padded.subarray(9, 9 + source.length));
    expect(index.sampleRate).toBe(48000); expect(index.channels).toBe(2);
    expect(index.primingFrames).toBe(1024); expect(index.mediaFrames).toBe(2040);
    expect([...index.description]).toEqual([0x11, 0x90]); expect([...index.sizes]).toEqual([3, 4]);
    const first = index.offsets[0], second = index.offsets[1];
    if (first === undefined || second === undefined) throw new Error('Missing admitted packets');
    expect(second).toBe(first + 3); expect([...source.subarray(first, second)]).toEqual([1, 2, 3]);
    source.fill(0); expect([...index.description]).toEqual([0x11, 0x90]); expect([...index.sizes]).toEqual([3, 4]);
  });

  it('refuses oversized, truncated, ambiguous and fragmented containers', () => {
    expect(() => indexAac(new Uint8Array(32 * 1024 * 1024 + 1))).toThrow('file size');
    const bytes = fixture();
    for (const length of [0, 7, 13, bytes.length - 1]) expect(() => indexAac(bytes.subarray(0, length))).toThrow('Unsupported AAC index');
    expect(() => indexAac(concat(bytes, box('moof')))).toThrow('fragmented');
    expect(() => indexAac(concat(bytes, box('mdat')))).toThrow('one mdat');
    expect(() => indexAac(modify('ftyp', -8, 1))).toThrow('box size');
  });

  it.each([
    ['stco', 8, 0, 'chunk outside media'], ['stsz', 8, 0xffffffff, 'packet count'],
    ['stsz', 12, 0, 'packet outside media'], ['stsz', 16, 65537, 'packet outside media'],
    ['stts', 12, 1000, 'packet duration'], ['stts', 16, 2, 'packet duration'],
    ['stsc', 12, 1, 'chunk mapping'], ['elst', 12, 8193, 'edit rate / priming'],
    ['elst', 16, 0, 'edit rate / priming'], ['mdhd', 12, 44100, 'media timescale'],
    ['mdhd', 16, 2041, 'timing totals'], ['hdlr', 8, 0, 'audio handler'],
  ] as const)('rejects %s field %i before publishing packet metadata', (type, offset, value, reason) => {
    expect(() => indexAac(modify(type, offset, value))).toThrow(reason);
  });

  it('rejects encrypted or mismatched codec descriptions', () => {
    const encrypted = fixture(); encrypted.set(new TextEncoder().encode('enca'), field(encrypted, 'mp4a') - 4);
    expect(() => indexAac(encrypted)).toThrow('one mp4a');
    const wrong = fixture(); wrong[field(wrong, 'esds') + 24] = 0;
    expect(() => indexAac(wrong)).toThrow('Unsupported AAC index');
  });

  it.each([
    ['piano', 'title-3d1f713a.m4a', 2921, 2990937],
    ['folk', 'title-50001128.m4a', 3095, 3169181],
    ['orchestral', 'title-b47c8a52.m4a', 2149, 2200127],
  ] as const)('indexes the shipped %s AAC without allocating decoded audio', (_genre, file, packets, frames) => {
    const index = indexAac(readFileSync(new URL(`../../../public/assets/music/${_genre}/${file}`, import.meta.url)));
    expect(index.sizes).toHaveLength(packets); expect(index.mediaFrames).toBe(frames);
    expect(index.primingFrames).toBe(1024); expect([...index.description]).toEqual([0x11, 0x90, 0x56, 0xe5, 0]);
    expect(index.offsets.byteLength + index.sizes.byteLength + index.description.byteLength).toBe(packets * 8 + 5);
  });
});
