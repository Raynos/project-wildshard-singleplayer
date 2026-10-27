import { Float16BufferAttribute } from 'three';
import { vi } from 'vitest';
import * as glb from '../../src/sdk/bake/glb';
import * as compression from '../../src/sdk/bake/glbCompression';
import * as compact from '../../src/sdk/bake/compactGlb';
import { hashImmutableBytes } from '../../src/sdk/immutable';

/** Reproduce only the former numeric half-read defect, preserving frozen before pins. */
export async function halfFloatBeforeControl<T>(read: () => Promise<T>, observe?: (before: Uint8Array, current: Uint8Array) => void): Promise<T> {
  const write = glb.staticGlb, compress = compression.compressGlb, pack = compact.compactPhoneGlb;
  const corrected = new Map<string, Uint8Array>();
  const record = (legacy: Uint8Array, current: Uint8Array): void => {
    corrected.set(hashImmutableBytes(legacy), current); observe?.(legacy, current);
  };
  const compressed = observe === undefined ? undefined : vi.spyOn(compression, 'compressGlb').mockImplementation(input => {
    const legacy = compress(input), current = corrected.get(hashImmutableBytes(input));
    if (current !== undefined) record(legacy, compress(current));
    return legacy;
  });
  const packed = observe === undefined ? undefined : vi.spyOn(compact, 'compactPhoneGlb').mockImplementation(async (input, options) => {
    const legacy = await pack(input, options), current = corrected.get(hashImmutableBytes(input));
    if (current !== undefined) record(legacy, await pack(current, options));
    return legacy;
  });
  const before = vi.spyOn(glb, 'staticGlb').mockImplementation((parts, name) => {
    const copies = parts.map(part => {
      const geometry = part.geometry.clone();
      for (const attribute of Object.values(geometry.attributes)) if (attribute instanceof Float16BufferAttribute) {
        // The former writer called inherited getComponent, which exposes storage
        // bits (and its normalized storage semantics), rather than axis values.
        attribute.getX = index => attribute.getComponent(index, 0);
        attribute.getY = index => attribute.getComponent(index, 1);
        attribute.getZ = index => attribute.getComponent(index, 2);
        attribute.getW = index => attribute.getComponent(index, 3);
      }
      return { ...part, geometry };
    });
    try {
      const legacy = write(copies, name);
      if (observe !== undefined) record(legacy, write(parts, name));
      return legacy;
    }
    finally { for (const part of copies) part.geometry.dispose(); }
  });
  try { return await read(); }
  finally { before.mockRestore(); packed?.mockRestore(); compressed?.mockRestore(); }
}
