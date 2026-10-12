import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { editShader } from '@wildshard/sdk/looks/shaderEdits';
import { FIR_EDITS } from '../data/paintLook';
import { onPaintedDispose } from '../look/image';
import { skyBakedGeometry } from './baked';
import { DoubleSide, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type Texture } from 'three';

/**
 * The card-branch fir (E392; the judge, four loops running: "faceted low-poly cone pines; the mockup's are layered
 * conifers"). A tapered trunk and tiers of drooping branch cards, each a painted bough from the branch sheet
 * (`public/assets/far-reach/tex/branches.webp`, codex image_gen: four boughs on a magenta key, cut to alpha by
 * `textures/pack.py`), alpha-tested, double-sided, lit like the leaves they are. One geometry for instancing; the cards
 * carry a vertex colour so the inner, lower tiers sit in shade and the tips catch the sun. Without the sheet the builder
 * is not used (world/shapes.ts keeps the code pine).
 *
 * Local frame: base at y 0, about 8 m tall before the instance's scale (the code pine's height). SF72: the geometry is
 * baked (generators/geometries.ts); the sheet and the material stay here.
 */

/** The branch sheet, set by the plugin behind the loading screen; null keeps the code pine. */
let SHEET: Texture | null = null;
export function setFirSheet(t: Texture | null): void {
  SHEET = t;
  onPaintedDispose(t, () => { if (SHEET === t) SHEET = null; });
}
export const firSheet = (): Texture | null => SHEET;

/** The firs at `at` ([x, y, z, scale]), one instanced draw. */
export function firs(at: readonly (readonly [number, number, number, number])[], sheet: Texture): InstancedMesh {
  // the trunk's uv is (-1, -1): the map's border texel is clear, so the bark is drawn from the vertex colour alone
  // a faint emissive canopy: the low sun barely lights the up-facing cards, and from above the firs read as black discs
  const material = new MeshStandardMaterial({ map: sheet, emissiveMap: sheet, emissive: 0x6a7a44, vertexColors: true, alphaTest: 0.45, side: DoubleSide, roughness: 0.9, metalness: 0 });
  patchShader(material, 'far.fir', PATCH_ORDER.decorate, (shader) => {
    editShader(shader, FIR_EDITS);
  }, { key: (prior) => `${prior}|far.fir` });
  const mesh = new InstancedMesh(skyBakedGeometry('fir'), material, at.length), m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0);
  at.forEach(([x, y, z, s], i) => { q.setFromAxisAngle(up, i * 1.7); m.compose(new Vector3(x, y, z), q, new Vector3(s, s, s)); mesh.setMatrixAt(i, m); });
  mesh.computeBoundingSphere();
  return mesh;
}
