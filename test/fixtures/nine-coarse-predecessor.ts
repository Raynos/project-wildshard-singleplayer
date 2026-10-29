// oxlint-disable-next-line import/no-nodejs-modules -- Search asset bytes natively.
import { Buffer } from 'node:buffer';
import type { PreparedProjectOutput } from '../../src/sdk/projectOutput';
import { encodeCanonicalJson, hashImmutableBytes } from '../../src/sdk/immutable';

/** NR12's predecessor layer: Nine's coarse L1 parents draw in the `nine-coarse-facade` graph, its props family. Its
 *  predecessor had no such look material: the look section without its row (and the graph's file), the light volumes' and
 *  the client plan's look lists without the id, and the props family `pbr`. Everything else is returned as it is. */
const ID = 'nine-coarse-facade';

function strip(value: unknown): unknown {
  if (Array.isArray(value)) return value.filter(item => item !== ID).map(strip);
  if (typeof value !== 'object' || value === null) return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === ID) continue;
    out[key] = key === 'family' && item === ID ? 'pbr' : strip(item);
  }
  return out;
}

/** one output file as it was: a JSON file naming the coarse graph, re-encoded without it (any other file as it is) */
export function coarsePredecessor(bytes: Uint8Array): Uint8Array {
  if (!Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).includes(`"${ID}"`)) return bytes;
  return new TextEncoder().encode(encodeCanonicalJson(strip(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)))));
}

/** the graph's own file: the look section's row for it names its hash */
function graphFile(prepared: PreparedProjectOutput): string | null {
  const look = prepared.options.platform?.files.get('sections/look/look.json');
  if (look === undefined) return null;
  const match = new TextDecoder().decode(look).match(new RegExp(`"${ID}":\\{"family":"graph","file":"([a-f0-9]{64})"`, 'u'));
  return match?.[1] ?? null;
}

/** a prepared Nine output with NR12 taken back out: the graph's file dropped, and every file naming it put back */
export function nineCoarsePredecessor(prepared: PreparedProjectOutput): PreparedProjectOutput {
  const dropped = graphFile(prepared);
  const assets = new Map<string, Uint8Array>();
  for (const [hash, bytes] of prepared.assets) if (hash !== dropped) assets.set(hash, bytes);
  const blobs = prepared.blobs.filter(blob => blob.file.hash !== dropped);
  const namedFiles = prepared.options.namedFiles?.filter(row => row.hash !== dropped);
  const options = namedFiles === undefined ? prepared.options : { ...prepared.options, namedFiles };
  const platform = options.platform;
  if (platform === undefined) return { ...prepared, blobs, assets, options };
  const files = new Map<string, Uint8Array>();
  for (const [path, bytes] of platform.files) files.set(path, coarsePredecessor(bytes));
  const sections = platform.sections.map(row => {
    const bytes = files.get(row.path);
    return bytes === undefined || bytes === platform.files.get(row.path) ? row : { ...row, hash: hashImmutableBytes(bytes), bytes: bytes.byteLength };
  });
  return { ...prepared, blobs, assets, options: { ...options, platform: { ...platform, files, sections } } };
}

/** the same layer over a project output (the Nine program's own `output`): the graph's blob, asset and named-file row
 *  dropped, and every platform file naming it put back */
export function nineOutputCoarsePredecessor<O extends { readonly assets?: ReadonlyMap<string, Uint8Array>; readonly blobs?: readonly { readonly source: string }[];
  readonly namedFiles?: readonly { readonly hash: string }[];
  readonly platform?: { readonly files: ReadonlyMap<string, Uint8Array>; readonly sections: readonly { readonly path: string; readonly hash: string; readonly bytes: number }[] } }>(output: O): O {
  const look = output.platform?.files.get('sections/look/look.json');
  const dropped = look === undefined ? null : new TextDecoder().decode(look).match(new RegExp(`"${ID}":\\{"family":"graph","file":"([a-f0-9]{64})"`, 'u'))?.[1] ?? null;
  const assets = output.assets === undefined ? undefined : new Map([...output.assets].filter(([hash]) => hash !== dropped));
  const blobs = output.blobs?.filter(blob => dropped === null || !blob.source.includes(dropped)), namedFiles = output.namedFiles?.filter(row => row.hash !== dropped);
  const platform = output.platform, projected = platform === undefined ? undefined : (() => {
    const files = new Map<string, Uint8Array>();
    for (const [path, bytes] of platform.files) files.set(path, coarsePredecessor(bytes));
    return { ...platform, files, sections: platform.sections.map(row => {
      const bytes = files.get(row.path);
      return bytes === undefined || bytes === platform.files.get(row.path) ? row : { ...row, hash: hashImmutableBytes(bytes), bytes: bytes.byteLength };
    }) };
  })();
  return { ...output, ...(assets === undefined ? {} : { assets }), ...(blobs === undefined ? {} : { blobs }), ...(namedFiles === undefined ? {} : { namedFiles }),
    ...(projected === undefined ? {} : { platform: projected }) };
}
