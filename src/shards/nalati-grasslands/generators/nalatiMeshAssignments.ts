/** Offline G227 assignment only: no material, geometry, renderer or live-world mutation. */
export interface NalatiAssignmentMesh {
  sourceMesh: number; name: string;
  instances: { count: number; capacity: number } | null;
  /** Common header of the full owned source and its compact hashed receipt. Older captures omit it. */
  scatter?: { version: 1; count: number } | null;
}
/** Structural input accepts both owned capture arrays and the compact clean-pin witness. */
export interface NalatiAssignmentInventory {
  roots: readonly { name: string; models: readonly string[]; meshes: readonly NalatiAssignmentMesh[] }[];
  builds: readonly { model: string; kind: 'model' | 'weld'; meshes: readonly NalatiAssignmentMesh[] }[];
}
/** A reference indexes the original owned capture; sourceMesh is capture-local, never a shipped entity id. */
export interface NalatiMeshReference { kind: 'root' | 'build'; index: number; mesh: number }
/** Static is an assignment, not admission. Older scatter captures explicitly lack original source data. */
export interface NalatiMeshAssignment {
  sourceMesh: number; name: string; owner: 'static' | 'hybrid';
  replay: 'world-mesh' | 'captured-instances' | 'scatter-source' | 'scatter-source-required' | 'runtime';
  primary: NalatiMeshReference; references: NalatiMeshReference[];
}

