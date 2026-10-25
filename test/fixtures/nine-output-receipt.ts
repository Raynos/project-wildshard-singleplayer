import type { PreparedProjectOutput } from '../../src/sdk/projectOutput';
import { hashImmutableBytes } from '../../src/sdk/immutable';

/** Whole original admission inventory: contracts plus the hash and length of every complete physical byte array. */
export function nineOutputReceipt(prepared: PreparedProjectOutput): unknown {
  const files = (map: ReadonlyMap<string, Uint8Array>) => [...map].map(([name, bytes]) => ({ name, bytes: bytes.length, hash: hashImmutableBytes(bytes) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    blobs: prepared.blobs.map(({ file, bytes, script }) => ({ file, bytes: bytes.length, hash: hashImmutableBytes(bytes), ...(script === undefined ? {} : { script }) }))
      .sort((a, b) => a.file.path.localeCompare(b.file.path)),
    namedFiles: prepared.options.namedFiles,
    assets: files(new Map([...prepared.assets, ...prepared.blobs.map(row => [row.file.hash, row.bytes] as const)])),
    platform: prepared.options.platform === undefined ? null : { sections: prepared.options.platform.sections, files: files(prepared.options.platform.files) },
    custom: prepared.options.custom === undefined ? null : { sections: prepared.options.custom.sections, files: files(prepared.options.custom.files) },
  };
}
