import { Mesh, type Group, type InstancedMesh, type Object3D } from 'three';
import { hdMaterial, skyHd, SKY_LIBRARY } from './meshes';
import { skyLook, skyMappedLook } from './looks';
import millModel from '../data/millModel.json' with { type: 'json' };
import { WORLD } from './baked';
import { bindWorldSceneParts, createWorldScene } from '@wildshard/game/plugin/ui';
import { MILL_SCENE } from '../data/millScene.generated';

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
 * SF72: the code set is built offline (`generators/mill.ts` → `baked/mill.glb`) and drawn here in its bake rows' own
 * materials (data/mill.json: the timber shaft and boss, the vertex-coloured frames), the canvas in its look.
 * The hub turns (the plugin spins it). Local frame: base at y 0, the sails face +z.
 */
interface Made { readonly meshes: Mesh[]; readonly hubAt: { y: number; z: number } }
/**
 * The modelled tower and foot (E410, data/millShape.ts MODELLED): fitted offline (`generators/millModel.ts`), drawn in their
 * models' paint, the tower in the `mill-tower` look over its map (data/millLook.ts: the paint pulled toward mockup A's pale
 * weathered whitewash), which carries the painted stone (`tex/mill-stone.webp`, loaded behind the loading screen) as its
 * bump on the second UV set (data/worldTextures.ts `bumps`; offline or on a test page the tower keeps its paint unbumped).
 */
function modelledSet(): Made | null {
  const t = skyHd('mill-tower'), f = skyHd('mill-foot');
  const towerGeometry = SKY_LIBRARY.geometry('mill-tower'), footGeometry = SKY_LIBRARY.geometry('mill-foot');
  if (t === null || f === null || towerGeometry === null || footGeometry === null) return null;
  t.geometry.dispose(); f.geometry.dispose();
  const made = new Mesh(towerGeometry, skyMappedLook('mill-tower', t.map)); made.name = 'far.mill.tower';
  const foot = new Mesh(footGeometry, hdMaterial(f.map)); foot.name = 'far.mill.foot';
  return { meshes: [made, foot], hubAt: millModel.hubAt };
}

/**
 * The mill: the modelled tower and foot (where they loaded; else no tower stands) and its baked turning parts (`nodes`
 * defaults to the loaded bake; a test passes the GLB's nodes it parsed itself): the shaft, and the hub (the boss, the sail
 * frames and the canvases the painted canvas lands on), which the plugin spins.
 */
export function towerMill(nodes?: ReadonlyMap<string, InstancedMesh>): { group: Group; hub: Object3D; hubAt: { y: number; z: number } } {
  const models = modelledSet(), baked = WORLD.piece('mill', { nodes }), cloth = skyLook('mill-canvas');
  for (const name of MILL_SCENE.cloth) {
    const mesh = baked.kinds.get(name); if (mesh === undefined || cloth === undefined) continue;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
    mesh.material = cloth;
  }
  const objects = new Map<string, Object3D | null>(MILL_SCENE.parts.map(name => [name, baked.kinds.get(name) ?? null]));
  objects.set('model.tower', models?.meshes[0] ?? null); objects.set('model.foot', models?.meshes[1] ?? null);
  const scene = createWorldScene(MILL_SCENE.recipe, { objects, geometry: SKY_LIBRARY.geometry, model: SKY_LIBRARY.model, baked: WORLD.object });
  return { group: scene.root, ...bindWorldSceneParts(scene, { hub: 'group', hubAt: 'vector' }, MILL_SCENE.bindings) };
}
