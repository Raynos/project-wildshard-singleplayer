#!/usr/bin/env node
// SHARD-PLATFORM SF72 (SF67 fix 3, "bake the code-built worlds"): Sky Reach's code-built world pieces baked offline. The
// generators (src/shards/far-reach/generators/*.ts) run here only; each piece's static GLB goes to
// public/assets/far-reach/baked/<piece>.glb and its rows (the GLB's content hash, the instanced kinds, the colliders) to
// src/shards/far-reach/data/<rows>.json, which the client reads (world/baked.ts). test/shards/far-reach/world-bake.test.ts
// is the byte-exact stale gate (it re-runs the generators).
// Usage: node --import ./scripts/bake-loader.mjs src/shards/far-reach/generators/bake-sky-world.mjs
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { constants, deflateSync, zstdCompressSync, zstdDecompressSync } from 'node:zlib';
import * as v from 'valibot';
import { hashImmutableBytes } from '@wildshard/sdk/immutable';
import { parseKtx2 } from '@wildshard/sdk/assets';
import { readImagePixels, writeImagePixels } from '@wildshard/sdk/bake/image';

const invokedFile = process.argv.at(1);
if (invokedFile !== undefined && resolve(invokedFile) === import.meta.filename) {
const root = resolve(import.meta.dirname, '../../../..'), project = resolve(root, 'src/shards/far-reach');
const out = resolve(root, 'public/assets/far-reach/baked');
const check = process.argv.includes('--check');
const emit = (file, bytes) => {
  if (check) {
    if (!readFileSync(file).equals(Buffer.from(bytes))) throw new Error(`STALE ${file}`);
  } else writeFileSync(file, bytes);
};
if (!check) mkdirSync(out, { recursive: true });
// This independently owned author product shares the output directory.
const keep = new Set(['fan.glb', 'prepared-models.glb']);
// SF80: the pieces as one three.js scene through the SDK's bake(scene, identity), which also writes its scene.json to
// .wildshard/cache/far-reach/ (gitignored, the inspectable middle step)
{
  const { skyWorldPieceFiles } = await import('./worldPieceBytes.ts');
  const { skyReachBake } = await import('./scene.ts');
  const baked = skyReachBake(check ? undefined : root);
  for (const [name, bytes] of skyWorldPieceFiles(baked.pieces)) {
    const file = name.startsWith('baked/') ? resolve(out, name.slice(6)) : resolve(project, name);
    emit(file, bytes);
    if (name.startsWith('baked/')) keep.add(name.slice(6));
    console.info(`far-reach ${name}: ${String(bytes.length)} bytes`);
  }
}
// The original native bridge, island and mill packs; the source owns bytes, this adapter owns files.
{
  const { WORLD_PACK_INPUTS, skyWorldPackSource } = await import('./worldPackBytes.ts');
  const inputs = new Map(WORLD_PACK_INPUTS.map(url => [url, new Uint8Array(readFileSync(resolve(root, `public${url}`)))]));
  const files = await skyWorldPackSource(inputs, bytes => new Uint8Array(deflateSync(bytes, { level: 9 })));
  for (const [name, bytes] of files) {
    emit(name.startsWith('baked/') ? resolve(out, name.slice(6)) : resolve(project, name), bytes);
    console.info(`far-reach ${name}: ${String(bytes.length)} bytes`);
  }
}
// the twelve static islands as compiled props tiles, each island whole (generators/isleProps.ts): data/props.json and the
// tile GLBs under assets/<hash>, the shardfile's declared files (shard.config.ts); the runtime draws them (world/isle.ts)
{
  const { skyWorldTileSource } = await import('./worldTileBytes.ts');
  const files = skyWorldTileSource();
  if (!check) mkdirSync(resolve(project, 'assets'), { recursive: true });
  for (const [name, bytes] of files) emit(resolve(project, name), bytes);
  console.info(`far-reach isle props: ${String(files.size - 1)} assets`);
}
// the sky-isle models' unit frames (world/skyIsleHd.ts skyIsleUnit), found from each model's GLB
{
  const { WORLD_PLACEMENT_INPUTS, skyWorldPlacementSource } = await import('./worldPlacementBytes.ts');
  const inputs = new Map(WORLD_PLACEMENT_INPUTS.map(url => [url, new Uint8Array(readFileSync(resolve(root, `public${url}`)))]));
  for (const [name, bytes] of await skyWorldPlacementSource(inputs)) {
    emit(resolve(project, name), bytes);
    console.info(`far-reach ${name}: ${String(bytes.length)} bytes`);
  }
}
// the folder holds this bake and the rest bakes (the sky-rest-* and sky-islet-rest jobs): an orphan is a GLB no other
// generation job declares as its output, from an older run of this bake, and never ships
const declared = new Set(v.parse(v.object({ jobs: v.array(v.object({ id: v.string(), outputs: v.array(v.string()) })) }),
  JSON.parse(readFileSync(resolve(root, 'scripts/generation-jobs.json'), 'utf8'))).jobs.filter(job => job.id !== 'sky-world').flatMap(job => job.outputs));
for (const entry of readdirSync(out)) if (entry.endsWith('.glb') && !keep.has(entry) && !declared.has(`public/assets/far-reach/baked/${entry}`)) { if (check) throw new Error(`Orphan bake ${entry}`); rmSync(resolve(out, entry)); }

}

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
