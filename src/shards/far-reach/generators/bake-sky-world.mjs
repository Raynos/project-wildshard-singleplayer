// The world scheduler is retired. This module retains only the independent authored texture-library writer.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { constants, zstdCompressSync, zstdDecompressSync } from 'node:zlib';
import * as v from 'valibot';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { parseKtx2 } from '@wildshard/sdk/assets';
import { readImagePixels, writeImagePixels } from '@wildshard/sdk/bake/image';

/** Repack existing zstd KTX2 mip payloads without changing a decoded byte.
 * Keep each original block if it is smaller; preserve metadata and physical
 * mip order. Explicit authoring only, never runtime or ordinary builds. */
function repackKtx2Lossless(bytes) {
    parseKtx2(bytes);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(44, true) !== 2)
        throw new Error('Lossless repack requires zstd KTX2');
    const levels = view.getUint32(40, true), mips = [];
    for (let mip = 0; mip < levels; mip++) {
        const offset = Number(view.getBigUint64(80 + mip * 24, true)), length = Number(view.getBigUint64(88 + mip * 24, true)), size = Number(view.getBigUint64(96 + mip * 24, true));
        if (!Number.isSafeInteger(size) || size < 1 || size > 64 * 1024 * 1024)
            throw new Error('Lossless mip output bound');
        const raw = zstdDecompressSync(bytes.subarray(offset, offset + length), { maxOutputLength: size });
        if (raw.length !== size)
            throw new Error('Lossless mip decoded length');
        let packed = bytes.subarray(offset, offset + length);
        for (const level of [21, 22]) {
            const candidate = zstdCompressSync(raw, { params: { [constants.ZSTD_c_compressionLevel]: level } });
            if (!zstdDecompressSync(candidate, { maxOutputLength: size }).equals(raw))
                throw new Error('Lossless mip identity');
            if (candidate.length < packed.length)
                packed = candidate;
        }
        mips.push({ mip, offset, packed, raw });
    }
    mips.sort((a, b) => a.offset - b.offset);
    const first = mips.at(0), last = mips.at(-1);
    if (first === undefined || last === undefined)
        throw new Error('Lossless mip roster');
    const lastLength = Number(view.getBigUint64(88 + last.mip * 24, true));
    if (last.offset + lastLength !== bytes.length)
        throw new Error('Lossless repack refuses unread tail');
    const header = Uint8Array.from(bytes.subarray(0, first.offset)), patched = new DataView(header.buffer), chunks = [header];
    let size = header.length;
    for (const mip of mips) {
        patched.setBigUint64(80 + mip.mip * 24, BigInt(size), true);
        patched.setBigUint64(88 + mip.mip * 24, BigInt(mip.packed.length), true);
        chunks.push(mip.packed);
        size += mip.packed.length;
    }
    if (size >= bytes.length)
        return bytes;
    const output = new Uint8Array(size);
    let cursor = 0;
    for (const chunk of chunks) {
        output.set(chunk, cursor);
        cursor += chunk.length;
    }
    const final = new DataView(output.buffer);
    for (const mip of mips) {
        const offset = Number(final.getBigUint64(80 + mip.mip * 24, true)), length = Number(final.getBigUint64(88 + mip.mip * 24, true));
        if (!zstdDecompressSync(output.subarray(offset, offset + length), { maxOutputLength: mip.raw.length }).equals(mip.raw))
            throw new Error('Final lossless mip identity');
    }
    parseKtx2(output);
    return output;
}
const sampler = v.strictObject({ filter: v.literal('linear'), wrap: v.optional(v.literal('repeat')), anisotropy: v.optional(v.literal(4)) });
const row = v.strictObject({ source: v.pipe(v.string(), v.regex(/^\/assets\/[a-zA-Z0-9/_-]+\.webp$/u)),
    asset: v.optional(v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/u))), sampler });
const catalogue = v.pipe(v.record(v.pipe(v.string(), v.regex(/^[a-zA-Z][a-zA-Z0-9]*$/u)), row), v.check(value => Object.keys(value).length > 0 && Object.keys(value).length <= 32));
/** Emit charged exact-source library descriptors; encode is an explicit offline update, never a build prerequisite. */
/** @param {string} root @param {string} input @param {{encode:boolean,check:boolean,encoder:typeof import('../../../sdk/bake/texture').bakeColourTexture}} options */
export async function bakeTextureLibrary(root, input, options) {
    const source = resolve(root, input), project = dirname(dirname(source));
    if (!source.startsWith(`${resolve(root, 'src/shards')}/`) || !source.endsWith('Sources.json'))
        throw new Error('Library source catalogue must be an authored shard data Sources.json');
    const raw = JSON.parse(readFileSync(source, 'utf8'));
    const rows = v.parse(catalogue, raw), files = {};
    mkdirSync(join(project, 'assets'), { recursive: true });
    let pinsChanged = false;
    for (const [name, declaration] of Object.entries(rows)) {
        const image = Uint8Array.from(readFileSync(join(root, 'public', declaration.source)));
        const raster = await readImagePixels(image);
        if (options.encode) {
            const png = await writeImagePixels(raster);
            const bytes = repackKtx2Lossless(options.encoder(png, 'basisu', { flipY: true })), hash = hashImmutableBytes(bytes);
            pinsChanged ||= declaration.asset !== hash;
            declaration.asset = hash;
            writeFileSync(join(project, 'assets', hash), bytes);
        }
        if (declaration.asset === undefined)
            throw new Error(`Library map ${name} needs its encoded asset pin`);
        const bytes = Uint8Array.from(readFileSync(join(project, 'assets', declaration.asset)));
        if (hashImmutableBytes(bytes) !== declaration.asset)
            throw new Error(`Library map ${name} content hash mismatch`);
        const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const width = header.getUint32(20, true), height = header.getUint32(24, true);
        if (width !== raster.width || height !== raster.height)
            throw new Error(`Library map ${name} changed source dimensions`);
        Reflect.set(files, name, { hash: declaration.asset, kind: 'ktx2', compressed: bytes.length, ...parseKtx2(bytes), dependencies: [], critical: false });
        console.info(`library ${name}: ${width}x${height}, ${bytes.length} bytes, ${declaration.asset}`);
    }
    if (options.encode && pinsChanged)
        writeFileSync(source, `${JSON.stringify(rows, null, 2)}\n`);
    const output = source.replace(/Sources\.json$/u, 's.json'), values = Object.values(files);
    const product = { maps: files, files: values, library: values.map(file => file.hash), budget: { compressed: values.reduce((sum, file) => sum + file.compressed, 0), resident: values.reduce((sum, file) => sum + file.decoded + file.gpu, 0) } };
    const payload = `${JSON.stringify(product, null, 2)}\n`;
    if (options.check) {
        if (readFileSync(output, 'utf8') !== payload)
            throw new Error(`Stale library metadata ${output}`);
    }
    else
        writeFileSync(output, payload);
}
