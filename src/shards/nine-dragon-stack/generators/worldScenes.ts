// Nine Dragon's models on the shared world-scene host (G465): the Explorer catalogue (data/explorerModels.json) plus the
// code-built specimens the page placed itself (the brush figures, the banyan and what stands at its foot, the paper
// lantern, the movers), drawn from the whole-geometry tiles the layout bake already wrote (generators/scene.ts). Each
// model names only the tiles that hold it, so an Explorer card reads its own and the resident world reads only the boot
// and layout-set tiles. The world's banyan crown and the Well's mist are one `dressing` scene step over the same tiles.
import * as v from 'valibot';
import { parseWorldScene } from '@wildshard/format/clientChannels';
import { parseWorldSceneModels, type WorldSceneModels } from '@wildshard/format/worldSceneModels';
import { parseWorldScenes } from '@wildshard/format/worldScenes';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import explorer from '../data/explorerModels.json' with { type: 'json' };
import worldRows from '../data/worldRows.generated.json' with { type: 'json' };
import layout from '../data/layout.generated.json' with { type: 'json' };
import profiles from '../data/specimenProfiles.json' with { type: 'json' };
import plan from '../data/layoutPlan.json' with { type: 'json' };

type Model = WorldSceneModels['models'][number];
type Choice = Model['choices'][number];
type Draw = Choice['draws'][number];
const FILE = 'src/shards/nine-dragon-stack/generators/worldScenes.ts';
const json = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));

// Which tiles hold each whole partition, and whether the page loads them at boot (generators/bake-declarations.mjs).
const wholeTiles = v.parse(v.record(v.string(), v.strictObject({ files: v.array(v.string()), resident: v.boolean() })), worldRows.wholeTiles);
const tiles = new Map(Object.entries(wholeTiles).map(([id, row]) => [id, row.files])), resident = new Set(Object.entries(wholeTiles).flatMap(([id, row]) => row.resident ? [id] : []));
const sets = new Map(layout.rows.sets.map(row => [`set:${row.name}`, `layout_${row.geo}`]));
/** the layout-set tiles: the catalogue's to read, never the layout restore's (generators/layoutBlobs.ts) */
export const SET_TILES = new Set([...sets.values()].flatMap(part => tiles.get(part) ?? []));

// One alias per source: its partition, its tiles, its pose; resident or Explorer-only by where the bake put it.
const aliases = { native: new Map<string, unknown>(), 'native-explorer': new Map<string, unknown>() };
const libraryOf = new Map<string, keyof typeof aliases>();
function alias(id: string, key: string, matrix?: readonly number[]): void {
  if (libraryOf.has(id)) return;
  const part = sets.get(key) ?? key, files = tiles.get(part);
  if (files === undefined) throw new Error(`Nine world scenes: no baked tiles for ${part}`);
  const library = resident.has(part) ? 'native' : 'native-explorer';
  aliases[library].set(id, { id, part, files, ...(matrix === undefined ? {} : { matrix }) }); libraryOf.set(id, library);
}
for (const row of explorer.sources) if (!('resident' in row) || !row.resident.startsWith('lion')) alias(row.id, 'resident' in row ? row.resident : row.key, 'transform' in row ? row.transform : undefined);
const draw = (id: string, model: string, material: string, renderOrder?: number): Draw => {
  alias(model, model);
  const library = libraryOf.get(model); if (library === undefined) throw new Error(`Nine world scenes: no source ${model}`);
  return { id, library, model, material, castShadow: false, receiveShadow: false, renderOrder: renderOrder ?? 0 };
};

// The Explorer catalogue as admitted (the lion's cast stays the page's own), on its source libraries.
const colliding = new Set(explorer.colliding), yaws = new Map(Object.entries(explorer.yaw));
const relink = (row: { readonly id: string; readonly model: string; readonly material: string }): Draw => draw(row.id, row.model, row.material);
const models: unknown[] = parseWorldSceneModels(explorer.catalogue).models.filter(model => model.key !== 'guardianLion').map(model => {
  const yaw = yaws.get(model.key);
  for (const entry of model.choices) {
    entry.draws = entry.draws.map(relink); for (const level of entry.lods) level.draws = level.draws.map(relink);
    if (!colliding.has(model.key)) entry.colliders = [];
  }
  return yaw === undefined ? model : Object.assign(model, { specimenYaw: yaw });
});

// The specimens the page placed natively before, as rows.
const choice = (id: string, draws: Draw[], params: Choice['params'] = {}, colliders: unknown[] = [], lods: Choice['lods'] = []): Choice => ({ id, params, size: [1, 1, 1], draws, lods, colliders });
const one = (key: string, id: string, name: string, category: Model['category'], draws: Draw[], extra: Partial<Model> = {}, colliders: unknown[] = []): Model =>
  ({ key, id: `nine-dragon-stack/${id}`, name, category, pipeline: 'code', file: FILE, defaults: {}, variants: [], assembly: 'parts', choices: [choice('0', draws, {}, colliders)], ...extra });
