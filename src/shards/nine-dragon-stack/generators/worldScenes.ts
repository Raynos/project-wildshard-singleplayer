import { addWindowNodes, windowStep } from './facadeWindowRecipe';
import { NINE_CLIENT_CHANNELS } from './clientMotion';
import { SIGN_POOL_LIBRARIES, SIGN_ATLAS_BLOBS } from './signAtlasSources';
import signTextures from '../data/signTextureSources.json' with { type: 'json' };
import { CAST_LIBRARIES, CAST_WELD, castBlobs, CAST_MATERIALS } from './castSources';
import { parseWorldSceneWeld } from '@wildshard/format/worldSceneWeld';
import { LayoutRowsSchema } from './sections';
import { portalLookRows } from './portalLook';
// Nine Dragon's models on the shared world-scene host (G465): the Explorer catalogue (data/explorerModels.json) plus the
// code-built specimens the page placed itself (the brush figures, the banyan and what stands at its foot, the paper
// lantern, the movers), drawn from the whole-geometry tiles the layout bake already wrote (generators/scene.ts). Each
// model names only the tiles that hold it, so an Explorer card reads its own and the resident world reads only the boot
// and layout-set tiles. The world's banyan crown, the Well's mist, the painted sky and the scroll screen are one
// `dressing` scene step over the same tiles and two owned shapes.
import * as v from 'valibot';
import { parseWorldScene } from '@wildshard/format/clientChannels';
import { parseWorldSceneModels, type WorldSceneModels } from '@wildshard/format/worldSceneModels';
import { parseWorldScenes } from '@wildshard/format/worldScenes';
import { nameBlob, type NamedBlob } from '@wildshard/sdk/blobs';
import { staticGlb } from '@wildshard/sdk/bake/glb';
import { compressGlb } from '@wildshard/sdk/bake/glbCompression';
import { Matrix4, MeshBasicMaterial, PlaneGeometry, Quaternion, SphereGeometry, Vector3 } from 'three';
import { bakedLayoutProjection } from './layoutProjection';
import explorer from '../data/explorerModels.json' with { type: 'json' };
import worldRows from '../data/worldRows.generated.json' with { type: 'json' };
import layout from '../data/layout.generated.json' with { type: 'json' };
import profiles from '../data/specimenProfiles.json' with { type: 'json' };
import plan from '../data/layoutPlan.json' with { type: 'json' };
import { presentationData } from './presentation';
import { architectureGraphs } from './architectureGraphs';
import paint from '../data/paint.json' with { type: 'json' };
import canopy from '../data/canopy.json' with { type: 'json' };

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
// The original layout partitions are native resources; the scene owner reads each tile once.
const layoutRows = v.parse(LayoutRowsSchema, JSON.parse(JSON.stringify(layout.rows), (_key, value: unknown) =>
  value === '-0' ? -0 : value === 'Infinity' ? Infinity : value === '-Infinity' ? -Infinity : value));
const layoutIds = [...new Set([...layoutRows.kits.flatMap(row => row.geo === null ? [] : [row.geo]), ...layoutRows.alphaKits.map(row => row.geo), ...layoutRows.shell === null ? [] : [layoutRows.shell]])];
for (const id of layoutIds) alias(`layout-${id}`, `layout_${id}`);
const layoutWeld = parseWorldSceneWeld({ id: 'layout', root: 'dressing.root', nodes: [], resources: layoutIds.map(id => ({
  id: `layout.${id}`, kind: 'geometry', source: { library: libraryOf.get(`layout-${id}`), model: `layout-${id}` } })) });
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
const catalogue = parseWorldSceneModels({ product: 'nine-dragon-stack', models, projections: [
  { id: 'nds-train', key: 'monorailTrain', name: 'movers', programs: NINE_CLIENT_CHANNELS.slice(0, 1) },
  { id: 'nds-gondola', key: 'cableGondola', name: 'movers', programs: NINE_CLIENT_CHANNELS.slice(1, 2) },
  { id: 'nds-drones', key: 'drone', name: 'movers', programs: NINE_CLIENT_CHANNELS.slice(2) },
] });

