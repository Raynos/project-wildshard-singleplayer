import { BufferAttribute, BufferGeometry, Float16BufferAttribute, type Mesh } from 'three';
import * as v from 'valibot';

/** Portable accessor metadata for one original typed application channel. */
export const NativeAttributeSchema = v.strictObject({ semantic: v.string(), storage: v.picklist(['Float32Array', 'Float16Array', 'Uint16Array', 'Uint32Array', 'Int16Array', 'Int8Array', 'Uint8Array']), normalized: v.boolean(), itemSize: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(4)) });
/** Original application channel names mapped to their exact stored accessors. */
export const NativeAttributesSchema = v.record(v.string(), NativeAttributeSchema);
const semantics: Readonly<Record<string, string>> = { POSITION: 'position', NORMAL: 'normal', COLOR_0: 'color', TEXCOORD_0: 'uv', TANGENT: 'tangent' };

/** Restore original typed GLB channels, including half-float bits and vec4 shader normals.
 * Both owned single draws and partitioned whole libraries use this exact decoder. */
export function nativeWholeGeometry(node: Mesh): BufferGeometry {
  const metadata: unknown = node.userData['nativeAttributes'], input: unknown = node.geometry;
  if (!(input instanceof BufferGeometry)) throw new Error('Whole shape needs geometry');
  const result = new BufferGeometry();
  for (const [name, row] of Object.entries(v.parse(NativeAttributesSchema, metadata))) {
    const channel = semantics[row.semantic] ?? row.semantic.toLowerCase(), attribute: unknown = input.getAttribute(channel);
    if (!(attribute instanceof BufferAttribute) || attribute.itemSize !== row.itemSize || attribute.normalized !== row.normalized) throw new Error(`Whole shape missing typed channel ${channel}`);
    if (row.storage === 'Float16Array') {
      if (!(attribute.array instanceof Uint16Array)) throw new Error('Whole half-float channel needs uint16 bits');
      result.setAttribute(name, new Float16BufferAttribute(attribute.array.slice(), row.itemSize, row.normalized));
    } else {
      if (attribute.array.constructor.name !== row.storage) throw new Error('Whole channel storage mismatch');
      result.setAttribute(name, attribute.clone());
    }
  }
  result.setIndex(input.getIndex()?.clone() ?? null);
  return result;
}
