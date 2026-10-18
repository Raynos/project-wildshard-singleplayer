/** Reassemble Pine's already-published timber source channels before the final offline weld. */
import { BufferAttribute, BufferGeometry, type Mesh } from 'three';
import * as v from 'valibot';

const ordinal = v.pipe(v.number(), v.integer(), v.minValue(0));
const ordinals = v.union([v.array(ordinal), v.pipe(v.strictObject({ runs: v.array(ordinal) }),
  v.check(row => row.runs.length % 2 === 0 && row.runs.every((n, i) => i % 2 === 0 || n > 0)
    && row.runs.reduce((sum, n, i) => sum + (i % 2 === 1 ? n : 0), 0) <= 1 << 24),
  v.transform(row => { const result: number[] = []; for (let i = 0; i < row.runs.length; i += 2) {
    const start = row.runs[i] ?? 0, count = row.runs[i + 1] ?? 0;
    for (let k = 0; k < count; k++) result.push(start + k);
  } return result; }))]);
const partition = v.strictObject({ id: v.string(), vertices: ordinals, triangles: ordinals,
  vertexCount: v.pipe(ordinal, v.minValue(1)), indexCount: ordinal, index: v.picklist(['none', 'u16', 'u32']) });
const channels = v.record(v.string(), v.strictObject({ semantic: v.string(), storage: v.literal('Float32Array'),
  normalized: v.literal(false), itemSize: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(4)) }));
const semantics: Readonly<Record<string, string>> = { POSITION: 'position', NORMAL: 'normal', COLOR_0: 'color', TEXCOORD_0: 'uv', TANGENT: 'tangent' };
const identities = ['fire-lookout-', 'zipline-landing-', 'creek-footbridge-'];

/** Same original ordinals and completeness refusals as the native whole reader; no world transforms or fitting. */
export function timberWholeViews(nodes: readonly Mesh[]): Map<string, { readonly geometry: BufferGeometry }> {
  const groups = new Map<string, { geometry: BufferGeometry; seen: Uint8Array; triangles: Uint8Array; layout: string; pose: string }>();
  try {
    for (const node of nodes) {
      const raw: unknown = node.userData['wholePartition'];
      if (typeof raw !== 'object' || raw === null || !('id' in raw) || typeof raw.id !== 'string') continue;
      const identity = raw.id;
      if (!identities.some(prefix => identity.startsWith(prefix))) continue;
      const row = v.parse(partition, raw), attrs = v.parse(channels, node.userData['nativeAttributes']);
      const layout = JSON.stringify(attrs), pose = JSON.stringify(node.userData['matrix64'] ?? node.userData['instances64']);
      let group = groups.get(row.id);
      if (group === undefined) {
        const geometry = new BufferGeometry();
        for (const [key, attr] of Object.entries(attrs)) geometry.setAttribute(key, new BufferAttribute(new Float32Array(row.vertexCount * attr.itemSize), attr.itemSize));
        if (row.index !== 'none') geometry.setIndex(new BufferAttribute(row.index === 'u16' ? new Uint16Array(row.indexCount) : new Uint32Array(row.indexCount), 1));
        group = { geometry, seen: new Uint8Array(row.vertexCount), triangles: new Uint8Array((row.index === 'none' ? row.vertexCount : row.indexCount) / 3), layout, pose };
        groups.set(row.id, group);
      }
      if (group.layout !== layout || group.pose !== pose || group.seen.length !== row.vertexCount || (group.geometry.index?.count ?? 0) !== row.indexCount) throw new Error('Timber source layout differs');
      for (let local = 0; local < row.vertices.length; local++) {
        const vertex = row.vertices[local];
        if (vertex === undefined || vertex >= group.seen.length) throw new Error('Timber source vertex outside range');
        for (const [key, attr] of Object.entries(attrs)) {
          const source: unknown = node.geometry.getAttribute(semantics[attr.semantic] ?? attr.semantic.toLowerCase());
          const output: unknown = group.geometry.getAttribute(key);
          if (!(source instanceof BufferAttribute) || !(source.array instanceof Float32Array) || source.normalized || source.itemSize !== attr.itemSize || local >= source.count || !(output instanceof BufferAttribute)) throw new Error('Timber source channel differs');
          for (let k = 0; k < attr.itemSize; k++) {
            const value = source.array[local * attr.itemSize + k], at = vertex * attr.itemSize + k;
            if (value === undefined || !Number.isFinite(value) || (group.seen[vertex] === 1 && !Object.is(value, output.array[at]))) throw new Error('Timber shared vertex differs');
            output.array[at] = value;
          }
        }
        group.seen[vertex] = 1;
      }
      const sourceIndex = node.geometry.index;
      for (let local = 0; local < row.triangles.length; local++) {
        const triangle = row.triangles[local];
        if (triangle === undefined || triangle >= group.triangles.length || group.triangles[triangle] !== 0) throw new Error('Timber duplicate or missing triangle');
        for (let k = 0; k < 3; k++) {
          const vertex = row.vertices[sourceIndex === null ? local * 3 + k : sourceIndex.getX(local * 3 + k)];
          if (vertex === undefined) throw new Error('Timber triangle vertex missing');
          if (group.geometry.index !== null) group.geometry.index.array[triangle * 3 + k] = vertex;
          else if (vertex !== triangle * 3 + k) throw new Error('Timber nonindexed topology differs');
        }
        group.triangles[triangle] = 1;
      }
    }
    const result = new Map<string, { geometry: BufferGeometry }>();
    for (const [id, group] of groups) {
      if (group.seen.includes(0) || group.triangles.includes(0)) throw new Error(`Incomplete native timber source: ${id}`);
      result.set(id, { geometry: group.geometry });
    }
    return result;
  } catch (error) { for (const group of groups.values()) group.geometry.dispose(); throw error; }
}