// The world's banyan crown (its cards drawn twice: colour, then the depth pass) and the Well's mist.
/** a dressing draw: its node, source model, material slot, draw order, mesh name, whether it is frustum-culled and its pose */
interface Dressing { readonly id: string; readonly model: string; readonly material: string; readonly order: number; readonly name: string; readonly culled: boolean; readonly pose?: object }
const dressing: Dressing[] = [], dress = (id: string, model: string, material: string, order: number, name: string, culled = true, pose?: object): Dressing => ({ id, model, material, order, name, culled, ...(pose === undefined ? {} : { pose }) });
// the painted sky (a sphere the frame keeps on the eye, inside the far plane) and the LED scroll screen (lab P7's 千里江山图)
const windowQuad = new PlaneGeometry(1, 1); windowQuad.translate(0, 0.5, 0);
const shapeMaterial = new MeshBasicMaterial(), shapes = [['sky', new SphereGeometry(2000, 32, 16)], ['scroll', new PlaneGeometry(58, 80)], ['window-quad', windowQuad]] as const;
const SHAPE_BLOBS = shapes.map(([id, geometry]) => nameBlob(`world/geometry/${id}.glb`, 'glb', compressGlb(staticGlb([{ geometry, material: shapeMaterial, nativeAttributes: true, compactIndex: true }], id))));
// (E281) the painted sky draws after the world's opaques (the viewmodels' depth clearer sits at 999): with its depth test at
// the far plane it then shades only where the sky shows, so the skyline's layers cost nothing under the city
dressing.push(dress('sky', 'sky', 'sky', 900, 'sky', false), dress('screen', 'scroll', 'scroll', 0, 'screens', true, { position: [1, plan.Y0 + 29.85, -64], rotation: [Math.PI / 2, 0, 0] }));
if (tiles.has('canopy:core')) dressing.push(dress('crown-core', 'canopy:core', 'canopy-core', 0, 'canopy'), dress('crown-cards', 'canopy:cards', 'canopy-cards', 1, 'canopy'), dress('crown-depth', 'canopy:cards', 'canopy-depth', 2, 'canopy'));
if (tiles.has('mist:sheets')) dressing.push(dress('sheets', 'mist:sheets', 'mist-sheet', 2, 'sheets'));
dressing.push(dress('steam', 'mist:steam', 'steam', 3, 'steam', false));
for (const { model } of dressing) if (!shapes.some(([id]) => id === model)) alias(model, model);
const recipe = addWindowNodes(parseWorldScene({ imports: [], scene: { version: 1, root: 'root', textures: [],
  nodes: [{ kind: 'group', id: 'root', children: dressing.map(row => row.id) },
    ...dressing.map(row => ({ kind: 'mesh', id: row.id, geometry: row.model, material: row.material, missing: 'omit', name: row.name, renderOrder: row.order, frustumCulled: row.culled, ...row.pose }))],
  materials: [...new Set(dressing.map(row => row.material))].map(material => ({ kind: 'port', id: material, source: material })) } }), [0, 1]);

const look = (id: string, name: string) => ({ id, kind: 'look', look: name });
const library = (id: keyof typeof aliases) => ({ id, kind: 'whole', ...(id === 'native' ? {} : { load: 'explorer' }), models: [...aliases[id].values()] });
// the wet floor's reflection cards and the lanterns' halos (phone only), per deck ending: open in a grid cell, capped alone
const cards = presentationData(), empty = addWindowNodes(parseWorldScene({ imports: [], scene: { version: 1, root: 'root', textures: [], materials: [], nodes: [{ kind: 'group', id: 'root', children: [] }] } }), [2]);
// one file per distinct buffer: an ending whose cards match the other's reads the same file
const cardFiles = new Map<string, string>();
const cardFile = (caps: 'open' | 'capped', kind: 'streaks' | 'halos'): string => {
  const text = JSON.stringify(cards[caps][kind]), file = cardFiles.get(text) ?? `world/cards/${caps}-${kind}.json`;
  cardFiles.set(text, file);
  return file;
};
const cardSteps = (['open', 'capped'] as const).map(caps => {
  const step = { id: `cards-${caps}`, cube: caps === 'open' ? 'cell' : 'standalone', scene: 'world/scenes/cards.json',
    draws: [{ kind: 'buffered', file: cardFile(caps, 'streaks'), material: 'streaks', order: 4 }, { kind: 'buffered', file: cardFile(caps, 'halos'), material: 'halo', order: 5, tier: 'phone' }] };
  return Object.assign(step, windowStep([2]));
});
const CARD_BLOBS = [...cardFiles].map(([text, file]) => nameBlob(file, 'json', new TextEncoder().encode(text)));
const portalLook = portalLookRows();
export const NINE_SCENE_BLOBS: NamedBlob[] = [...SIGN_ATLAS_BLOBS, ...castBlobs(layoutWeld.resources), ...portalLook.blobs, nameBlob('models/world-scenes.json', 'json', json(catalogue)), nameBlob('world/scenes/dressing.json', 'json', json(recipe)),
  nameBlob('world/scenes/cards.json', 'json', json(empty)), ...SHAPE_BLOBS, ...CARD_BLOBS];
