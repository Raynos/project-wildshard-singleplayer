import { Float16BufferAttribute } from 'three';
import { vi } from 'vitest';
import * as glb from '../../src/sdk/bake/glb';

/** Reproduce only the former numeric half-read defect, preserving frozen before pins. */
export async function halfFloatBeforeControl<T>(read: () => Promise<T>): Promise<T> {
  const write = glb.staticGlb;
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
    try { return write(copies, name); }
    finally { for (const part of copies) part.geometry.dispose(); }
  });
  try { return await read(); }
  finally { before.mockRestore(); }
}