interface RootRule { name: string; models: readonly string[]; meshes: readonly string[]; owner: 'static' | 'hybrid'; scatter: boolean }
// Audited against the real cd1890836 capture and the defining world sources. New roots/models/mesh layouts
// require an explicit review; a static-candidate label alone never makes new geometry packable.
const roots: readonly RootRule[] = [
  {"name": "nalati-outcrops", "models": ["nalati-grasslands/granite-outcrop", "nalati-grasslands/rounded-boulder"], "meshes": ["nalati-outcrops"], "owner": "static", "scatter": false},
  {"name": "nalati-crag-rock", "models": ["nalati-grasslands/crag-rock"], "meshes": ["nalati-crag-rock-0", "nalati-crag-rock-1", "nalati-crag-rock-2", "nalati-crag-rock-3"], "owner": "static", "scatter": false},
  {"name": "nalati-camp", "models": ["nalati-grasslands/barrel", "nalati-grasslands/camp-bench", "nalati-grasslands/cart", "nalati-grasslands/chest", "nalati-grasslands/chopping-block", "nalati-grasslands/corral", "nalati-grasslands/eagle-perch", "nalati-grasslands/feed-trough", "nalati-grasslands/felt-rug", "nalati-grasslands/firewood", "nalati-grasslands/ground-saddle", "nalati-grasslands/hay-pile", "nalati-grasslands/hitching-rail", "nalati-grasslands/kazan", "nalati-grasslands/kumis-churn", "nalati-grasslands/milk-cans", "nalati-grasslands/perched-eagle", "nalati-grasslands/ribbon-pole", "nalati-grasslands/rug-line", "nalati-grasslands/rug-rack", "nalati-grasslands/saddle-rack", "nalati-grasslands/stove", "nalati-grasslands/water-trough", "nalati-grasslands/yurt"], "meshes": ["nalati-yard", "", "nalati-camp-felt", "nalati-camp-wood", "nalati-model-eagle", "nalati-model-cauldron", "nalati-model-firewood", "nalati-model-chest", "nalati-model-kumis-churn", "nalati-model-saddle"], "owner": "static", "scatter": false},
  {"name": "nalati-bridge", "models": ["nalati-grasslands/kunes-bridge"], "meshes": ["nalati-bridge"], "owner": "static", "scatter": false},
  {"name": "", "models": ["nalati-grasslands/fence", "nalati-grasslands/signpost"], "meshes": ["nalati-roads", "nalati-signs", "nalati-roads-wood"], "owner": "static", "scatter": false},
  {"name": "nalati-summer-camp", "models": ["nalati-grasslands/barrel", "nalati-grasslands/cart", "nalati-grasslands/chest", "nalati-grasslands/felt-rug", "nalati-grasslands/kazan", "nalati-grasslands/kurt-board", "nalati-grasslands/ribbon-post", "nalati-grasslands/tether-line", "nalati-grasslands/yurt"], "meshes": ["nalati-yard", "", "", "nalati-summer-wood", "nalati-model-cauldron", "nalati-model-chest"], "owner": "static", "scatter": false},
  {"name": "nalati-kurgans", "models": ["nalati-grasslands/fieldstone", "nalati-grasslands/kurgan-entrance", "nalati-grasslands/kurgan-kerb"], "meshes": ["nalati-kurgans"], "owner": "static", "scatter": false},
  {"name": "nalati-eagle-rock", "models": ["nalati-grasslands/eagle-rock"], "meshes": ["nalati-eagle-rock"], "owner": "static", "scatter": false},
  {"name": "nalati-cairn", "models": ["nalati-grasslands/wind-cairn"], "meshes": ["nalati-cairn"], "owner": "static", "scatter": false},
  {"name": "nalati-crags", "models": ["nalati-grasslands/crag-ledge", "nalati-grasslands/leopard-cave"], "meshes": ["nalati-crags"], "owner": "static", "scatter": false},
  {"name": "nalati-watchtower", "models": ["nalati-grasslands/watchtower"], "meshes": ["", "nalati-model-watchtower"], "owner": "static", "scatter": false},
  {"name": "", "models": ["nalati-grasslands/fieldstone", "nalati-grasslands/stone-step"], "meshes": [""], "owner": "static", "scatter": false},
  {"name": "", "models": ["nalati-grasslands/kokpar-goal", "nalati-grasslands/kokpar-post"], "meshes": [""], "owner": "static", "scatter": false},
  {"name": "nalati-kokpar", "models": ["nalati-grasslands/kokpar-rider", "nalati-grasslands/saddled-horse"], "meshes": ["", "nalati-model-horse-saddled", "nalati-kokpar-riders"], "owner": "hybrid", "scatter": false},
  {"name": "nalati-far-herds", "models": ["nalati-grasslands/herd-horse"], "meshes": ["nalati-far-herd", "nalati-far-herd", "nalati-far-herd", "nalati-far-herd"], "owner": "hybrid", "scatter": false},
  {"name": "nalati-snow-lotus", "models": ["nalati-grasslands/snow-lotus"], "meshes": ["nalati-model-snow-lotus"], "owner": "static", "scatter": false},
  {"name": "nalati-glacier", "models": ["nalati-grasslands/glacier-snout"], "meshes": ["nalati-glacier"], "owner": "static", "scatter": false},
  {"name": "nalati-dress-boulder", "models": ["nalati-grasslands/boulder"], "meshes": ["nalati-dress-boulder"], "owner": "static", "scatter": true},
  {"name": "nalati-dress-boulder-tall", "models": ["nalati-grasslands/boulder"], "meshes": ["nalati-dress-boulder-tall"], "owner": "static", "scatter": true},
  {"name": "nalati-dress-slab", "models": ["nalati-grasslands/slab"], "meshes": ["nalati-dress-slab"], "owner": "static", "scatter": true},
  {"name": "nalati-dress-stone", "models": ["nalati-grasslands/stone"], "meshes": ["nalati-dress-stone"], "owner": "static", "scatter": true},
  {"name": "nalati-dress-juniper", "models": ["nalati-grasslands/juniper"], "meshes": ["nalati-dress-juniper"], "owner": "static", "scatter": true},
  {"name": "nalati-dress-rose", "models": ["nalati-grasslands/wild-rose"], "meshes": ["nalati-dress-rose"], "owner": "static", "scatter": true},
  {"name": "nalati-dress-willow", "models": ["nalati-grasslands/dwarf-willow"], "meshes": ["nalati-dress-willow"], "owner": "static", "scatter": true},
  {"name": "nalati-dress-lupin", "models": ["nalati-grasslands/lupin"], "meshes": ["nalati-dress-lupin"], "owner": "static", "scatter": true},
  {"name": "nalati-dress-daisy", "models": ["nalati-grasslands/daisy"], "meshes": ["nalati-dress-daisy"], "owner": "static", "scatter": true},
  {"name": "nalati-dress-reed", "models": ["nalati-grasslands/reed"], "meshes": ["nalati-dress-reed"], "owner": "static", "scatter": true},
  {"name": "nalati-dress-statics", "models": ["nalati-grasslands/fallen-log", "nalati-grasslands/fence", "nalati-grasslands/ovoo", "nalati-grasslands/sky-gateway", "nalati-grasslands/stump", "nalati-grasslands/viewpoint-pole"], "meshes": ["nalati-dress-props-3", "nalati-dress-props-2", "nalati-dress-props-1", "nalati-dress-props-0", "nalati-dress-fences"], "owner": "static", "scatter": false},
  {"name": "nalati-dress-camp-clutter", "models": ["nalati-grasslands/camp-clutter"], "meshes": ["nalati-dress-camp-clutter"], "owner": "static", "scatter": false},
];