// the painted surfaces' texture array (data/paint.json), the canopy's leaf atlas and the scroll screen, lent to their looks
const painted = Object.entries(architectureGraphs()).flatMap(([id, graph]) => graph.params !== undefined && 'uPaint' in graph.params ? [id] : []);
const lent = [...signTextures, { kind: 'layers', looks: painted, param: 'uPaint', base: '/assets/nine-dragon/paint', label: 'Nine Dragon paint array (GPU only)', size: paint.sizes, anisotropy: 8, layers: paint.layers.map(({ name, alpha }) => ({ name, alpha })) },
  { kind: 'image', looks: ['nine-canopy-cards'], param: 'atlas', sizeParam: 'atlasSize', ...canopy.atlas },
  { kind: 'image', looks: ['nine-scroll'], param: 'scroll', url: '/assets/nine-dragon/lab/organic/scroll.webp', srgb: true, wrapT: 1001, anisotropy: 4 }];
// G4: the night market's and the square's balustrade sets as placements of their catalogue models at their baked frames
// (world/build.ts places each by id): a pavilion's copies carry their turn
const SET_MODELS: Readonly<Record<string, string>> = { booth: 'marketBooth', parasol: 'parasolTable', 'balustrade-panel': 'balustradePanel', pavilion: 'diningPavilion' };
const record = (i: number): number => { const value = worldRows.records[i]; if (typeof value !== 'number') throw new Error('Nine set frame record differs'); return value; };
// a pavilion's turn is one of its authored choices (the frame's atan2 differs in its last bit between maths libraries)
const pavilionTurns = parseWorldSceneModels(explorer.catalogue).models.find(row => row.key === 'diningPavilion')?.choices.flatMap(authored => {
  const turn = authored.params['turn']; return typeof turn === 'number' ? [turn] : []; }) ?? [];
const authoredTurn = (turn: number): number => {
  const near = pavilionTurns.find(value => Math.abs(value - turn) < 1e-9); if (near === undefined) throw new Error(`Nine pavilion turn ${turn} is no authored choice`); return near;
};
export const SET_PLACEMENTS = worldRows.rows.sets.map(({ name, frames }) => {
  const model = SET_MODELS[name]; if (model === undefined) throw new Error(`Nine set ${name} has no catalogue model`);
  return { id: `nds-set-${name}`, model, draw: 'instanced' as const, cull: { bounds: 'sphere' as const }, piece: { id: `nds-set-${name}` },
    poses: frames.map(frame => { const matrix = Array.from({ length: 16 }, (_, k) => record(frame + k));
      return { x: matrix[12] ?? 0, y: matrix[13] ?? 0, z: matrix[14] ?? 0, matrix, ...(name === 'pavilion' ? { params: { turn: authoredTurn(Math.atan2(matrix[8] ?? 0, matrix[0] ?? 1)) } } : {}) }; }) };
});
const projection = bakedLayoutProjection();
/** a layout placement's own file (world/build.ts reads the lanterns' poses from theirs) */
export const layoutPlacementFile = (id: string): string => `world/placements/${id.replaceAll('@', '.')}.json`; // a blob name has no '@'
const frame = (offset: number): number[] => Array.from({ length: 16 }, (_, k) => record(offset + k));
// plain JSON numbers: a signed zero (three's matrix maths) is written as 0
const posed = (words: readonly number[], color?: readonly number[]) => { const matrix = words.map(value => value + 0);
  return { x: matrix[12] ?? 0, y: matrix[13] ?? 0, z: matrix[14] ?? 0, matrix, ...(color === undefined ? {} : { color: [color[0] ?? 0, color[1] ?? 0, color[2] ?? 0].map(value => value + 0) }) }; };
/** the wall kit's catalogue model per piece (a copy key is `<piece>@<region>`) */
const WALL_KIT: Readonly<Record<string, string>> = { plant: 'galleryPlant' };
const catalogueName = new Map(parseWorldSceneModels(explorer.catalogue).models.map(row => [row.key, row.name]));
/** a drawn facade row's copies: 16 matrix words then 3 colour words each (world-f64 records) */
const facadePoses = (offset: number, count: number) => Array.from({ length: count }, (_, index) => {
  const at = offset + index * 19; return posed(frame(at), [record(at + 16), record(at + 17), record(at + 18)]); });
/** a paper lantern hangs its drop below its hanger, upright, at the hanger's scale (the layout's hangers, the capped decks'
 *  own when played alone, then each portal's) */
