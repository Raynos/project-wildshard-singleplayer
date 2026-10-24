/** This function is stringified into a diagnostic page. Keep helpers inside it:
 * no imports, outer bindings, persistent resource references or scene mutations.
 * @param {import('three').Object3D} scene
 * @param {(source: object) => string[]} sourceIds
 * @returns {import('./tile-census-scene.mjs').CensusSceneSnapshot} */
export function captureTileScene(scene, sourceIds) {
  /** @param {unknown} value @returns {value is Record<string, unknown>} */
  const object = value => value !== null && typeof value === 'object';
  /** @type {Map<ArrayBufferLike, string>} */
  const identities = new Map();
  /** @type {import('./tile-census-scene.mjs').SceneCpuBuffer[]} */
  const cpuBuffers = [];
  /** @type {import('./tile-census-scene.mjs').CensusSceneNode[]} */
  const nodes = [];
  /** Existing bounds only. Do not compute or cache a bounding box on the mesh.
   * Instanced and skinned footprints need their own pose-aware read; keep unknown.
   * @param {import('three').Object3D} node
   * @param {Record<string, unknown>} geometry
   * @returns {import('./tile-census-scene.mjs').SceneBounds | null} */
  const bounds = (node, geometry) => {
    if (Reflect.get(node, 'isInstancedMesh') === true || Reflect.get(node, 'isSkinnedMesh') === true) return null;
    if (object(geometry.morphAttributes) && Object.keys(geometry.morphAttributes).length > 0) return null;
    const box = geometry.boundingBox;
    if (!object(box) || !object(box.min) || !object(box.max)) return null;
    const { x: x0, y: y0, z: z0 } = box.min, { x: x1, y: y1, z: z1 } = box.max;
    if (typeof x0 !== 'number' || typeof y0 !== 'number' || typeof z0 !== 'number' ||
        typeof x1 !== 'number' || typeof y1 !== 'number' || typeof z1 !== 'number' ||
        ![x0, y0, z0, x1, y1, z1].every(Number.isFinite) || x0 > x1 || y0 > y1 || z0 > z1) return null;
    const m = node.matrixWorld.elements;
    if (m.length !== 16 || !m.every(Number.isFinite) || m[3] !== 0 || m[7] !== 0 || m[11] !== 0 || m[15] !== 1) return null;
    const min = { x: Infinity, y: Infinity, z: Infinity }, max = { x: -Infinity, y: -Infinity, z: -Infinity };
    for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) {
      // Matrix4.elements has 16 values; explicit fallbacks retain checked indexing.
      const px = (m[0] ?? 0) * x + (m[4] ?? 0) * y + (m[8] ?? 0) * z + (m[12] ?? 0);
      const py = (m[1] ?? 0) * x + (m[5] ?? 0) * y + (m[9] ?? 0) * z + (m[13] ?? 0);
      const pz = (m[2] ?? 0) * x + (m[6] ?? 0) * y + (m[10] ?? 0) * z + (m[14] ?? 0);
      min.x = Math.min(min.x, px); min.y = Math.min(min.y, py); min.z = Math.min(min.z, pz);
      max.x = Math.max(max.x, px); max.y = Math.max(max.y, py); max.z = Math.max(max.z, pz);
    }
    if (![min.x, min.y, min.z, max.x, max.y, max.z].every(Number.isFinite)) return null;
    return { min, max };
  };
  scene.traverse(node => {
    const geometry = /** @type {unknown} */ (Reflect.get(node, 'geometry'));
    if (!object(geometry) || geometry.isBufferGeometry !== true) return;
    if (!object(geometry.attributes)) throw new Error('Invalid census geometry attributes');
    const attributes = Object.entries(geometry.attributes).map(([role, value]) => ({ role, value }));
    if (geometry.index !== null && geometry.index !== undefined) attributes.push({ role: 'index', value: geometry.index });
    if (object(geometry.morphAttributes)) for (const [name, values] of Object.entries(geometry.morphAttributes)) {
      if (!Array.isArray(values)) throw new Error('Invalid census morph attributes');
      for (let k = 0; k < values.length; k++) attributes.push({ role: `morph:${name}:${k}`, value: values[k] });
    }
    for (const role of ['instanceMatrix', 'instanceColor']) {
      const value = /** @type {unknown} */ (Reflect.get(node, role));
      if (value !== undefined && value !== null) attributes.push({ role, value });
    }
    /** @type {Set<string>} */
    const buffers = new Set();
    /** @type {import('./tile-census-scene.mjs').SceneBufferUse[]} */
    const cpu = [];
    const missingCpuRoles = [];
    for (const { role, value } of attributes) {
      if (!object(value)) throw new Error('Invalid census attribute');
      const source = value.isInterleavedBufferAttribute === true ? value.data : value;
      if (!object(source)) throw new Error('Invalid census attribute source');
      for (const id of sourceIds(source)) buffers.add(id);
      if (!ArrayBuffer.isView(source.array)) { missingCpuRoles.push(role); continue; }
      const buffer = source.array.buffer;
      let id = identities.get(buffer);
      if (id === undefined) {
        id = `scene-cpu:${identities.size + 1}`;
        identities.set(buffer, id); cpuBuffers.push({ id, bytes: buffer.byteLength });
      }
      cpu.push({ id, role });
    }
    const parents = [];
    /** @type {import('three').Object3D | null} */
    let at = node;
    while (at !== null) { parents.unshift(at.name || at.type); at = at.parent; }
    nodes.push({ path: parents.join('/'), type: node.type, buffers: [...buffers], cpuBuffers: cpu,
      missingCpuRoles, worldBounds: bounds(node, geometry) });
  });
  return { nodes, cpuBuffers };
}