function sameStrings(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

function ruleFor(root: NalatiAssignmentInventory['roots'][number]): RootRule {
  const models = [...root.models].sort();
  const rule = roots.find(candidate => candidate.name === root.name && sameStrings(candidate.models, models));
  if (rule === undefined || !sameStrings(rule.meshes, root.meshes.map(mesh => mesh.name))) {
    throw new Error(`Unaudited Nalati root/model/mesh layout: ${root.name} (${models.join(', ')})`);
  }
  return rule;
}

/** Assign every captured mesh once, retaining all overlapping references and refusing unreviewed ownership.
 * World meshes are already placed: never multiply their registry poses again. Complete static instance buffers
 * carry their own poses; scatter uses DressLayer's original matrices/tints/per-copy fade data rather than its
 * empty/culled front buffer. Older scatter captures remain explicitly pending. Riders, horses and balbals stay hybrid.
 */
export function assignNalatiMeshes(inventory: NalatiAssignmentInventory): NalatiMeshAssignment[] {
  const assignments = new Map<number, NalatiMeshAssignment[]>();
  const add = (mesh: NalatiAssignmentMesh, owner: NalatiMeshAssignment['owner'], replay: NalatiMeshAssignment['replay'], reference: NalatiMeshReference): void => {
    if (!Number.isSafeInteger(mesh.sourceMesh) || mesh.sourceMesh < 0) throw new Error('Invalid Nalati source mesh identity');
    const rows = assignments.get(mesh.sourceMesh) ?? [];
    rows.push({ sourceMesh: mesh.sourceMesh, name: mesh.name, owner, replay, primary: reference, references: [reference] });
    assignments.set(mesh.sourceMesh, rows);
  };
  inventory.roots.forEach((root, index) => {
    const rule = ruleFor(root);
    root.meshes.forEach((mesh, i) => {
      const scatter = mesh.scatter;
      const hasScatter = scatter !== undefined && scatter !== null;
      if (rule.scatter && mesh.instances === null) throw new Error('Nalati scatter requires original instance source data');
      if (rule.scatter && hasScatter && scatter.count !== mesh.instances?.capacity) {
        throw new Error('Incomplete Nalati original scatter source');
      }
      if (rule.owner === 'static' && !rule.scatter && mesh.instances !== null && mesh.instances.count !== mesh.instances.capacity) {
        throw new Error('Incomplete Nalati static instance capture');
      }
      const replay = rule.owner === 'hybrid' ? 'runtime' : rule.scatter ? hasScatter ? 'scatter-source' : 'scatter-source-required' : mesh.instances === null ? 'world-mesh' : 'captured-instances';
      add(mesh, rule.owner, replay, { kind: 'root', index, mesh: i });
    });
  });
  inventory.builds.forEach((build, index) => {
    if (build.model !== 'nalati-grasslands/balbal' || build.kind !== 'model') throw new Error(`Unaudited Nalati builder: ${build.model}/${build.kind}`);
    build.meshes.forEach((mesh, i) => { add(mesh, 'hybrid', 'runtime', { kind: 'build', index, mesh: i }); });
  });
  return [...assignments.values()].map(rows => {
    const first = rows.at(0); if (first === undefined) throw new Error('Missing Nalati mesh assignment');
    if (rows.length === 1) return first;
    // Exactly two reviewed aliases: watchtower includes its registered stone steps; Kokpar's dynamic parent
    // includes the registered static posts/goals. No other static/dynamic conflict may inherit this exception.
    const refs = rows.map(row => row.primary);
    if (refs.some(ref => ref.kind !== 'root') || rows.length !== 2) throw new Error('Unreviewed Nalati mesh alias');
    const rules = refs.map(ref => { const root = inventory.roots.at(ref.index); if (root === undefined) throw new Error('Missing Nalati alias root'); return ruleFor(root); });
    const watchtower = rules.some(rule => rule.name === 'nalati-watchtower') && rules.some(rule => rule.name === '' && sameStrings(rule.models, ['nalati-grasslands/fieldstone', 'nalati-grasslands/stone-step']));
    const goals = rules.some(rule => rule.name === 'nalati-kokpar') && rules.some(rule => rule.name === '' && sameStrings(rule.models, ['nalati-grasslands/kokpar-goal', 'nalati-grasslands/kokpar-post']));
    if ((!watchtower && !goals) || rows.some(row => row.name !== first.name)) throw new Error('Unreviewed Nalati mesh alias');
    const owner = rows.find(row => row.owner === 'static');
    if (owner?.replay !== 'world-mesh') throw new Error('Nalati alias has no static world-mesh owner');
    owner.references = refs; return owner;
  }).sort((a, b) => a.sourceMesh - b.sourceMesh);
}