const hungLanterns = (capped: boolean) => [...projection.lanterns, ...capped ? projection.fixed.lanterns : [], ...worldRows.rows.portalLanterns.map(frame)].map(words => {
  const hanger = new Matrix4().fromArray(words), p = new Vector3(), q = new Quaternion(), s = new Vector3();
  hanger.decompose(p, q, s); const k = s.x;
  return posed(new Matrix4().makeScale(k, k, k).setPosition(p.x, p.y - projection.fixed.drop * k, p.z).elements);
});
/** the layout's air conditioners and paper lanterns (world/build.ts places them by id; lanterns per deck ending), each its own
 *  placement file (the section's plain-JSON node budget) */
export const LAYOUT_PLACEMENTS = [
  { id: 'nds-inst-ac', model: 'airConBox', draw: 'instanced' as const, cull: { bounds: 'sphere' as const }, piece: { id: 'nds-inst-ac' }, poses: projection.acs.map(words => posed(words)) },
  ...(['open', 'capped'] as const).map(ending => ({ id: `nds-lanterns-${ending}`, model: 'paperLantern', draw: 'instanced' as const, cull: { bounds: 'sphere' as const },
    piece: { id: 'nds-lanterns' }, poses: hungLanterns(ending === 'capped') })),
  // the wall kit: one instanced placement per piece and region, its copies in their own colours
  ...projection.inst.map(([key, copies]) => {
    const piece = key.slice(0, key.indexOf('@')), model = WALL_KIT[piece]; if (model === undefined) throw new Error(`Nine wall kit has no model for ${piece}`);
    return { id: `nds-inst-${key}`, model, draw: 'instanced' as const, cull: { bounds: 'sphere' as const }, piece: { id: `nds-inst-${key}` },
      poses: copies.map(copy => posed(copy.matrix, copy.color)) };
  }),
  // the facade's drawn pieces (the baked shell's are drawn into it): one instanced placement each, small ones within 85 m
  ...worldRows.rows.facade.drawn.map(row => {
    const model = `facade:${row.id}`, name = catalogueName.get(model); if (name === undefined) throw new Error(`Nine facade ${row.id} has no catalogue model`);
    return { id: `nds-facade-${row.id}`, model, draw: 'instanced' as const, cull: { bounds: 'sphere' as const, ...(row.small ? { far: 85 } : {}) },
      piece: { id: `nds-facade-${row.id}`, name }, poses: facadePoses(row.poses, row.count) };
  }),
];
export const NINE_WORLD_SCENES = parseWorldScenes({ version: 1, catalogue: 'models/world-scenes.json', lent, welds: [CAST_WELD], placements: [...SET_PLACEMENTS, ...LAYOUT_PLACEMENTS.map(row => ({ id: row.id, file: layoutPlacementFile(row.id) }))], libraries: [...SIGN_POOL_LIBRARIES, ...CAST_LIBRARIES, ...portalLook.scenes.libraries, library('native'), library('native-explorer'), { id: 'shapes', kind: 'owned', models: shapes.map(([id]) => ({ id, file: `world/geometry/${id}.glb` })) }],
  materials: [...CAST_MATERIALS, ...portalLook.scenes.materials, look('kit', 'nine-architecture'), look('facade', 'nine-facade'), look('small', 'nine-facade-small'), look('windows', 'nine-windows'), look('lantern', 'nine-lantern'),
    look('canopy-core', 'nine-canopy-inner'), look('canopy-cards', 'nine-canopy-cards'), look('canopy-depth', 'nine-canopy-depth'), look('mist-sheet', 'nine-mist-sheet'), look('steam', 'nine-steam'), look('sky', 'nine-sky'), look('scroll', 'nine-scroll'), look('streaks', 'nine-streaks'), look('halo', 'nine-halo')],
  steps: [{ id: 'dressing', scene: 'world/scenes/dressing.json', geometry: { ...Object.fromEntries(dressing.map(({ model }) => [model, { library: libraryOf.get(model) ?? 'shapes', model }])), ...windowStep([0, 1]).geometry },
    instanceAttributes: windowStep([0, 1]).instanceAttributes,
    materials: Object.fromEntries(recipe.scene.materials.map(row => [row.id, row.id])), publish: { ...windowStep([0, 1]).publish, ...Object.fromEntries(['crown-core', 'crown-cards'].filter(id => dressing.some(row => row.id === id)).map(id => [id, { kind: 'object', part: id }])) } }, ...cardSteps, ...portalLook.scenes.steps] });
/** the layout placements' files (LAYOUT_PLACEMENTS) */
export const LAYOUT_PLACEMENT_BLOBS: NamedBlob[] = LAYOUT_PLACEMENTS.map(row => nameBlob(layoutPlacementFile(row.id), 'json', new TextEncoder().encode(JSON.stringify(row))));
