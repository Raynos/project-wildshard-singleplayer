/** Grid-only XZ containment. Admit each draw once; recheck its bounds after a pose or geometry change.
 * Only an edge-crossing draw gains a shader patch. Platform road, floor and sky live outside these roots. */
import { BatchedMesh, Bone, Box3, BufferAttribute, InstancedMesh, Line, Color, Material, Matrix4, Mesh, Points, RawShaderMaterial, ShaderMaterial, SkinnedMesh, Sprite, Vector3, Vector4, BufferGeometry, Sphere, type Camera, Object3D } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { PATCH_ORDER, copyShaderPatches, patchShader } from '@wildshard/engine/render/shaderPatches';
import { geometryBoundsSteps } from '@wildshard/engine/world/geometryBounds';
import { onCellField, onCellMethods } from './cellChanges';
import { skinEnvelope, uploadedSkinBounds } from './skinEnvelope';
import { guardObjectDraw, type DrawGuard } from '@wildshard/engine/render/drawGuards';
import { instanceEnvelope } from '@wildshard/engine/render/instancedGeometry';

export interface CellClipState { readonly meshes: number; readonly materials: number; readonly unclipped: number; readonly checked: number; readonly refused: number }
export interface CellClip {
  /** Admit a pre-existing tree. Later child additions are admitted synchronously, without a frame sweep. */
  readonly sweep: () => number;
  readonly state: () => CellClipState;
  /** Explicit entry/preparation flush. Ordinary frames validate lazily at final submission. */
  readonly update: () => void;
  /** Whether explicit mutation events have queued draw validation. */
  readonly changed: () => boolean;
}
type Draw = Mesh<BufferGeometry, Material | Material[]> | Line<BufferGeometry, Material | Material[]> | Points<BufferGeometry, Material | Material[]> | Sprite;
const isDraw = (node: Object3D): node is Draw => node instanceof Mesh || node instanceof Line || node instanceof Points || node instanceof Sprite;
const isSkin = (node: Object3D): node is SkinnedMesh => node instanceof SkinnedMesh;
const isMaterial = (value: unknown): value is Material => value instanceof Material;
const MAIN = /void\s+main\s*\(\s*(?:void)?\s*\)/;

/** Extend the old lit-sheet clip to basic, graph, custom, line, point and sprite programs.
 * The final projected vertex includes instancing, skinning and shader displacement. */
function clipProgram(material: Material, cell: { value: Vector4 }, camera: { value: Matrix4 }, scope: Scope): void {
  patchShader(material, 'grid-cell-clip', PATCH_ORDER.view, shader => {
    if (!MAIN.test(shader.vertexShader) || !MAIN.test(shader.fragmentShader)) throw new Error('Cell draw has no clippable shader main');
    shader.uniforms['wsCellClip'] = cell;
    shader.uniforms['wsCellClipToWorld'] = camera;
    const vertex = shader.vertexShader.replace(MAIN, 'void wsCellVertex()');
    shader.vertexShader = `
#if __VERSION__ >= 300
out highp vec3 wsCellWorld;
#else
varying highp vec3 wsCellWorld;
#endif
uniform highp mat4 wsCellClipToWorld;
${vertex}
void main() {
  wsCellVertex();
  vec4 cellWorld = wsCellClipToWorld * gl_Position;
  wsCellWorld = cellWorld.xyz / cellWorld.w;
}`;
    shader.fragmentShader = `
#if __VERSION__ >= 300
in highp vec3 wsCellWorld;
#else
varying highp vec3 wsCellWorld;
#endif
uniform highp vec4 wsCellClip;
${shader.fragmentShader.replace(MAIN, 'void wsCellFragment()')}
void main() {
  if (wsCellWorld.x < wsCellClip.x || wsCellWorld.z < wsCellClip.y || wsCellWorld.x > wsCellClip.z || wsCellWorld.z > wsCellClip.w) discard;
  wsCellFragment();
}`;
  }, { key: prior => `${prior}|grid-cell-clip`, scope });
  material.needsUpdate = true;
}

