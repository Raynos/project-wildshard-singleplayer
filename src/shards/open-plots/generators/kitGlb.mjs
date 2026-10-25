// RM3: owned, in-memory exports of today's kit builders. Publication and placement belong to the plot producer.
import { BufferGeometry, Float32BufferAttribute, MeshStandardMaterial } from 'three';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { normalizeWorldGlb } from '@wildshard/sdk/bake/world';
import { architecturePiece, lanternPiece, placeMovingLight } from './kit.mjs';

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

/** Own an existing static tile GLB and the palette/ordinal bindings produced by that exact source invocation.
 * Material names carry role and palette slot; far nodes retain the existing <= 40-triangle tile stand-in. */
export function architectureGlb(type, palette, variant = 0) {
  const { parts, bindings, movingLights } = architecturePiece(type, palette, variant);
  const entries = Array.from(bindings, ([name, binding]) => [binding.role, name, name, name]);
  entries.push(['solid', 'Solid', 'collide_body', 'collision']);
  return { bytes: encodeParts(parts, entries, `architecture_${type}_${variant}`), bindings, movingLights };
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
      if (source === 'Kit' || source === 'Glow' || source === 'Water') geometry.setAttribute('normal', new Float32BufferAttribute(part.normals, 3));
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
      return { role, positions: row.positions, colours: row.colours, indices: row.indices, normals: row.normals, uv: row.uv };
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
      for (const { role, positions, colours, indices, normals, uv } of geometry) for (let i = 0; i < indices.length; i += 3) {
        const points = [], rgb = [], ns = [], uvs = [];
        for (let corner = 0; corner < 3; corner++) {
          const at = indices[i + corner] * 3;
          points.push([x + positions[at], positions[at + 1], z + positions[at + 2]]);
          rgb.push([colours[at], colours[at + 1], colours[at + 2]]);
          if (normals !== null) ns.push([normals[at], normals[at + 1], normals[at + 2]]);
          if (uv !== null) { const u = indices[i + corner] * 2; uvs.push([uv[u], uv[u + 1]]); }
        }
        w.triChannels(role, points, rgb, normals === null ? null : ns, uv === null ? null : uvs);
      }
    },
  });
}

/** Admit one to three explicitly supplied variants per tile family, each with LOD0 and LOD1.
 * Levels own their decoded arrays; missing levels, duplicate variants and oversized far stand-ins refuse.
 * This build-only table chooses no distance, collision policy or variant on behalf of a caller. */
export async function prepareArchitectureVariants(sources) {
  if (!Array.isArray(sources) || sources.length === 0) throw new Error('open-plots architecture: explicit variants required');
  const keys = new Set();
  for (const { type, variant, lod0, lod1 } of sources) {
    const key = `${type}/${variant}`;
    if (!['H', 'S', 'C', 'L', 'N', 'G', 'P'].includes(type) || !Number.isInteger(variant) || variant < 0 || variant > 2
      || keys.has(key) || lod0 === undefined || lod1 === undefined) throw new Error('open-plots architecture: invalid variant or missing LOD');
    keys.add(key);
  }
  for (const { type, variant } of sources) for (let i = 0; i < variant; i++) {
    if (!keys.has(`${type}/${i}`)) throw new Error('open-plots architecture: noncontiguous variants');
  }
  const pieces = new Map();
  for (const { type, variant, lod0, lod1 } of sources) {
    const levels = [await decodeArchitecture(lod0)];
    levels.push(lod1 === lod0 ? levels[0] : await decodeArchitecture(lod1));
    if (levels[1].triangles > levels[0].triangles) throw new Error('open-plots architecture: LOD1 exceeds LOD0');
    const [a, b] = levels;
    if (a.movingLights.length !== b.movingLights.length || a.movingLights.some((light, i) => {
      const other = b.movingLights[i];
      return light.kind !== other.kind || light.position.some((value, k) => value !== other.position[k]);
    }) || !sameWords(a.collision.positions, b.collision.positions) || !sameWords(a.collision.indices, b.collision.indices)) {
      throw new Error('open-plots architecture: LOD changes collision or moving lights');
    }
    pieces.set(`${type}/${variant}`, levels.map(level => ({ roles: level.roles, movingLights: level.movingLights })));
  }
  return Object.freeze({
    placeArchitecture(w, type, variant, lod = 0) {
      if (!['H', 'S', 'C', 'L', 'N', 'G', 'P'].includes(type) || !Number.isInteger(variant) || !Number.isInteger(lod) || lod < 0 || lod > 1) throw new Error('open-plots architecture: invalid LOD');
      const levels = pieces.get(`${type}/${variant}`);
      if (levels === undefined) throw new Error('open-plots architecture: invalid placement variant');
      placeArchitecture(w, levels[lod]);
    },
  });
}

function sameWords(a, b) {
  return a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
}

