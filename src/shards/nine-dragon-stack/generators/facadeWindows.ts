import { BufferGeometry, InstancedBufferAttribute, PlaneGeometry } from 'three';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import layout from '../data/layout.generated.json' with { type: 'json' };

/** Unit quads keep their original instance bases for interior mapping.
 * Bounded native scene recipes split the 9,912 windows below the host cap. */
export function facadeWindowBlobs(): NamedBlob[] {
  const c = layout.rows.counts, start = (c.walkers + c.sitters + c.lanterns + c.acs) * 16
    + c.hooks * 3 + c.hookMounts * 6 + c.steam * 3 + c.pieces * 19;
  const records = layout.records.map(value => value === '-0' ? -0 : Number(value));
  return Array.from({ length: Math.ceil(c.windows / 4096) }, (_, index) => {
    const first = index * 4096, count = Math.min(4096, c.windows - first);
    const quad = new PlaneGeometry(1, 1); quad.translate(0, 0.5, 0);
    const attributes = { aWin: new Float32Array(count * 4), aWall: new Float32Array(count * 3), aWindowLight: new Float32Array(count * 3) };
    const matrices: number[] = [];
    for (let i = 0; i < count; i++) {
      const at = start + (first + i) * 26;
      matrices.push(...records.slice(at, at + 16));
      attributes.aWin.set(records.slice(at + 16, at + 20), i * 4);
      attributes.aWall.set(records.slice(at + 20, at + 23), i * 3);
      attributes.aWindowLight.set(records.slice(at + 23, at + 26), i * 3);
    }
    for (const [name, values] of Object.entries(attributes)) quad.setAttribute(name, new InstancedBufferAttribute(values, name === 'aWin' ? 4 : 3));
    // PlaneGeometry's parametric JSON omits attached attributes; serialize the
    // plain native buffer shape instead, preserving its indexed topology.
    const buffer = new BufferGeometry().copy(quad);
    const geometry = { ...buffer.toJSON(), uuid: `nine-facade-window-${index}` };
    const scene = { version: 1, root: 'windows', nodes: [{ id: 'windows', kind: 'mesh', geometry: 'quad', material: 'window', instances: count, matrices, missing: 'empty', name: 'facade-windows' }], materials: [{ id: 'window', kind: 'port', source: 'window' }] };
    quad.dispose(); buffer.dispose();
    return nameBlob(`geometry/facade-windows-${index}.json`, 'json', new TextEncoder().encode(JSON.stringify({ geometry, scene })));
  });
}