const figure = profiles.FIGURE_PROFILE, poses = [...new Map([figure.defaults, ...figure.variants.map(variant => ({ ...figure.defaults, ...variant.params }))].map(pose => [JSON.stringify(pose), pose])).values()];
const octagon = Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2, r = plan.BANYAN.r + 0.3; return [Math.cos(a) * r, 0, Math.sin(a) * r, Math.cos(a) * r, 1, Math.sin(a) * r]; }).flat();
models.push(
  { key: 'inkFigure', id: 'nine-dragon-stack/ink-figure', name: 'Brush-drawn figure (procedural)', category: 'people', pipeline: 'code', file: FILE, defaults: figure.defaults, variants: figure.variants, assembly: 'parts',
    choices: poses.map((params, i) => choice(String(i), [draw('main', `inkit:figure:${params.pose}:${String(params.umbrella)}`, 'kit')], params)) },
  one('banyan', 'banyan', 'Banyan (strangler fig, carved planter)', 'nature', [draw('tree', 'banyan:tree', 'kit'), draw('core', 'banyan:crown:core', 'canopy-core'),
    draw('cards', 'banyan:crown:cards', 'canopy-cards', 1), draw('depth', 'banyan:crown:cards', 'canopy-depth', 2)], {}, [{ kind: 'hull', x: 0, y: 0, z: 0, points: octagon, surface: 'stone' }]),
  one('earthGodShrine', 'earth-god-shrine', 'Earth-god shrine (土地公)', 'props', [draw('main', 'banyan:shrine', 'kit')], { specimenYaw: Math.PI },
    [{ kind: 'box', x: 0, y: 0.9, z: 0.05, hx: 1.0, hy: 0.9, hz: 0.65, surface: 'stone' }]),
  one('kowloonStele', 'kowloon-stele', '九龍城 stele', 'props', [draw('main', 'banyan:stele', 'kit')], { specimenYaw: Math.PI },
    [{ kind: 'box', x: 0, y: 1.1, z: 0, hx: 0.6, hy: 1.1, hz: 0.5, surface: 'stone' }]),
  { ...one('paperLantern', 'paper-lantern', 'Red paper lantern', 'props', [draw('main', 'lantern:near', 'lantern')]),
    choices: [choice('0', [draw('main', 'lantern:near', 'lantern')], {}, [], [{ from: 35, draws: [draw('main', 'lantern:far', 'lantern')] }, { from: 80, draws: [draw('main', 'lantern:dot', 'lantern')] }])] },
  one('monorailTrain', 'monorail-train', 'Monorail train (four cars)', 'props', [draw('main', 'mover:train', 'kit')]),
  one('cableGondola', 'cable-gondola', 'Cable gondola', 'props', [draw('main', 'mover:gondola', 'kit')]),
  one('drone', 'drone', 'Surveillance drone', 'props', [draw('main', 'mover:drone', 'kit')]),
);
const catalogue = parseWorldSceneModels({ product: 'nine-dragon-stack', models });

// The world's banyan crown (its cards drawn twice: colour, then the depth pass) and the Well's mist.
/** a dressing draw: its node, source model, material slot, draw order, mesh name and whether it is frustum-culled */
interface Dressing { readonly id: string; readonly model: string; readonly material: string; readonly order: number; readonly name: string; readonly culled: boolean }
const dressing: Dressing[] = [], dress = (id: string, model: string, material: string, order: number, name: string, culled = true): Dressing => ({ id, model, material, order, name, culled });
if (tiles.has('canopy:core')) dressing.push(dress('crown-core', 'canopy:core', 'canopy-core', 0, 'canopy'), dress('crown-cards', 'canopy:cards', 'canopy-cards', 1, 'canopy'), dress('crown-depth', 'canopy:cards', 'canopy-depth', 2, 'canopy'));
if (tiles.has('mist:sheets')) dressing.push(dress('sheets', 'mist:sheets', 'mist-sheet', 2, 'sheets'));
dressing.push(dress('steam', 'mist:steam', 'steam', 3, 'steam', false));
for (const { model } of dressing) alias(model, model);
const recipe = parseWorldScene({ imports: [], scene: { version: 1, root: 'root', textures: [],
  nodes: [{ kind: 'group', id: 'root', children: dressing.map(row => row.id) },
    ...dressing.map(row => ({ kind: 'mesh', id: row.id, geometry: row.model, material: row.material, missing: 'omit', name: row.name, renderOrder: row.order, frustumCulled: row.culled }))],
  materials: [...new Set(dressing.map(row => row.material))].map(material => ({ kind: 'port', id: material, source: material })) } });

const look = (id: string, name: string) => ({ id, kind: 'look', look: name });
const library = (id: keyof typeof aliases) => ({ id, kind: 'whole', ...(id === 'native' ? {} : { load: 'explorer' }), models: [...aliases[id].values()] });
export const NINE_SCENE_BLOBS: NamedBlob[] = [nameBlob('models/world-scenes.json', 'json', json(catalogue)), nameBlob('world/scenes/dressing.json', 'json', json(recipe))];
export const NINE_WORLD_SCENES = parseWorldScenes({ version: 1, catalogue: 'models/world-scenes.json', libraries: [library('native'), library('native-explorer')],
  materials: [look('kit', 'nine-architecture'), look('facade', 'nine-facade'), look('small', 'nine-facade-small'), look('lantern', 'nine-lantern'),
    look('canopy-core', 'nine-canopy-inner'), look('canopy-cards', 'nine-canopy-cards'), look('canopy-depth', 'nine-canopy-depth'), look('mist-sheet', 'nine-mist-sheet'), look('steam', 'nine-steam')],
  steps: [{ id: 'dressing', scene: 'world/scenes/dressing.json', geometry: Object.fromEntries(dressing.map(({ model }) => [model, { library: libraryOf.get(model), model }])),
    materials: Object.fromEntries(recipe.scene.materials.map(row => [row.id, row.id])), publish: Object.fromEntries(dressing.map(({ id }) => [id, { kind: 'object', part: id }])) }] });