/** A conservative local box over an instanced draw's copies: each copy's geometry sphere, moved and scaled by its matrix. */
function copySpheres(sphere: Sphere, m: ArrayLike<number>, count: number, target: Box3): Box3 {
  target.makeEmpty();
  if (sphere.radius < 0) return target;
  const cx = sphere.center.x, cy = sphere.center.y, cz = sphere.center.z, r = sphere.radius;
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0, o = 0; i < count; i++, o += 16) {
    const a0 = m[o] ?? 0, a1 = m[o + 1] ?? 0, a2 = m[o + 2] ?? 0, a4 = m[o + 4] ?? 0, a5 = m[o + 5] ?? 0, a6 = m[o + 6] ?? 0;
    const a8 = m[o + 8] ?? 0, a9 = m[o + 9] ?? 0, a10 = m[o + 10] ?? 0;
    const k = r * Math.sqrt(Math.max(a0 * a0 + a1 * a1 + a2 * a2, a4 * a4 + a5 * a5 + a6 * a6, a8 * a8 + a9 * a9 + a10 * a10));
    const x = a0 * cx + a4 * cy + a8 * cz + (m[o + 12] ?? 0), y = a1 * cx + a5 * cy + a9 * cz + (m[o + 13] ?? 0), z = a2 * cx + a6 * cy + a10 * cz + (m[o + 14] ?? 0);
    minX = Math.min(minX, x - k); minY = Math.min(minY, y - k); minZ = Math.min(minZ, z - k);
    maxX = Math.max(maxX, x + k); maxY = Math.max(maxY, y + k); maxZ = Math.max(maxZ, z + k);
  }
  target.min.set(minX, minY, minZ); target.max.set(maxX, maxY, maxZ);
  return target;
}

/** Exact affine XZ projection of an AABB. Height contributes through rotated
 * axes but has no clipping plane. Unusual projective object matrices keep the
 * general eight-corner path. */
function projectBounds(local: Box3, world: Matrix4, target: Box3): Box3 {
  const m = world.elements;
  if (m[3] !== 0 || m[7] !== 0 || m[11] !== 0 || m[15] !== 1) return target.copy(local).applyMatrix4(world);
  const a = local.min, b = local.max, x = (a.x + b.x) * 0.5, y = (a.y + b.y) * 0.5, z = (a.z + b.z) * 0.5;
  const ex = (b.x - a.x) * 0.5, ey = (b.y - a.y) * 0.5, ez = (b.z - a.z) * 0.5;
  const cx = m[0] * x + m[4] * y + m[8] * z + m[12], cz = m[2] * x + m[6] * y + m[10] * z + m[14];
  const rx = Math.abs(m[0]) * ex + Math.abs(m[4]) * ey + Math.abs(m[8]) * ez;
  const rz = Math.abs(m[2]) * ex + Math.abs(m[6]) * ey + Math.abs(m[10]) * ez;
  target.min.set(cx - rx, 0, cz - rz); target.max.set(cx + rx, 0, cz + rz); return target;
}

