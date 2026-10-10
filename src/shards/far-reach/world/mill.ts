import { Group, Mesh, MeshStandardMaterial, DoubleSide, Float32BufferAttribute, type BufferGeometry, type InstancedMesh, type Material, type Object3D, type Texture } from 'three';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { editShader } from '@wildshard/sdk/looks/shaderEdits';
import { MILL_CANVAS_EDITS, MILL_TOWER_EDITS } from '../data/millLook';
import { fit, hdMaterial, skyHd } from './meshes';
import { onPaintedDispose } from '../look/image';
import { MILL_COURSES, MILL_TOWER } from '../data/millShape';
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
function painted(t: Texture | null, apply: (t: Texture) => void): void { if (t !== null) apply(t); }

/**
 * The modelled set (E410, Sky Reach top-10 row 6; `art/far-reach/round-34-mill/`): codex references of mockup A's tower
 * mill (the whitewashed rubble tower, the ivy, the arched door, the boarded curb and the dark shingled cap with its
 * windshaft stub, no sails) and of mockup C's rock under it, BiRefNet, Hunyuan3D-2 turbo + paint, finish.sh. The tower
 * is scaled so its windshaft stub sits where the code hub was (`hub` y, so the sails sweep the same circle the mockup
 * framing was tuned on) and turned so the stub faces +z (the spawn); the code sails stay, turning on the stub. The rock
 * foot is squashed to `foot.h` and sunk `foot.sink` into the deck: up to 0.65 m of it hugs the wall inside the meadow's
 * 2.9 m hole round the mill (where the code tower's plinth stood), and from `foot.walk` m out (0.3 m on) none of it stands
 * more than `foot.lip` m proud, so the walk round the mill (the code collider's 2.3 m box) is over a stone lip, not a
 * wall. The code tower stays the fallback when a model fails to load.
 */
export const MODELLED = { hub: MILL_TOWER.height + 1.0, baseR: 2.6, foot: { span: 8.2, h: 1.7, sink: 0.45, walk: 3.0, lip: 0.3 } } as const;
/** The stone drum the tower stands on (E410, plan row 6: mockups C and proposal B stand the mill on a rock outcrop): its
 * radius and height over the deck; world/build.ts gives it a collider, so you walk round it, not through it. */
export const MILL_DRUM = { r: 3.0, h: 1.2, sides: 16 } as const;

interface Made { readonly meshes: Mesh[]; readonly hubAt: { y: number; z: number } }
/** The front stub of a fitted tower: the farthest-out vertices above 72 % of its height (the centroid of the outer 8 %). */
function stubOf(g: BufferGeometry): { a: number; r: number; y: number } {
  const p = g.getAttribute('position'); g.computeBoundingBox();
  const top = (g.boundingBox?.max.y ?? 1) * 0.72;
  let far = 0;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > top) far = Math.max(far, Math.hypot(p.getX(i), p.getZ(i)));
  let x = 0, y = 0, z = 0, n = 0;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > top && Math.hypot(p.getX(i), p.getZ(i)) > far * 0.92) { x += p.getX(i); y += p.getY(i); z += p.getZ(i); n++; }
  return { a: Math.atan2(x / Math.max(1, n), z / Math.max(1, n)), r: far, y: y / Math.max(1, n) };
}
/**
 * The painted stone's courses on the modelled wall (the model's own paint is soft at the h2 close-up's 18 m): a second UV
 * set wrapped round the axis as the code tower's (`MILL_COURSES.around` repeats, `MILL_COURSES.tile` m a course sheet), seam-free (each triangle
 * that straddles the back's wrap is unwrapped on its own), constant above the wall's top `wallTop` (the curb and cap keep
 * their paint). The stone then drives the bump and a light multiply of the paint (`towerMaterial`).
 */
