// RM3: owned, in-memory exports of today's kit builders. Publication and placement belong to the plot producer.
import { BufferGeometry, Float32BufferAttribute, MeshStandardMaterial } from 'three';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { normalizeWorldGlb } from '@wildshard/sdk/bake/world';
import { architecturePiece, lanternPiece } from './kit.mjs';

/** Export the existing post, glow, pool and collision triangles without changing their vertex colours.
 * Palette slots are named materials with a neutral factor; the three visual parts keep their existing shader roles.
 * No filesystem access, placement, light bake or moving-light seed is performed here. */
export function lanternGlb(palette, height = 2.8) {
  const parts = lanternPiece(palette, height);
  return encodeParts(parts, [
    ['Kit', 'Kit', 'lantern_post', 'wood'], ['Glow', 'Glow', 'lantern_glow', 'lantern'],
    ['Pool', 'Pool', 'lantern_pool', 'pool'], ['solid', 'Solid', 'collide_post', 'collision'],
  ], 'lantern');
}

/** Own the existing house/stall GLB and the palette/ordinal bindings produced by that exact source invocation.
 * Material names carry role and palette slot; far nodes retain the existing <= 40-triangle tile stand-in. */
export function architectureGlb(type, palette, variant = 0) {
  const { parts, bindings } = architecturePiece(type, palette, variant);
  const entries = Array.from(bindings, ([name, binding]) => [binding.role, name, name, name]);
  entries.push(['solid', 'Solid', 'collide_body', 'collision']);
  return { bytes: encodeParts(parts, entries, `architecture_${type}_${variant}`), bindings };
}

function encodeParts(parts, entries, name) {
  const primitives = [];
  try {
    for (const [source, partName, nodeName, slot] of entries) {
      const part = parts[source].part(partName);
      const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(part.positions, 3));
      const material = new MeshStandardMaterial({ roughness: source === 'Kit' ? 0.9 : 1, metalness: 0 });
      material.name = slot;
      primitives.push({ name: nodeName, geometry, material, compactIndex: true });
      if (source !== 'solid') geometry.setAttribute('color', new Float32BufferAttribute(part.colours, 3));
      if (source === 'Kit' || source === 'Glow') geometry.setAttribute('normal', new Float32BufferAttribute(part.normals, 3));
    }
    return staticGlb(primitives, name);
  } finally {
    for (const { geometry, material } of primitives) { geometry.dispose(); material.dispose(); }
  }
}

/** Decode the four existing GLB heights once per build, then place their visual triangles through the tile writer.
 * Collision stays with the source box's double-precision arithmetic. No model or decoder survives the build. */
export async function prepareLanternKit(palette) {
  const pieces = new Map();
  for (const height of [2.2, 2.4, 2.6, 2.8]) {
    const decoded = await normalizeWorldGlb(lanternGlb(palette, height), {
      glb: 'lantern.glb', colliders: 'nodes:collide_',
      materials: { wood: 'wood', lantern: 'lantern', pool: 'pool', collision: 'collision' },
    }, ['wood', 'lantern', 'pool', 'collision']);
    const roles = { lantern_post: 'Kit', lantern_glow: 'Glow', lantern_pool: 'Pool' };
    const geometry = decoded.static.map(row => {
      const role = roles[row.node];
      if (role === undefined || row.colours === null || row.colours.length !== row.positions.length) {
        throw new Error('open-plots lantern: missing visual palette channel');
      }
      return { role, positions: row.positions, colours: row.colours, indices: row.indices };
    });
    if (geometry.length !== 3 || new Set(geometry.map(row => row.role)).size !== 3 || decoded.collision.length !== 1) {
      throw new Error('open-plots lantern: incomplete GLB piece');
    }
    pieces.set(height, geometry);
  }
  return Object.freeze({
    placeLantern(w, x, z, height) {
      const geometry = pieces.get(height);
      if (geometry === undefined || !Number.isFinite(x) || !Number.isFinite(z)) throw new Error('open-plots lantern: invalid placement');
      for (const { role, positions, colours, indices } of geometry) for (let i = 0; i < indices.length; i += 3) {
        const points = [], rgb = [];
        for (let corner = 0; corner < 3; corner++) {
          const at = indices[i + corner] * 3;
          points.push([x + positions[at], positions[at + 1], z + positions[at + 2]]);
          rgb.push([colours[at], colours[at + 1], colours[at + 2]]);
        }
        w.triColours(role, points[0], points[1], points[2], rgb);
      }
    },
  });
}

/** Decode existing architecture once and restore its original per-role triangle order after palette-slot grouping.
 * Far stand-ins are checked here; the layout keeps drawing its original far and collision recipes. */
export async function prepareArchitectureKit(palette) {
  const pieces = new Map();
  for (const [type, variant] of [['H', 0], ['H', 1], ['S', 0]]) {
    const { bytes, bindings } = architectureGlb(type, palette, variant);
    const materials = Object.fromEntries([...bindings.keys(), 'collision'].map(name => [name, 'kit']));
    const decoded = await normalizeWorldGlb(bytes, { glb: 'architecture.glb', materials, colliders: 'nodes:collide_', far: 'far_' }, ['kit']);
    const roles = new Map();
    for (const row of decoded.static) {
      const binding = bindings.get(row.node);
      if (binding === undefined || row.colours === null || row.colours.length !== row.positions.length
        || row.indices.length !== binding.ordinals.length * 3) throw new Error('open-plots architecture: incomplete palette geometry');
      let triangles = roles.get(binding.role);
      if (triangles === undefined) { triangles = []; roles.set(binding.role, triangles); }
      for (let i = 0; i < binding.ordinals.length; i++) {
        triangles.push({ ordinal: binding.ordinals[i], at: i * 3, positions: row.positions, colours: row.colours, indices: row.indices });
      }
    }
    for (const triangles of roles.values()) {
      triangles.sort((a, b) => a.ordinal - b.ordinal);
      if (triangles.some((triangle, i) => triangle.ordinal !== i)) throw new Error('open-plots architecture: invalid triangle order');
    }
    const farTriangles = decoded.far.reduce((count, row) => count + row.indices.length / 3, 0);
    if (farTriangles === 0 || farTriangles > 40 || decoded.collision.length !== 1) throw new Error('open-plots architecture: invalid far or collision piece');
    pieces.set(`${type}/${variant}`, roles);
  }
  return Object.freeze({
    placeArchitecture(w, type, variant) {
      if (type !== 'H' && type !== 'S') return false;
      const roles = pieces.get(`${type}/${type === 'S' ? 0 : variant}`);
      if (roles === undefined) throw new Error('open-plots architecture: invalid placement variant');
      for (const [role, triangles] of roles) for (const { at, positions, colours, indices } of triangles) {
        const points = [], rgb = [];
        for (let corner = 0; corner < 3; corner++) {
          const i = indices[at + corner] * 3;
          points.push([positions[i], positions[i + 1], positions[i + 2]]);
          rgb.push([colours[i], colours[i + 1], colours[i + 2]]);
        }
        w.triColours(role, points[0], points[1], points[2], rgb);
      }
      return true;
    },
  });
}

/** Owned build-time kit; no decoded buffers, placement callbacks or decoder services enter the product. */
export async function preparePlotKit(palette) {
  const lanterns = await prepareLanternKit(palette), architecture = await prepareArchitectureKit(palette);
  return Object.freeze({ ...lanterns, ...architecture });
}
