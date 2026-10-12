/**
 * An entered cell's world stays in its cell (SHARD-PLATFORM G343 / G348). A level built for standalone play may lay a
 * world-sized sheet past its 500 m chunk (a sea that coarsens out to the horizon, a far terrain ring, a cloud deck): on
 * its own page nothing stands beyond the chunk, but in the grid that sheet covers the road and every neighbour, and from
 * the air the entered cell hid the whole crossroads (`art/main-menu-hero/round-4/entered-driftwood-probe.jpg`).
 *
 * So a regional world's meshes are swept as they arrive, and every one whose bounds reach past its cell into the road band
 * (`CELL_CLIP.reach` beyond the cell's edge) and that is a sheet rather than an enclosing dome (`CELL_CLIP.flat`; a
 * painted sky dome is the cell's own horizon and stays whole) gets one discard at the top of its fragment shader for the
 * fragments outside the cell square. It is the same world-position test as the horizon fade's `'outside'` patch
 * (`horizonFade.ts`): a lit built-in material reconstructs its fragment's world position from `vViewPosition`, so a
 * fragment inside the cell is drawn exactly as before (the look in the cell is pixel-identical) and a material shared
 * with the cell's own meshes never thins them. A material without a lit position is left whole and counted (`unclipped`).
 *
 * Grid only: a regional world exists only in the grid, so standalone play never reaches this. Generic game code (E405):
 * no shard is named here, and a shard declares nothing.
 */
import { Box3, Material, Mesh, MeshBasicMaterial, MeshDepthMaterial, MeshDistanceMaterial, ShaderMaterial, Vector3, Vector4, type Object3D } from 'three';
import type { Scope } from '@wildshard/engine/app/scope';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';

/**
 * `reach`: metres past the cell's edge a mesh may stand before it is clipped (the road band's half width is 27.5 m: a
 * pier or a skirt that ends on the road is left alone). `flat`: a mesh is a sheet while its height is at most this share of
 * its width (a sea, a far ground ring); a dome or a backdrop cylinder is taller and is never clipped.
 */
export const CELL_CLIP = { reach: 32, flat: 0.25 } as const;

/** The readout: how many meshes and materials were clipped, and how many world-sized meshes could not be. */
export interface CellClipState { readonly meshes: number; readonly materials: number; readonly unclipped: number }

/** A cell's clip: sweep its root for new world-sized meshes, keep the cell square on the root's current world position. */
export interface CellClip {
  /** patch every world-sized mesh not seen yet and move the square onto the root; returns how many meshes it clipped now */
  readonly sweep: () => number;
  readonly state: () => CellClipState;
}

const MAIN = /void\s+main\s*\(\s*(?:void)?\s*\)\s*\{/;
const PLACED = /varying\s+vec3\s+vViewPosition\s*;/;

/** Clip `root`'s world-sized meshes to the square of half size `half` around its origin; every patch comes off with `scope`. */
export function cellClip(root: Object3D, half: number, scope: Scope): CellClip {
  // the cell as min x, min z, max x, max z in the page's world frame
  const cell = { value: new Vector4(-half, -half, half, half) };
  const seen = new WeakSet<Mesh>(), patched = new WeakSet<Material>(), box = new Box3(), origin = new Vector3();
  let meshes = 0, materials = 0, unclipped = 0;
  const place = (): void => {
    root.updateWorldMatrix(true, false);
    origin.setFromMatrixPosition(root.matrixWorld);
    cell.value.set(origin.x - half, origin.z - half, origin.x + half, origin.z + half);
  };
  const clip = (material: Material): void => {
    if (patched.has(material)) return;
    patched.add(material); materials++;
    patchShader(material, 'g343-cell-clip', PATCH_ORDER.decorate, (shader): void => {
      if (!PLACED.test(shader.fragmentShader)) return;
      shader.uniforms['wsCellClip'] = cell;
      if (/uniform\s+vec4\s+wsCellClip\s*;/.test(shader.fragmentShader)) return; // a copied chain already carries it
      shader.fragmentShader = shader.fragmentShader.replace(MAIN, (main) => `uniform vec4 wsCellClip;\n${main}\n`
        + '  vec3 wsCellClipAt = transpose(mat3(viewMatrix)) * (-vViewPosition - viewMatrix[3].xyz);\n'
        + '  if (max(max(wsCellClip.x - wsCellClipAt.x, wsCellClipAt.x - wsCellClip.z), max(wsCellClip.y - wsCellClipAt.z, wsCellClipAt.z - wsCellClip.w)) > 0.0) discard;\n');
    }, { key: (prior) => `${prior}|g343-cell-clip`, scope });
    material.needsUpdate = true;
  };
  // the world-sized test runs in the root's own frame (the cell's centre at its origin)
  const worldSized = (mesh: Mesh): boolean => {
    const geometry = mesh.geometry;
    if (geometry.boundingBox === null) geometry.computeBoundingBox();
    if (geometry.boundingBox === null) return false;
    box.copy(geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
    const ox = origin.x, oz = origin.z; // placed by the sweep
    const reach = Math.max(ox - box.min.x, box.max.x - ox, oz - box.min.z, box.max.z - oz);
    if (!Number.isFinite(reach) || reach <= half + CELL_CLIP.reach) return false;
    const width = Math.max(box.max.x - box.min.x, box.max.z - box.min.z);
    return box.max.y - box.min.y <= CELL_CLIP.flat * width;
  };
  return {
    sweep: () => {
      place();
      let now = 0;
      root.updateMatrixWorld(true);
      root.traverse((node) => {
        if (!isMesh(node) || seen.has(node)) return;
        seen.add(node);
        if (!worldSized(node)) return;
        const material: unknown = node.material, list: readonly unknown[] = Array.isArray(material) ? material : [material];
        let lit = false;
        for (const m of list) if (isMaterial(m) && litPosition(m)) { clip(m); lit = true; }
        if (lit) { meshes++; now++; } else unclipped++;
      });
      return now;
    },
    state: () => ({ meshes, materials, unclipped }),
  };
}

function isMesh(node: Object3D): node is Mesh { return node instanceof Mesh; }
function isMaterial(value: unknown): value is Material { return value instanceof Material; }

/** A built-in lit material (three's standard, physical, lambert, phong, toon, matcap…) writes `vViewPosition`; a raw
 *  shader material does only when its own source declares it. */
function litPosition(material: Material): boolean {
  if (material instanceof ShaderMaterial) return PLACED.test(material.fragmentShader);
  return !(material instanceof MeshBasicMaterial || material instanceof MeshDepthMaterial || material instanceof MeshDistanceMaterial);
}