function stoneCourses(src: BufferGeometry, wallTop: number): BufferGeometry {
  const g = src.index === null ? src : src.toNonIndexed(), p = g.getAttribute('position'), uv1 = new Float32Array(p.count * 2);
  for (let t = 0; t + 2 < p.count; t += 3) {
    const us = [0, 1, 2].map((v) => ((Math.atan2(p.getX(t + v), p.getZ(t + v)) / (Math.PI * 2)) + 0.5) * MILL_COURSES.around);
    const hi = Math.max(...us);
    for (let v = 0; v < 3; v++) {
      const y = p.getY(t + v), u = us[v] ?? 0;
      uv1[(t + v) * 2] = y > wallTop ? 0.5 : hi - u > MILL_COURSES.around / 2 ? u + MILL_COURSES.around : u;
      uv1[(t + v) * 2 + 1] = y > wallTop ? 0.5 : y / MILL_COURSES.tile;
    }
  }
  g.setAttribute('uv1', new Float32BufferAttribute(uv1, 2));
  if (g !== src) src.dispose();
  return g;
}
/**
 * The modelled tower's material: its paint pulled toward mockup A's pale weathered whitewash (the Hunyuan paint came out
 * cream-yellow: mock-A's wall saturation 46 %, 24 % with this pull, the code tower's was 25 %, the mockup's 17 %, under the
 * same golden light and LUT; luminance 113 against the mockup's 106), and the painted
 * stone's courses (`MILL_TEX.stone`, on the second UV set) as the bump and a light multiply.
 */
function towerMaterial(map: Texture): MeshStandardMaterial {
  const m = hdMaterial(map);
  painted(MILL_TEX.stone, (st) => { const t = st.clone(); t.channel = 1; m.bumpMap = t; m.bumpScale = 2; });
  patchShader(m, 'far.mill-tower', PATCH_ORDER.decorate, (shader) => {
    editShader(shader, MILL_TOWER_EDITS);
  }, { key: (prior) => `${prior}|far.mill-tower` });
  return m;
}
function modelledSet(): Made | null {
  const t = skyHd('mill-tower'), f = skyHd('mill-foot');
  if (t === null || f === null) return null;
  // the tower: unit height first, its stub found and turned to +z, then scaled so the stub sits at the code hub's height
  const g = fit(t.geometry, { size: 1, by: 'height', floor: 0, centre: 'base' });
  const s0 = stubOf(g); g.rotateY(-s0.a);
  const k = MODELLED.hub / s0.y; g.scale(k, k, k);
  // the footing's mean radius to the code tower's (the collider's box and the meadow's hole are sized on it)
  const p = g.getAttribute('position'); let rs = 0, n = 0;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < 0.4) { rs += Math.hypot(p.getX(i), p.getZ(i)); n++; }
  const kr = Math.min(1.2, Math.max(0.8, MODELLED.baseR / Math.max(0.1, rs / Math.max(1, n)))); g.scale(kr, 1, kr);
  const s = stubOf(g);
  // the sails' lowest sweep passes the wall's front 7.4 m under the hub: keep the hub clear of it by 0.55 m
  let wall = 0;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y > s.y - MILL_TOWER.sail - 0.2 && y < s.y - 1.5 && Math.abs(p.getX(i)) < 1.2 && p.getZ(i) > 0) wall = Math.max(wall, p.getZ(i));
  }
  g.computeBoundingBox(); g.computeBoundingSphere();
  const made = new Mesh(stoneCourses(g, s.y - 1.2), towerMaterial(t.map)); made.name = 'far.mill.tower';
  // the rock foot: fitted to its span, squashed, sunk into the deck
  const fg = fit(f.geometry, { size: MODELLED.foot.span, by: 'span', floor: 0, centre: 'box' }); fg.computeBoundingBox();
  const fh = fg.boundingBox ? fg.boundingBox.max.y : 1; fg.scale(1, MODELLED.foot.h / Math.max(1e-3, fh), 1); fg.rotateY(0.7);
  fg.translate(0, -MODELLED.foot.sink, 0);
  // past the walk ring, nothing stands more than the lip proud of the deck (a smooth fall-off, no cliff)
  const fp = fg.getAttribute('position');
  for (let i = 0; i < fp.count; i++) {
    const d = Math.hypot(fp.getX(i), fp.getZ(i)), y = fp.getY(i);
    if (d > MODELLED.foot.walk && y > MODELLED.foot.lip) {
      const w = Math.min(1, (d - MODELLED.foot.walk) / 0.3);
      fp.setY(i, y + (MODELLED.foot.lip + (y - MODELLED.foot.lip) * 0.25 - y) * w);
    }
  }
  fg.computeVertexNormals(); fg.computeBoundingBox(); fg.computeBoundingSphere();
  const foot = new Mesh(fg, hdMaterial(f.map)); foot.name = 'far.mill.foot';
  return { meshes: [made, foot], hubAt: { y: s.y, z: Math.max(s.r + 0.1, wall + 0.55) } };
}

