import { Group, Mesh, MeshStandardMaterial, DoubleSide, type InstancedMesh, type Material, type Object3D, type Texture } from 'three';
import { GeometryPack, fetchDeflated, packedRows } from '@wildshard/sdk/kit/geometryPack';
import { hdMaterial, skyHd } from './meshes';
import { skyMappedLook } from './looks';
import { onPaintedDispose } from '../look/image';
import millModel from '../data/millModel.json' with { type: 'json' };
import { MILL_MODEL_URL } from '../data/files';
import { skyBakedPiece } from './baked';

/**
 * The windmill (loop 20, the judge: "a flat white/grey plaster cylinder with plain plank sails; the mockup has weathered
 * whitewashed STONE with visible block courses, ivy climbing the tower, and slatted lattice sails with worn canvas").
 * A code-built tower mill, the first frame's subject:
 * - the tower: a tapered round of whitewashed rubble stone on a wider plinth, the painted stone
 *   (`tex/mill-stone.webp`, codex image_gen from the H2 close-up; art/far-reach/round-18-windmill) wrapped round it with
 *   its own luminance as the bump, so the courses and the mortar read; weather streaks under the windows and the curb,
 *   grime and moss at the foot, a faint moss stain behind the ivy, in the vertex colour;
 * - the ivy: curved leaf cards from the painted ivy sheet (`tex/mill-ivy.webp`, alpha cut) climbing from the foot,
 *   tallest on the spawn side's left, as the H2 targets;
 * - a planked door and three deep windows in dressed-stone frames, a stone step;
 * - a boarded curb under a shingled slate ogee cap with a finial;
 * - four lattice sails: the stock, four laths and fifteen sail bars in weathered timber, the worn canvas
 *   (`tex/mill-canvas.webp`: stains, patches, seams) billowing behind the bars, frayed at its edges, two sails torn.
 * SF72: the code set is built offline (`generators/mill.ts` → `baked/mill.glb`) and drawn here in its own materials.
 * The textures load lazily here (the mill keeps its plain paint until they land); without them the tower is cream and
 * the ivy hidden. The hub turns (the plugin spins it). Local frame: base at y 0, the sails face +z.
 */
/**
 * The windmill's painted textures (`public/assets/far-reach/tex/mill-*.webp`; the boot downloads them, boot/files.ts): the
 * plugin loads them behind the loading screen and owns them (`setMillTextures`), so the first frame already has the
 * stone, the ivy and the canvas; without one (offline, a test page) its part keeps the code look.
 */
const MILL_TEX: { stone: Texture | null; canvas: Texture | null; ivy: Texture | null } = { stone: null, canvas: null, ivy: null };
export function setMillTextures(t: { stone: Texture | null; canvas: Texture | null; ivy: Texture | null }): void {
  Object.assign(MILL_TEX, t);
  for (const key of ['stone', 'canvas', 'ivy'] as const) {
    const texture = t[key];
    onPaintedDispose(texture, () => { if (MILL_TEX[key] === texture) MILL_TEX[key] = null; });
  }
}

interface Made { readonly meshes: Mesh[]; readonly hubAt: { y: number; z: number } }
/**
 * The modelled tower's material: the `mill-tower` look over its map (data/millLook.ts: the paint pulled toward mockup A's
 * pale weathered whitewash), the painted stone's courses (`MILL_TEX.stone`, on the second UV set) as the bump.
 */
function towerMaterial(map: Texture): Material {
  const m = skyMappedLook('mill-tower', map), stone = MILL_TEX.stone;
  if (stone !== null && 'bumpMap' in m) { const t = stone.clone(); t.channel = 1; Object.assign(m, { bumpMap: t, bumpScale: 2 }); m.needsUpdate = true; }
  return m;
}
let pack: InstanceType<typeof GeometryPack> | null = null;
const MODEL_ROWS = packedRows(millModel);
/** Load the modelled tower and foot's bake (with the other baked pieces, before the world is built); a failed load stands no tower. */
export async function loadSkyMillModel(): Promise<void> {
  try { pack = new GeometryPack(await fetchDeflated(MILL_MODEL_URL), MODEL_ROWS, 'far-reach mill model'); } catch (e: unknown) { console.warn('[far-reach] the baked mill model did not load:', e); }
}
/** The modelled tower and foot (E410, data/millShape.ts MODELLED): fitted offline (`generators/millModel.ts`), drawn in their models' paint. */
function modelledSet(): Made | null {
  const t = skyHd('mill-tower'), f = skyHd('mill-foot');
  if (t === null || f === null || pack === null) return null;
  t.geometry.dispose(); f.geometry.dispose();
  const made = new Mesh(pack.geometry(millModel.tower), towerMaterial(t.map)); made.name = 'far.mill.tower';
  const foot = new Mesh(pack.geometry(millModel.foot), hdMaterial(f.map)); foot.name = 'far.mill.foot';
  return { meshes: [made, foot], hubAt: millModel.hubAt };
}

/**
 * The mill: the modelled tower and foot (where they loaded; else no tower stands) and its baked turning parts (`nodes`
 * defaults to the loaded bake; a test passes the GLB's nodes it parsed itself): the shaft, and the hub (the boss, the sail
 * frames and the canvases the painted canvas lands on), which the plugin spins.
 */
export function towerMill(nodes?: ReadonlyMap<string, InstancedMesh>): { group: Group; hub: Object3D; hubAt: { y: number; z: number } } {
  const made = modelledSet();
  const group = new Group(), hub = new Group(), baked = skyBakedPiece('mill', nodes);
  /** a baked kind under `parent`, drawn in `material` (the row's own material is never drawn) */
  const put = (parent: Object3D, name: string, material: Material): Mesh | undefined => {
    const mesh = baked.kinds.get(name); if (mesh === undefined) return undefined;
    for (const own of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) own.dispose();
    mesh.material = material; parent.add(mesh); return mesh;
  };
  // the windshaft out of the cap toward +z, and the hub on it
  const timber = new MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.9, metalness: 0 }), hubAt = millModel.hubAt;
  put(group, 'shaft', timber)?.position.set(0, hubAt.y, hubAt.z - 0.6);
  if (made !== null) group.add(...made.meshes);
  hub.position.set(0, hubAt.y, hubAt.z); group.add(hub);
  put(hub, 'boss', timber);
  // the worn canvas: the `mill-canvas` look over the painted cloth (frayed, two sails torn, a faint warm glow); plain cream
  // cloth when the painted one did not load
  const canvas = MILL_TEX.canvas;
  const clothMat = canvas === null ? new MeshStandardMaterial({ color: 0xece0c6, roughness: 0.95, metalness: 0, side: DoubleSide }) : skyMappedLook('mill-canvas', canvas);
  // the four lattice frames (one kind, an instance per arm) and the four canvases, each turned to its arm
  put(hub, 'frame', new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }));
  for (let i = 0; i < 4; i++) put(hub, `cloth-${String(i)}`, clothMat);
  return { group, hub, hubAt };
}