/** Clip edge-crossing draws at the exact inclusive cell edge. No road-band or dome exemption. */
export function cellClip(root: Object3D, half: number, scope: Scope): CellClip {
  const cell = { value: new Vector4(-half, -half, half, half) }, origin = new Vector3(), box = new Box3(), camera = { value: new Matrix4() }, submittedWorld = new Matrix4(), alternate = new Box3();
  root.updateWorldMatrix(true, false); origin.setFromMatrixPosition(root.matrixWorld);
  if (!Number.isFinite(origin.x) || !Number.isFinite(origin.z)) throw new Error('Cell origin is not finite');
  cell.value.set(origin.x - half, origin.z - half, origin.x + half, origin.z + half);
  const variantScopes = new Map<Material, Scope>(), users = new Map<Material, Set<Draw>>(), drawVariants = new WeakMap<Draw, Set<Material>>();
  const watched = new Map<Object3D, () => void>(), patched = new Map<Material, Material>(), clipped = new WeakSet<Draw>(), ownedVariants = new WeakSet<Material>();
  const refused = new Map<Draw, boolean>();
  const dirty = new Map<Object3D, boolean>(), forced = new Set<Object3D>(), dependents = new Map<Object3D, Set<Draw>>();
  const descendants = new Map<Object3D, Set<Draw>>(), samePose = new Map<Object3D, () => boolean>();
  const gates = new Map<Draw, () => void>(), pending = new Set<Draw>();
  const skinVersions = new WeakMap<SkinnedMesh, number>();
  const skinBounds = new WeakMap<SkinnedMesh, (() => Box3) | null>();
  // An instanced draw's bounds walk every copy: keep them while its copies, count and geometry are the ones last walked
  // (the construction sweep's walk then serves the activation and first-draw checks).
  const instanceWalks = new WeakMap<object, { readonly geometry: unknown; readonly version: number; readonly count: number }>();
  let meshes = 0, checked = 0, checking = false, submitting = false;
  let flush = (): void => undefined;
  let validate = (_node: Draw, _submitted: boolean, _view?: Camera): void => undefined;
  const boneOwned = (node: Object3D): boolean => { for (let parent = node.parent; parent !== null && parent !== root; parent = parent.parent) if (parent instanceof Bone) return true; return false; };
  const customDraw = (node: Draw): boolean => node.onBeforeRender !== Object3D.prototype.onBeforeRender;
  const gate = (node: Draw): void => {
    if (gates.has(node)) return;
    const attached = boneOwned(node);
    const admitCellDraw: DrawGuard = (view, _scene, geometry, material) => {
      if (geometry !== node.geometry) return false;
      const moved = dirty.size > 0 || attached;
      submitting = true;
      try { flush(); } finally { submitting = false; }
      if (attached) pending.add(node);
      if (isSkin(node)) {
        const version = node.skeleton.boneTexture?.version ?? -1;
        if (version !== skinVersions.get(node)) { skinVersions.set(node, version); pending.add(node); }
      }
      validate(node, true, moved ? view : undefined);
      if (clipped.has(node)) camera.value.multiplyMatrices(view.matrixWorld, view.projectionMatrixInverse);
      const active = Array.isArray(node.material) ? node.material.includes(material) : node.material === material;
      return !refused.has(node) && (active || (!clipped.has(node) && !ownedVariants.has(material)));
    };
    gates.set(node, guardObjectDraw(node, admitCellDraw, scope));
  };
  const unclip = (node: Draw): void => {
    const sourceOf = (material: Material): Material => {
      for (const [source, variant] of patched) if (variant === material) return source;
      return material;
    };
    Reflect.set(node, 'material', Array.isArray(node.material) ? node.material.map(sourceOf) : sourceOf(node.material));
    for (const variant of drawVariants.get(node) ?? []) {
      const held = users.get(variant); held?.delete(node);
      if (held?.size === 0) {
        variantScopes.get(variant)?.dispose(); variantScopes.delete(variant); users.delete(variant);
        for (const [source, cached] of patched) if (cached === variant) patched.delete(source);
      }
    }
    drawVariants.delete(node);
    if (clipped.delete(node)) meshes--;
  };
  const within = (bounds: Box3): boolean => {
    const rounding = Number.EPSILON * Math.max(half, Math.abs(origin.x), Math.abs(origin.z)) * 32;
    return bounds.min.x >= cell.value.x - rounding && bounds.max.x <= cell.value.z + rounding && bounds.min.z >= cell.value.y - rounding && bounds.max.z <= cell.value.w + rounding;
  };
  const check = (node: Draw, submitted = false, view?: Camera): void => {
    checked++; if (!submitted) node.updateWorldMatrix(true, false);
    const held = drawVariants.get(node);
    if (held !== undefined) {
      const current = node.material;
      if (Array.isArray(current) ? current.some(material => !held.has(material)) : !held.has(current)) unclip(node);
    }
    if (!node.geometry.hasAttribute('position') || node.geometry.getAttribute('position').count === 0) return;
    const declared = node instanceof InstancedMesh && !node.castShadow ? instanceEnvelope(node) : undefined;
    const copiesBox = declared === undefined || declared.isEmpty() ? undefined : declared;
    if (node instanceof Sprite) {
      const scale = node.getWorldScale(new Vector3());
      const radius = Math.hypot(Math.max(Math.abs(node.center.x), Math.abs(1 - node.center.x)) * scale.x,
        Math.max(Math.abs(node.center.y), Math.abs(1 - node.center.y)) * scale.y);
      box.setFromCenterAndSize(node.getWorldPosition(new Vector3()), new Vector3(radius * 2, radius * 2, radius * 2));
    } else if (isSkin(node)) {
      if (!submitted) {
        node.updateMatrixWorld(true);
        const bones = new Set<Object3D>(node.skeleton.bones);
        for (const bone of bones) if (!(bone.parent instanceof Bone) || !bones.has(bone.parent)) bone.updateWorldMatrix(true, true);
        node.skeleton.update();
      }
      let envelope = skinBounds.get(node);
      if (envelope === undefined) { envelope = skinEnvelope(node); skinBounds.set(node, envelope); }
      const local = envelope === null ? uploadedSkinBounds(node, alternate) : envelope();
      if (view === undefined) projectBounds(local, node.matrixWorld, box);
      else {
        submittedWorld.multiplyMatrices(view.matrixWorld, node.modelViewMatrix);
        projectBounds(local, submittedWorld, box);
        box.union(projectBounds(local, node.matrixWorld, alternate));
      }
    } else if (copiesBox !== undefined) {
      // a culled draw's declared envelope over every copy it may show: one decision whichever copies are drawn (none yet
      // at entry), so its clipped program is prepared with the cell. A caster keeps its copies' test: crossing, it is refused.
      projectBounds(copiesBox, node.matrixWorld, box);
    } else if (node instanceof InstancedMesh && node.count === 0) {
      return;
    } else if (node instanceof InstancedMesh || node instanceof BatchedMesh) {
      // Most copies lie well inside the cell: their spheres, moved by their matrices, settle it without the exact walk over
      // eight corners of every copy (25 ms of Pine's entry frames at 4x CPU, where its copies had just moved).
      const shape: unknown = node.geometry;
      if (shape instanceof BufferGeometry && shape.boundingSphere === null) shape.computeBoundingSphere();
      const sphere: unknown = shape instanceof BufferGeometry ? shape.boundingSphere : null;
      if (!(node instanceof InstancedMesh) || !(sphere instanceof Sphere)
        || !within(projectBounds(copySpheres(sphere, node.instanceMatrix.array, node.count, alternate), node.matrixWorld, box))) {
        const walked = node instanceof InstancedMesh ? instanceWalks.get(node) : undefined;
        if (node.boundingBox === null || !(node instanceof InstancedMesh) || walked === undefined || walked.geometry !== node.geometry
          || walked.version !== node.instanceMatrix.version || walked.count !== node.count) {
          node.computeBoundingBox();
          if (node instanceof InstancedMesh) instanceWalks.set(node, { geometry: node.geometry, version: node.instanceMatrix.version, count: node.count });
        }
        if (node.boundingBox === null) throw new Error('Cell draw has no instance bounds');
        projectBounds(node.boundingBox, node.matrixWorld, box);
      }
    } else {
      if (node.geometry.boundingBox === null) for (const _step of geometryBoundsSteps(node.geometry, 'box')) { /* exact admission scan */ }
      if (node.geometry.boundingBox === null) throw new Error('Cell draw has no geometry bounds');
      projectBounds(node.geometry.boundingBox, node.matrixWorld, box);
    }
    if (!Number.isFinite(box.min.x) || !Number.isFinite(box.min.y) || !Number.isFinite(box.min.z)
      || !Number.isFinite(box.max.x) || !Number.isFinite(box.max.y) || !Number.isFinite(box.max.z)) throw new Error('Cell draw has nonfinite bounds');
    if (within(box)) {
      const visible = refused.get(node);
      if (visible !== undefined) { node.visible = visible; refused.delete(node); }
      if (clipped.has(node)) unclip(node);
      return;
    }
    // Refuse a crossing shadow caster as a whole: clipping only its colour
    // program would still upload its out-of-cell triangles into shadow maps.
    if (node.castShadow) { if (!refused.has(node)) refused.set(node, node.visible); node.visible = false; return; }
    const source: unknown = node.material;
    const candidates: readonly unknown[] = Array.isArray(source) ? source : [source];
    const list = candidates.map(value => { if (!isMaterial(value)) throw new Error('Cell draw has no material'); return value; });
    // A raw program owns its coordinate/GLSL contract. Refuse its crossing draw
    // rather than assume the standard camera uniforms or add a second program.
    if (list.some(material => material instanceof RawShaderMaterial)) { if (!refused.has(node)) refused.set(node, node.visible); node.visible = false; return; }
    const visible = refused.get(node);
    if (visible !== undefined) { node.visible = visible; refused.delete(node); }
    const variants = list.map(material => {
      if ([...patched.values()].includes(material)) return material;
      let variant = patched.get(material);
      if (variant === undefined) {
        variant = material.clone(); ownedVariants.add(variant); copyShaderPatches(material, variant);
        // Shared content keeps its original material. Animated colours and shader
        // uniform cells remain borrowed; the clip uniform belongs to this variant.
        for (const [key, value] of Object.entries(material)) if (value instanceof Color) Reflect.set(variant, key, value);
        if (material instanceof ShaderMaterial && variant instanceof ShaderMaterial) variant.uniforms = { ...material.uniforms };
        const variantScope = scope.child('cell.clip-material');
        variantScopes.set(variant, variantScope); users.set(variant, new Set());
        patched.set(material, variant); variantScope.own(variant); clipProgram(variant, cell, camera, variantScope);
        const borrowed = variant;
        variantScope.onDispose(onCellField(material, 'opacity', () => { borrowed.opacity = material.opacity; }));
        variantScope.onDispose(onCellField(material, 'visible', () => { borrowed.visible = material.visible; }));
      }
      return variant;
    });
    for (const variant of variants) users.get(variant)?.add(node);
    drawVariants.set(node, new Set(variants));
    if (Array.isArray(node.material)) node.material = variants;
    else {
      const variant = variants[0];
      if (variant === undefined) throw new Error('Cell draw has no material');
      Reflect.set(node, 'material', variant);
    }
    if (!clipped.has(node)) { clipped.add(node); meshes++; }
    gate(node);
  };
  const shown = (node: Object3D): boolean => {
    for (let parent: Object3D | null = node; parent !== null; parent = parent.parent) if (!parent.visible && !(isDraw(parent) && refused.has(parent))) return false;
    return true;
  };
  const mark = (node: Object3D, tree = false, force = !tree): void => {
    if (checking || !watched.has(node)) return;
    if (force) forced.add(node);
    const repeated = dirty.get(node) === true || (!tree && dirty.has(node));
    if (repeated && refused.size === 0) return;
    if (!shown(node)) { samePose.get(node)?.(); forced.delete(node); return; } // Reveal forces fresh bounds for the whole subtree.
    dirty.set(node, tree || dirty.get(node) === true);
    if (tree) for (const draw of descendants.get(node) ?? []) gate(draw);
    else if (isDraw(node)) gate(node);
    for (const skin of dependents.get(node) ?? []) gate(skin);
    if (refused.size > 0) {
      // Invisible refusals never reach the renderer. Reconsider them only on an
      // explicit change, while keeping the queued final-pose check for siblings.
      const reconsider = (draw: Draw): void => {
        if (!refused.has(draw)) return;
        forced.add(node); pending.add(draw); validate(draw, false);
      };
      if (tree) for (const draw of descendants.get(node) ?? []) reconsider(draw);
      else if (isDraw(node)) reconsider(node);
      for (const skin of dependents.get(node) ?? []) reconsider(skin);
    }
  };
  validate = (draw: Draw, submitted: boolean, view?: Camera): void => {
    if (!pending.delete(draw)) return;
    checking = true;
    try {
      check(draw, submitted, view);
      if (dirty.size === 0 && !clipped.has(draw) && !refused.has(draw) && !customDraw(draw) && !(isSkin(draw)) && !boneOwned(draw)) { gates.get(draw)?.(); gates.delete(draw); }
    } finally { checking = false; }
  };
  flush = (): void => {
    if (dirty.size === 0 || checking) return;
    const changed = [...dirty].filter(([node, tree]) => {
      const unchanged = samePose.get(node)?.() ?? false;
      if (!forced.has(node) && tree && unchanged) {
        for (const draw of descendants.get(node) ?? []) {
          if (!pending.has(draw) && !clipped.has(draw) && !refused.has(draw) && !customDraw(draw) && !isSkin(draw) && !boneOwned(draw)) { gates.get(draw)?.(); gates.delete(draw); }
        }
      }
      return forced.has(node) || !tree || !unchanged;
    }); dirty.clear(); forced.clear();
    const draws = new Set<Draw>();
    const collect = (node: Object3D): void => {
      if (isDraw(node) && watched.has(node)) draws.add(node);
      for (const skin of dependents.get(node) ?? []) draws.add(skin);
    };
    const trees = new Set(changed.filter(([, tree]) => tree).map(([node]) => node));
    for (const [node, tree] of changed) {
      let covered = false;
      for (let parent = node.parent; parent !== null && !covered; parent = parent.parent) covered = trees.has(parent);
      if (covered) continue;
      if (tree) for (const draw of descendants.get(node) ?? []) collect(draw);
      collect(node);
    }
    for (const draw of draws) {
      if (!shown(draw)) continue;
      pending.add(draw);
      // Bone animation can invalidate many offscreen skins. Their final draw
      // gate checks the current pose only if the renderer submits that skin.
      if (submitting || (isSkin(draw) && !refused.has(draw))) gate(draw);
      else validate(draw, false);
    }
  };
  const unwatchNode = (node: Object3D): void => {
    watched.get(node)?.(); watched.delete(node); dirty.delete(node); forced.delete(node); samePose.delete(node);
    if (isDraw(node)) {
      gates.get(node)?.(); gates.delete(node); pending.delete(node);
      const visible = refused.get(node); if (visible !== undefined) node.visible = visible; refused.delete(node);
      unclip(node);
    }
  };
  const unwatch = (node: Object3D): void => { unwatchNode(node); for (const child of node.children) unwatch(child); };
  const watch = (node: Object3D): void => {
    if (watched.has(node)) return;
    const undo: (() => void)[] = [];
    watched.set(node, () => { for (const restore of undo.reverse()) restore(); });
    const moved = (): void => { node.matrixWorldNeedsUpdate = true; mark(node, true); };
    if (!(node instanceof Bone)) {
      const p = node.position, size = node.scale;
      let px = p.x, py = p.y, pz = p.z, sx = size.x, sy = size.y, sz = size.z, auto = node.matrixAutoUpdate;
      const q = node.quaternion;
      let x = q.x, y = q.y, z = q.z, w = q.w;
      let checkedX = x, checkedY = y, checkedZ = z, checkedW = w;
      const matrix = node.matrix.elements.slice();
      samePose.set(node, () => {
        const parent = node.parent?.matrixWorld.elements;
        const heightAffectsXZ = parent !== undefined && (parent[4] !== 0 || parent[6] !== 0);
        const unchanged = px === p.x && (!heightAffectsXZ || py === p.y) && pz === p.z && sx === size.x && sy === size.y && sz === size.z
          && checkedX === q.x && checkedY === q.y && checkedZ === q.z && checkedW === q.w && auto === node.matrixAutoUpdate
          && (auto || matrix.every((value, index) => value === node.matrix.elements[index]));
        px = p.x; py = p.y; pz = p.z; sx = size.x; sy = size.y; sz = size.z;
        checkedX = q.x; checkedY = q.y; checkedZ = q.z; checkedW = q.w; auto = node.matrixAutoUpdate;
        if (!auto) for (let i = 0; i < matrix.length; i++) matrix[i] = node.matrix.elements[i] ?? Number.NaN;
        return unchanged;
      });
      for (const key of ['x', 'z']) undo.push(onCellField(p, key, moved));
      undo.push(onCellField(p, 'y', () => {
        node.matrixWorldNeedsUpdate = true;
        const parent = node.parent?.matrixWorld.elements;
        if (parent !== undefined && (parent[4] !== 0 || parent[6] !== 0)) mark(node, true);
        else py = p.y;
      }));
      for (const key of ['x', 'y', 'z']) undo.push(onCellField(size, key, moved));
      const rotated = (): void => {
        if (x === q.x && y === q.y && z === q.z && w === q.w) return;
        x = q.x; y = q.y; z = q.z; w = q.w; moved();
      };
      undo.push(onCellMethods(q, ['_onChangeCallback'], rotated));
      undo.push(onCellMethods(node.rotation, ['_onChangeCallback'], rotated));
    }
    // Matrix-auto objects already emit via position/scale/quaternion. Explicit
    // matrix writers use these mutation methods; renderer compose is excluded.
    const matrixMethods = ['set', 'identity', 'copy', 'copyPosition', 'setPosition', 'multiply', 'premultiply', 'multiplyMatrices', 'multiplyScalar', 'transpose', 'invert', 'scale', 'makeTranslation', 'makeRotationX', 'makeRotationY', 'makeRotationZ', 'makeRotationAxis', 'makeScale', 'makeShear', 'fromArray'];
    undo.push(onCellMethods(node.matrix, matrixMethods, moved));
    let manualStop: () => void = () => undefined;
    const manual = (): void => {
      manualStop();
      const stopFlag = node.matrixAutoUpdate ? () => undefined : onCellField(node, 'matrixWorldNeedsUpdate', () => { if (node.matrixWorldNeedsUpdate) mark(node, true); });
      const stopCompose = node.matrixAutoUpdate ? () => undefined : onCellMethods(node.matrix, ['compose'], moved);
      manualStop = () => { stopFlag(); stopCompose(); };
    };
    manual(); undo.push(() => { manualStop(); });
    undo.push(onCellField(node, 'matrixAutoUpdate', () => { manual(); moved(); }));
    undo.push(onCellField(node, 'visible', () => { if (!checking && node.visible) mark(node, true, true); }));
    undo.push(scope.listenEmitter(node, 'childadded', (event: { child: Object3D }): void => { watch(event.child); }));
    undo.push(scope.listenEmitter(node, 'childremoved', (event: { child: Object3D }): void => { unwatch(event.child); }));
    if (isDraw(node)) {
      for (let parent: Object3D | null = node; parent !== null; parent = parent.parent) {
        const ancestor = parent;
        let list = descendants.get(ancestor); if (list === undefined) { list = new Set(); descendants.set(ancestor, list); }
        const held = list; held.add(node);
        undo.push(() => { held.delete(node); if (held.size === 0) descendants.delete(ancestor); });
        if (parent === root) break;
      }
      if (node instanceof Sprite) for (const key of ['x', 'y']) undo.push(onCellField(node.center, key, () => { mark(node); }));
      if (node instanceof BatchedMesh) undo.push(onCellMethods(node, ['setMatrixAt', 'setGeometryAt', 'setGeometryIdAt', 'addInstance', 'deleteInstance', 'addGeometry', 'deleteGeometry', 'setVisibleAt', 'optimize'], () => { mark(node); }));
      let contentUndo: (() => void)[] = [];
      const bind = (): void => {
        for (const stop of contentUndo) stop(); contentUndo = [];
        const geometry = node.geometry;
        if (isSkin(node)) skinBounds.delete(node);
        contentUndo.push(onCellField(geometry, 'attributes', () => { if (!checking) { bind(); mark(node); } }));
        for (const name of isSkin(node) ? ['position', 'skinIndex', 'skinWeight'] : ['position']) {
          let attributeStop: (() => void) | undefined;
          const attribute = (invalidate: boolean): void => {
            attributeStop?.();
            const value = geometry.hasAttribute(name) ? geometry.getAttribute(name) : undefined;
            const version = value instanceof BufferAttribute ? value : value?.data;
            attributeStop = version === undefined ? undefined : onCellField(version, 'version', () => { geometry.boundingBox = null; if (isSkin(node)) skinBounds.delete(node); mark(node); });
            if (invalidate) { geometry.boundingBox = null; if (isSkin(node)) skinBounds.delete(node); mark(node); }
          };
          contentUndo.push(onCellField(geometry.attributes, name, () => { attribute(true); }), () => { attributeStop?.(); });
          attribute(false);
        }
        if (isSkin(node)) {
          const changedMorph = (): void => { bind(); mark(node); };
          contentUndo.push(onCellField(geometry, 'morphAttributes', changedMorph));
          contentUndo.push(onCellField(geometry.morphAttributes, 'position', changedMorph));
          const targets = geometry.morphAttributes.position;
          if (targets !== undefined) for (let i = 0; i < targets.length; i++) {
            contentUndo.push(onCellField(targets, String(i), changedMorph));
            const target = targets[i], version = target instanceof BufferAttribute ? target : target?.data;
            if (version !== undefined) contentUndo.push(onCellField(version, 'version', () => { skinBounds.delete(node); mark(node); }));
          }
        }
        if (node instanceof InstancedMesh) contentUndo.push(onCellField(node.instanceMatrix, 'version', () => { mark(node); }));
        const morph = node instanceof Mesh ? node.morphTargetInfluences : undefined;
        if (morph !== undefined) for (let i = 0; i < morph.length; i++) contentUndo.push(onCellField(morph, String(i), () => { mark(node); }));
        if (Array.isArray(node.material)) for (let i = 0; i < node.material.length; i++) contentUndo.push(onCellField(node.material, String(i), () => { mark(node); }));
      };
      undo.push(() => { for (const stop of contentUndo) stop(); });
      undo.push(onCellField(node, 'geometry', () => { if (!checking) { bind(); mark(node); } }));
      undo.push(onCellField(node, 'material', () => {
        if (checking) return;
        checking = true; try { unclip(node); } finally { checking = false; }
        bind(); mark(node);
      }));
      for (const key of ['castShadow', 'count', 'instanceMatrix', 'morphTargetInfluences']) if (Object.hasOwn(node, key)) undo.push(onCellField(node, key, () => { if (!checking) { bind(); mark(node); } }));
      if (isSkin(node)) {
        let prior = new Float32Array();
        undo.push(onCellMethods(node.skeleton, ['update'], () => {
          skinVersions.set(node, node.skeleton.boneTexture?.version ?? -1);
          const current = node.skeleton.boneMatrices;
          if (current === null) throw new Error('Cell skin has no live bone matrices');
          let changed = prior.length !== current.length;
          for (let i = 0; !changed && i < current.length; i++) changed = current[i] !== prior[i];
          if (!changed) return;
          if (prior.length !== current.length) prior = new Float32Array(current.length);
          prior.set(current); pending.add(node);
        }));
        const invalidate = (): void => { skinBounds.delete(node); pending.add(node); };
        undo.push(onCellMethods(node.bindMatrix, matrixMethods, invalidate));
        for (const inverse of node.skeleton.boneInverses) undo.push(onCellMethods(inverse, matrixMethods, invalidate));
        gate(node);
      }
      if (boneOwned(node)) gate(node);
      if (isSkin(node)) for (const bone of node.skeleton.bones) {
        let parent: Object3D | null = bone;
        for (; parent !== null && parent !== root; parent = parent.parent) {
          const dependency = parent;
          let list = dependents.get(dependency); if (list === undefined) { list = new Set(); dependents.set(dependency, list); }
          const held = list; held.add(node);
          undo.push(() => { held.delete(node); if (held.size === 0) dependents.delete(dependency); });
        }
        if (parent === null) { node.visible = false; throw new Error('Cell skin borrows bones outside its cell'); }
      }
      bind();
      undo.push(onCellField(node, 'onBeforeRender', () => { mark(node); if (customDraw(node)) gate(node); }));
      if (customDraw(node)) gate(node);
      checking = true; try { check(node); } finally { checking = false; }
    }
    for (const child of node.children) watch(child);
  };
  // G598: a retiring cell's whole tree is unwatched 64 nodes a step (Driftwood's root held one 14 ms step); `dispose()` runs
  // it whole
  scope.onDisposeSteps(function* releaseClip() {
    const nodes: Object3D[] = []; root.traverse(node => { nodes.push(node); });
    for (let at = 0; at < nodes.length; at += 64) {
      checking = true;
      try { for (const node of nodes.slice(at, at + 64)) unwatchNode(node); } finally { checking = false; }
      yield;
    }
    watched.clear(); dirty.clear(); forced.clear(); samePose.clear(); descendants.clear(); dependents.clear(); gates.clear(); pending.clear();
    patched.clear(); variantScopes.clear(); users.clear(); refused.clear();
  });
  return { update: flush, changed: () => dirty.size > 0, sweep: () => { const prior = meshes; watch(root); flush(); return meshes - prior; }, state: () => ({ meshes, materials: patched.size, unclipped: 0, checked, refused: refused.size }) };
}