async function decodeArchitecture(source) {
  const { bytes, bindings, movingLights } = source;
  if (!(bytes instanceof Uint8Array) || bytes.length === 0 || !(bindings instanceof Map) || !Array.isArray(movingLights)) {
    throw new Error('open-plots architecture: invalid owned GLB source');
  }
  const materials = Object.fromEntries([...bindings.keys(), 'collision'].map(name => [name, 'kit']));
  const decoded = await normalizeWorldGlb(bytes, { glb: 'architecture.glb', materials, colliders: 'nodes:collide_', far: 'far_' }, ['kit']);
  const roles = new Map();
  for (const row of decoded.static) {
    const binding = bindings.get(row.node);
    if (binding === undefined || !['Kit', 'Glow', 'Pool', 'Water'].includes(binding.role) || row.colours === null || row.colours.length !== row.positions.length
      || row.indices.length !== binding.ordinals.length * 3) throw new Error('open-plots architecture: incomplete palette geometry');
    let triangles = roles.get(binding.role);
    if (triangles === undefined) { triangles = []; roles.set(binding.role, triangles); }
    for (let i = 0; i < binding.ordinals.length; i++) {
      triangles.push({ ordinal: binding.ordinals[i], at: i * 3, positions: row.positions, colours: row.colours,
        indices: row.indices, normals: row.normals, uv: row.uv });
    }
  }
  for (const triangles of roles.values()) {
    triangles.sort((a, b) => a.ordinal - b.ordinal);
    if (triangles.some((triangle, i) => triangle.ordinal !== i)) throw new Error('open-plots architecture: invalid triangle order');
  }
  const farTriangles = decoded.far.reduce((count, row) => count + row.indices.length / 3, 0);
  if (farTriangles === 0 || farTriangles > 40 || decoded.collision.length !== 1) throw new Error('open-plots architecture: invalid far or collision piece');
  const glowCount = roles.get('Glow')?.length ?? 0;
  const invalidLight = movingLights.some((light, i) => {
    if (!['firefly', 'sky-lantern'].includes(light.kind)) return true;
    if (!Array.isArray(light.position)) return true;
    if (light.position.length !== 3) return true;
    if (light.position.some(value => !Number.isFinite(value))) return true;
    if (!Number.isInteger(light.ordinal)) return true;
    if (light.ordinal < 0 || light.ordinal > glowCount) return true;
    return i > 0 && light.ordinal < movingLights[i - 1].ordinal;
  });
  if (invalidLight) throw new Error('open-plots architecture: invalid moving-light order');
  if (movingLights.length > 0 && !roles.has('Glow')) roles.set('Glow', []);
  return { roles, movingLights: movingLights.map(light => ({ kind: light.kind, ordinal: light.ordinal, position: [...light.position] })),
    triangles: [...roles.values()].reduce((count, rows) => count + rows.length, 0), collision: decoded.collision[0] };
}

function placeArchitecture(w, piece) {
  for (const [role, triangles] of piece.roles) {
    let moving = 0;
    for (let triangle = 0; triangle <= triangles.length; triangle++) {
      if (role === 'Glow') while (piece.movingLights[moving]?.ordinal === triangle) {
        const light = piece.movingLights[moving++]; placeMovingLight(w, light.kind, light.position);
      }
      if (triangle === triangles.length) continue;
      const { at, positions, colours, indices, normals, uv } = triangles[triangle];
      const points = [], rgb = [], ns = [], uvs = [];
      for (let corner = 0; corner < 3; corner++) {
        const i = indices[at + corner] * 3;
        points.push([positions[i], positions[i + 1], positions[i + 2]]);
        rgb.push([colours[i], colours[i + 1], colours[i + 2]]);
        if (normals !== null) ns.push([normals[i], normals[i + 1], normals[i + 2]]);
        if (uv !== null) { const u = indices[at + corner] * 2; uvs.push([uv[u], uv[u + 1]]); }
      }
      w.triChannels(role, points, rgb, normals === null ? null : ns, uv === null ? null : uvs);
    }
  }
}

/** Keep today's one/two-variant choices and existing low-poly geometry at both levels.
 * RM4 supplies distinct authored models later; no reduced-LOD or third-art-variant claim is made here. */
export async function prepareArchitectureKit(palette) {
  const sources = [];
  for (const [type, variant] of [['H', 0], ['H', 1], ['S', 0], ['C', 0], ['L', 0], ['N', 0], ['G', 0], ['G', 1], ['P', 0]]) {
    const piece = architectureGlb(type, palette, variant);
    sources.push({ type, variant, lod0: piece, lod1: piece });
  }
  const prepared = await prepareArchitectureVariants(sources);
  return Object.freeze({
    placeArchitecture(w, type, variant) {
      if (!['H', 'S', 'C', 'L', 'N', 'G', 'P'].includes(type)) return false;
      prepared.placeArchitecture(w, type, type === 'H' || type === 'G' ? variant : 0, 0);
      return true;
    },
  });
}

/** Owned build-time kit; no decoded buffers, placement callbacks or decoder services enter the product. */
export async function preparePlotKit(palette) {
  const lanterns = await prepareLanternKit(palette), architecture = await prepareArchitectureKit(palette);
  return Object.freeze({ ...lanterns, ...architecture });
}