/**
 * The mill: its baked code set (`nodes` defaults to the loaded bake; a test passes the GLB's nodes it parsed itself) in the
 * materials the painted stone, ivy and canvas land on, and the modelled tower and foot in place of the code ones where they
 * loaded. The hub (the boss, the sail frames and the canvases) turns: the plugin spins it.
 */
export function towerMill(nodes?: ReadonlyMap<string, InstancedMesh>): { group: Group; hub: Object3D; hubAt: { y: number; z: number } } {
  const made = modelledSet();
  const group = new Group(), hub = new Group(), baked = skyBakedPiece('mill', nodes);
  /** a baked kind under `parent`, drawn in `material` (the row's own material is never drawn) */
  const put = (parent: Object3D, name: string, material: Material): InstancedMesh | undefined => {
    const mesh = baked.kinds.get(name); if (mesh === undefined) return undefined;
    for (const own of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) own.dispose();
    mesh.material = material; parent.add(mesh); return mesh;
  };
  // the whitewashed stone: cream until the painted stone lands, then the stone and its own luminance as the bump
  const stone = new MeshStandardMaterial({ vertexColors: true, color: 0xe9e0cf, roughness: 0.95, metalness: 0 });
  painted(MILL_TEX.stone, (t) => { stone.map = t; stone.bumpMap = t; stone.bumpScale = 3; stone.color.set(0xffffff); stone.needsUpdate = true; });
  put(group, 'tower', stone);
  // the ivy, hidden until its sheet lands
  const ivyMat = new MeshStandardMaterial({ vertexColors: true, alphaTest: 0.4, side: DoubleSide, roughness: 0.8, metalness: 0, emissive: 0x18220c });
  const ivyMesh = put(group, 'ivy', ivyMat); if (ivyMesh !== undefined) ivyMesh.visible = false;
  painted(MILL_TEX.ivy, (t) => { ivyMat.map = t; ivyMat.emissiveMap = t; ivyMat.needsUpdate = true; if (ivyMesh !== undefined) ivyMesh.visible = true; });
  const wood = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  put(group, 'dressed', new MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 })); put(group, 'door', wood);
  put(group, 'dark', new MeshStandardMaterial({ color: 0x1e1a20, roughness: 1, metalness: 0 }));
  // the curb and the cap, a finial on top
  put(group, 'curb', wood); put(group, 'cap', new MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.05 }));
  put(group, 'finial', new MeshStandardMaterial({ color: 0x3a3430, roughness: 0.6, metalness: 0.3 }));
  // the windshaft out of the cap toward +z, and the hub on it
  const timber = new MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.9, metalness: 0 });
  const hubAt = made?.hubAt ?? { y: MILL_TOWER.height + 1.0, z: MILL_TOWER.top + 0.95 };
  const shaft = put(group, 'shaft', timber); shaft?.position.set(0, hubAt.y, hubAt.z - 0.6);
  if (made !== null) {
    // the modelled tower, cap and foot in place of the code ones (the shaft and the sails stay: they turn)
    for (const c of group.children) if (c !== shaft) c.visible = false;
    group.add(...made.meshes);
  }
  hub.position.set(0, hubAt.y, hubAt.z); group.add(hub);
  put(hub, 'boss', timber);
  // the worn canvas: the painted cloth once it lands (a coarse weave and water stains in the shader until then), frayed
  // edges and a torn-away corner on two sails cut in the shader, a faint warm glow where the low sun comes through
  const clothMat = new MeshStandardMaterial({ color: 0xece0c6, roughness: 0.95, metalness: 0, side: DoubleSide, emissive: 0x302820, alphaTest: 0.5 });
  painted(MILL_TEX.canvas, (t) => { clothMat.map = t; clothMat.emissiveMap = t; clothMat.color.set(0xffffff); clothMat.needsUpdate = true; });
  patchShader(clothMat, 'far.mill-canvas', PATCH_ORDER.decorate, (shader) => {
    editShader(shader, MILL_CANVAS_EDITS);
  }, { key: (prior) => `${prior}|far.mill-canvas` });
  // the four lattice frames (one kind, an instance per arm) and the four canvases, each turned to its arm
  put(hub, 'frame', new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }));
  for (let i = 0; i < 4; i++) put(hub, `cloth-${String(i)}`, clothMat);
  return { group, hub, hubAt };
}
