import { addWindowNodes, windowStep } from './facadeWindowRecipe';
import { NINE_CLIENT_CHANNELS } from './clientMotion';
import { SIGN_POOL_LIBRARIES, SIGN_ATLAS_BLOBS } from './signAtlasSources';
import signTextures from '../data/signTextureSources.json' with { type: 'json' };
import signRows from '../data/signView.json' with { type: 'json' };
import { CAST_LIBRARIES, CAST_WELD, castBlobs, CAST_MATERIALS, castLibrary } from './castSources';
import crowdRows from '../data/crowdModels.json' with { type: 'json' };
import lodRows from '../data/lod.json' with { type: 'json' };
import hookRows from '../data/hookSpecimen.json' with { type: 'json' };
import hookBounds from '../data/hookBounds.json' with { type: 'json' };
import { parseWorldSceneWeld } from '@wildshard/format/worldSceneWeld';
import { LayoutRowsSchema, SignAtlasSchema } from './sections';
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
import { lightVolumeRows } from './lightVolumes';
import paint from '../data/paint.json' with { type: 'json' };
import canopy from '../data/canopy.json' with { type: 'json' };

type Model = WorldSceneModels['models'][number];
type Choice = Model['choices'][number];
type Draw = Choice['draws'][number];
const FILE = 'src/shards/nine-dragon-stack/generators/worldScenes.ts';
const json = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));

// The sign atlas (generators/signAtlasOutput.ts): its parts' pool libraries, its prepared sign keys and its copies (one
// atlas per tier; both tiers hang the same signs and name the same parts)
const signAtlas = v.parse(SignAtlasSchema, JSON.parse(new TextDecoder().decode(SIGN_ATLAS_BLOBS.find(row => row.file.name === 'signs/atlas-phone.json')?.bytes),
  (_key, value: unknown) => value === '-0' ? -0 : value));
const signLibrary = new Map(SIGN_POOL_LIBRARIES.flatMap(row => (row.files[0]?.parts ?? []).map(part => [part, row.id] as const)));
/** a draw of one sign-atlas part on a lent neon look */
function signDraw(id: string, part: string, material: string, renderOrder = 0) {
  const library = signLibrary.get(part); if (library === undefined) throw new Error(`Nine sign atlas has no part ${part}`);
  return { id, library, model: part, material, castShadow: false, receiveShadow: false, renderOrder };
}
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
  // a drone carries its navigation lights (red, white, cyan): neon quads in the sign atlas
  one('drone', 'drone', 'Surveillance drone', 'props', [draw('main', 'mover:drone', 'kit'), signDraw('lights', 'drone', 'neon')]),
);
// the guardian lion and the TRELLIS crowd from their casts (castSources.ts): each middle level a simplified index over the
// full cast's attributes, the crowd's clustered far copy its own, and nothing past the crowd's far cutoff
const cast = (name: string) => ({ id: 'main', library: castLibrary(name), model: name, material: 'kit', castShadow: false, receiveShadow: false, renderOrder: 0 });
const sharing = (name: string, full: string) => ({ ...cast(name), attributes: { library: castLibrary(full), model: full } });
models.push({ ...one('guardianLion', 'guardian-lion', 'Guardian lion', 'props', [cast('lion')]), pipeline: 'trellis',
  choices: [choice('0', [cast('lion')], {}, [], [10, 30].map(from => ({ from, draws: [sharing(`lion-mid${String(from)}`, 'lion')] })))] });
// the Fei Zhua dragon hook (E306 / E315 M4): the lab's cast-brass TRELLIS.2 sculpt (~18 k triangles) in its own space with its
// source's bounds, meshoptimizer copies from 15 m and 40 m over its attributes; its back is the flat wall plate, so the
// Model Explorer turns it round to face the first view (E289)
const hook = hookRows, [hookX = 0, hookY = 0, hookZ = 0, hookR = 0] = hookBounds.sphere, hookDraw = { id: 'main', library: 'cast-hook', model: 'dragon-hook', material: 'casts.hook-brass', castShadow: false, receiveShadow: false, renderOrder: 0 };
models.push({ key: 'feiZhuaHook', id: hook.model.id, name: hook.model.name, category: 'props', pipeline: 'trellis', file: FILE, defaults: {}, variants: [], assembly: 'parts', specimenYaw: hook.specimenYaw,
  choices: [choice('0', [{ ...hookDraw, sphere: [hookX, hookY, hookZ, hookR] as [number, number, number, number] }], {}, [], hook.lods.map(from => {
    const level = `dragon-hook-mid${String(from)}`; return { from, draws: [{ ...hookDraw, library: castLibrary(level), model: level, attributes: { library: 'cast-hook', model: 'dragon-hook' } }] }; }))] });
for (const [key, row] of Object.entries(crowdRows)) {
  const name = key === 'walker' ? 'umbrellaWalker' : 'mahjongSitter';
  models.push({ key: name, id: row.id, name: row.name, category: 'people', pipeline: 'trellis', file: FILE, defaults: row.defaults, variants: row.variants, assembly: 'parts',
    choices: row.variants.map(variant => { const full = `${key}-${variant.id}`;
      return choice(variant.id, [cast(full)], variant.params, [], [...lodRows.MID_FROM.map(from => ({ from, draws: [sharing(`${full}-mid${String(from)}`, full)] })),
        { from: lodRows.LOD_NEAR, draws: [cast(`${full}-far`)] }, { from: lodRows.LOD_FAR, draws: [] }]); }) });
}
// the sign (E306 / E315): every shop sign, plaque, paper strip and banner the fragment hangs, one model, its variants the
// styles; a variant draws its prepared atlas cells (hand-bent neon calligraphy: a dark plank board under its tubes; a
// lightbox, plaque, strip or banner: one quad on the 'nine-neon' look). Hung copies are drawn into the world's sign and
// neon-board meshes (SIGN_PLACEMENTS) and register on their style's variant.
const signParams = (variant: (typeof signRows.variants)[number]) => ({ ...signRows.defaults, ...variant.params });
models.push({ key: 'sign', id: 'nine-dragon-stack/sign', name: 'Sign (neon, lightbox, plaque, paper strip, banner)', category: 'props', pipeline: 'code', file: FILE,
  defaults: signRows.defaults, variants: signRows.variants, assembly: 'parts', specimenYaw: Math.PI, choices: signRows.variants.map(variant => {
    const p = signParams(variant), ink = 'ink' in p && typeof p.ink === 'string' ? p.ink : '';
    const name = signAtlas.keys[`${signRows.model.key}:${p.style}:${p.text}:${p.color}:${ink}:${String(p.vertical)}:${p.size}:${String(p.blade)}`];
    if (name === undefined) throw new Error(`Nine sign variant ${variant.id} has no prepared atlas cell`);
    return choice(variant.id, signRows.model.calligraphyStyles.some(style => style === p.style)
      ? [signDraw('boards', `${name}-boards`, 'neon-board'), signDraw('tubes', `${name}-tubes`, 'neon-tube', 5)] : [signDraw('main', name, 'neon')], p);
  }) });
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
// the hung signs: the sign atlas's lightboxes, lights and beacons on the 'nine-neon' look and the neon calligraphy's boards
// and tubes (their copies are drawn into these, SIGN_PLACEMENTS)
dressing.push(dress('signs', 'world', 'neon', 0, 'signs'), dress('neon-boards', 'neon-world-boards', 'neon-board', 0, 'neon'), dress('neon-tubes', 'neon-world-tubes', 'neon-tube', 5, 'neon'));
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
export const NINE_SCENE_BLOBS: NamedBlob[] = [...SIGN_ATLAS_BLOBS, ...castBlobs(), ...portalLook.blobs, nameBlob('models/world-scenes.json', 'json', json(catalogue)), nameBlob('world/scenes/dressing.json', 'json', json(recipe)),
  nameBlob('world/scenes/cards.json', 'json', json(empty)), ...SHAPE_BLOBS, ...CARD_BLOBS];
// the painted surfaces' texture array (data/paint.json), the canopy's leaf atlas and the scroll screen, lent to their looks
const painted = Object.entries(architectureGraphs()).flatMap(([id, graph]) => graph.params !== undefined && 'uPaint' in graph.params ? [id] : []);
// the light pools' two baked volumes (generators/lightVolumes.ts) per tier and deck ending, lent to every look that reads them
const lit = Object.entries(architectureGraphs()).flatMap(([id, graph]) => graph.params !== undefined && 'uLpVolA' in graph.params ? [id] : []);
const volumeOf = (caps: 'capped' | 'open', tier: 'phone' | 'desktop', index: number) => {
  const row = lightVolumeRows()[`${tier}-${caps}-${index}`]; if (row === undefined) throw new Error(`Nine has no light volume ${tier}-${caps}-${index}`);
  return { file: row.file, size: [...row.size], min: [...row.min], inv: [...row.inv], maximum: row.maximum };
};
const VOLUMES = (['A', 'B'] as const).map((suffix, index) => ({ kind: 'volume', looks: lit, label: 'Nine Dragon light volumes (GPU only)', publish: `light.${suffix}`,
  params: { texture: `uLpVol${suffix}`, min: `uLpMin${suffix}`, inv: `uLpInv${suffix}`, maximum: 'uLpMax' },
  files: { standalone: { phone: volumeOf('capped', 'phone', index), desktop: volumeOf('capped', 'desktop', index) }, cell: { phone: volumeOf('open', 'phone', index), desktop: volumeOf('open', 'desktop', index) } } }));
const lent = [...signTextures, ...VOLUMES, { kind: 'layers', looks: painted, param: 'uPaint', base: '/assets/nine-dragon/paint', label: 'Nine Dragon paint array (GPU only)', size: paint.sizes, anisotropy: 8, layers: paint.layers.map(({ name, alpha }) => ({ name, alpha })) },
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
  return { id: `nds-set-${name}`, model, name: `set:${name}`, draw: 'instanced' as const, cull: { bounds: 'sphere' as const }, piece: { id: `nds-set-${name}` },
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
/** the three Well hook mounts nearest the square, each carrying the cast at its ring */
function hungHooks() {
  const square = new Vector3(-16, plan.Y0 - 2, -24), mounts = projection.hookMounts.map(row => ({ ring: new Vector3(...row.ring), out: new Vector3(...row.out) }))
    .filter(mount => mount.ring.y > plan.Y0 - 23 && mount.ring.y < plan.Y0 + 14)
    .sort((a, b) => a.ring.distanceToSquared(square) - b.ring.distanceToSquared(square)).slice(0, 3);
  return mounts.map(({ ring, out }) => posed(new Matrix4().makeTranslation(ring.x, ring.y, ring.z)
    .multiply(new Matrix4().makeRotationY(Math.atan2(out.x, out.z)))
    .multiply(new Matrix4().makeScale(hook.scale, hook.scale, hook.scale))
    .multiply(new Matrix4().makeTranslation(-hook.ring.x, -hook.ring.y, -hook.ring.z)).elements));
}
/** the guardian lions at their frames, one placement per named place that keeps them (Lantern Square's, the stair-street's,
 *  the Well rim's Set, FABRIC); every lion stands in exactly one */
const LION_SHARES: readonly (readonly [string, readonly number[]])[] = [['plaza', worldRows.rows.shares.plaza], ['street', worldRows.rows.shares.street], ['rim', worldRows.rows.shares.rim]];
if (worldRows.rows.lions.some((_at, index) => LION_SHARES.filter(([, share]) => share.includes(index)).length !== 1)) throw new Error('Nine lions differ from their places');
export const LION_PLACEMENTS = LION_SHARES.flatMap(([place, share]) => share.length === 0 ? [] : [{ id: `nds-lions-${place}`, model: 'guardianLion', name: 'glb:lion',
  draw: 'instanced' as const, cull: { bounds: 'sphere' as const }, piece: { id: `nds-lions-${place}` }, poses: share.map(index => posed(frame(worldRows.rows.lions[index] ?? Number.NaN))) }]);
// the models drawn into the kits (E306 / E315 M4: the brass dragon hooks, stools, scooters, mahjong tables and brush-drawn
// figures; the paifang, the banyan …; E346: the Well's balustrade, the crossings' lotus and lamp posts): per model and kit
// one placement drawn into that kit's mesh (FABRIC), models in the order the layout first draws each and kits in the order
// the model first meets them. A copy registers on its authored card; one drawn with free params (a laundry line's span
// and rise) on the model's default one.
const canonical = (params: object): string => JSON.stringify(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)));
const drawnModels = new Map<string, Map<string, typeof projection.inKit>>();
for (const copy of projection.inKit) {
  const kits = drawnModels.get(copy.model) ?? new Map<string, typeof projection.inKit>(); drawnModels.set(copy.model, kits);
  kits.set(copy.kit, [...kits.get(copy.kit) ?? [], copy]);
}
const DRAWN_PLACEMENTS = [...drawnModels].flatMap(([id, kits]) => {
  const model = catalogue.models.find(row => row.id === id); if (model === undefined) throw new Error(`Nine drawn-in model ${id} is no catalogue row`);
  const authored = new Set(model.choices.map(entry => canonical(entry.params)));
  return [...kits].map(([kit, copies]) => ({ id: `nds-${id.slice(id.indexOf('/') + 1)}@${kit}`, kit, model: model.key, draw: 'merged' as const,
    drawnInto: { part: `fabric.kit.${kit}`, boxes: copies.flatMap(copy => copy.box) }, piece: { id: `nds-${id.slice(id.indexOf('/') + 1)}@${kit}` },
    poses: copies.map(({ at: { x, y, z, yaw, variant, params } }) => ({ x, y, z, yxz: { yaw: yaw ?? 0, scale: 1 }, ...(variant === undefined ? {} : { variant }),
      ...(params === undefined || !authored.has(canonical({ ...model.defaults, ...params })) ? {} : { params }) })) }));
});
/** the layout's air conditioners and paper lanterns (world/build.ts places them by id; lanterns per deck ending), each its own
 *  placement file (the section's plain-JSON node budget) */
/** every sign hung, a copy of the sign model drawn into the sign or neon-board mesh, registered on its style's variant */
const SIGN_PLACEMENTS = signAtlas.copies.map(({ neon, boxes, poses: hung }) => ({ id: neon ? signRows.model.pieces.neon : signRows.model.pieces.atlas, model: 'sign', draw: 'merged' as const,
  drawnInto: { part: neon ? 'dressing.neon-boards' : 'dressing.signs', boxes }, piece: { id: neon ? signRows.model.pieces.neon : signRows.model.pieces.atlas },
  poses: hung.map(({ x, y, z, yaw, variant }) => { const row = signRows.variants.find(entry => entry.id === variant); if (row === undefined) throw new Error(`Nine sign variant ${variant} differs`);
    return { x, y, z, yxz: { yaw, scale: 1 }, variant, params: signParams(row) }; }) }));
export const LAYOUT_PLACEMENTS = [
  ...SIGN_PLACEMENTS,
  { id: 'nds-inst-ac', model: 'airConBox', name: 'inst:ac', draw: 'instanced' as const, cull: { bounds: 'sphere' as const }, piece: { id: 'nds-inst-ac' }, poses: projection.acs.map(words => posed(words)) },
  ...(['open', 'capped'] as const).map(ending => ({ id: `nds-lanterns-${ending}`, model: 'paperLantern', draw: 'instanced' as const, cull: { bounds: 'sphere' as const },
    piece: { id: 'nds-lanterns' }, poses: hungLanterns(ending === 'capped') })),
  // the wall kit: one instanced placement per piece and region, its copies in their own colours
  ...projection.inst.map(([key, copies]) => {
    const piece = key.slice(0, key.indexOf('@')), model = WALL_KIT[piece]; if (model === undefined) throw new Error(`Nine wall kit has no model for ${piece}`);
    return { id: `nds-inst-${key}`, model, name: `inst:${key}`, draw: 'instanced' as const, cull: { bounds: 'sphere' as const }, piece: { id: `nds-inst-${key}` },
      poses: copies.map(copy => posed(copy.matrix, copy.color)) };
  }),
  // the guardian lions at their frames, and the crowd: walkers and mahjong sitters in their colourways, culled from the
  // origin by the far cutoff
  ...LION_PLACEMENTS,
  // the hook hung on the three Well hooks nearest the square: its ring on the mount's ring, turned out from the wall (the
  // brackets and collision-free ring anchors stay the world's; the grapple aims at the ring)
  { id: 'nds-fei-zhua-hooks', model: 'feiZhuaHook', name: 'glb:dragon-hook', draw: 'instanced' as const, cull: { bounds: 'sphere' as const }, piece: { id: 'nds-fei-zhua-hooks' }, poses: hungHooks() },
  ...([['walkers', 'umbrellaWalker'], ['sitters', 'mahjongSitter']] as const).map(([group, model]) => ({ id: `nds-crowd-${group}`, model, draw: 'instanced' as const,
    cull: { bounds: 'sphere' as const, from: 'origin' as const, far: lodRows.LOD_FAR }, piece: { id: `nds-crowd-${group}` },
    poses: worldRows.rows.crowd[group].map(row => ({ ...posed(frame(row.matrix)), variant: row.variant })) })),
  ...DRAWN_PLACEMENTS.map(({ kit: _kit, ...row }) => row),
  // the facade's baked pieces, drawn into its merged shell (FABRIC): one placement each
  ...worldRows.rows.facade.baked.map(row => {
    const model = `facade:${row.id}`, name = catalogueName.get(model); if (name === undefined) throw new Error(`Nine facade ${row.id} has no catalogue model`);
    return { id: `nds-facade-${row.id}`, model, draw: 'merged' as const, drawnInto: { part: 'fabric.shell', boxes: Array.from({ length: row.count * 6 }, (_, k) => record(row.boxes + k)) },
      piece: { id: `nds-facade-${row.id}`, name }, poses: facadePoses(row.poses, row.count) };
  }),
  // the facade's drawn pieces (the baked shell's are drawn into it): one instanced placement each, small ones within 85 m
  ...worldRows.rows.facade.drawn.map(row => {
    const model = `facade:${row.id}`, name = catalogueName.get(model); if (name === undefined) throw new Error(`Nine facade ${row.id} has no catalogue model`);
    return { id: `nds-facade-${row.id}`, model, name: `facade-${row.id}`, draw: 'instanced' as const, cull: { bounds: 'sphere' as const, ...(row.small ? { far: 85 } : {}) },
      piece: { id: `nds-facade-${row.id}`, name }, poses: facadePoses(row.poses, row.count) };
  }),
];
// ── the fabric (C1, G601): the layout's merged kits (opaque then alpha-cut) and the facade's shell as frozen-scene meshes on
// their looks over the layout's tiles (their neon spill baked in, their bounds the layout bake's: assigned, never scanned),
// the two kits with a draw distance culled from their box's centre, the catalogue models drawn into them, and the named
// places' Sets. world/build.ts assembles it where the kits stood; each deck ending's entry decks and the facade's sign
// boards are the FIXED_STEPS (casts that differ by ending).
const kitBounds = new Map(projection.geometries.map(row => {
  const b = row.s.slice(0, 6).map(Math.fround), [x0 = 0, y0 = 0, z0 = 0, x1 = 0, y1 = 0, z1 = 0] = b;
  return [row.id, { sphere: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, row.s[6]], box: row.box ? b : undefined, reach: Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2 }] as const;
}));
const farOf = new Map(projection.farOf), farKits: { id: string; at: number[] }[] = [];
const kitNode = (id: string, parent: string, name: string, geo: number, material: string, far?: number) => {
  const b = kitBounds.get(geo); if (b === undefined) throw new Error(`Nine layout geometry ${geo} has no baked bounds`);
  const tiled = libraryOf.get(`layout-${geo}`); if (tiled === undefined) throw new Error(`Nine layout geometry ${geo} has no tiles`);
  if (far !== undefined) farKits.push({ id, at: b.sphere.slice(0, 3) });
  return { id, parent, name, kind: 'mesh', geometry: { library: tiled, model: `layout-${geo}` }, material, sphere: b.sphere, ...(b.box === undefined ? {} : { box: b.box }),
    ...(far === undefined ? {} : { until: far + b.reach }) };
};
const shell = projection.shell;
const fabricPlacements = [...LION_PLACEMENTS, ...SET_PLACEMENTS, ...DRAWN_PLACEMENTS, ...LAYOUT_PLACEMENTS.filter(row => row.id.startsWith('nds-inst-') && row.id.endsWith('@well')),
  ...LAYOUT_PLACEMENTS.filter(row => 'drawnInto' in row && row.drawnInto.part === 'fabric.shell')].map(row => row.id);
const extras: Readonly<Record<string, readonly string[]>> = { square: [...LION_PLACEMENTS.filter(row => row.id === 'nds-lions-plaza').map(row => row.id), 'nds-set-balustrade-panel'],
  stair: LION_PLACEMENTS.filter(row => row.id === 'nds-lions-street').map(row => row.id), rim: LION_PLACEMENTS.filter(row => row.id === 'nds-lions-rim').map(row => row.id),
  well: LAYOUT_PLACEMENTS.filter(row => row.id.startsWith('nds-inst-') && row.id.endsWith('@well')).map(row => row.id) };
const market = SET_PLACEMENTS.filter(row => row.id !== 'nds-set-balustrade-panel').map(row => row.id);
const FABRIC = parseWorldSceneWeld({ id: 'fabric', root: 'dressing.root', resources: [], placements: fabricPlacements, nodes: [
  { id: 'fabric.root', parent: 'dressing.root', name: 'fabric', kind: 'group' },
  ...projection.kits.flatMap(([name, geo]) => geo === null ? [] : [kitNode(`fabric.kit.${name}`, 'fabric.root', `kit:${name}`, geo, 'kit', farOf.get(name))]),
  ...projection.alphaKits.map(([name, geo]) => kitNode(`fabric.kit.${name}`, 'fabric.root', `kit:${name}`, geo, 'kit-cut', farOf.get(name))),
  ...shell === null ? [] : [{ id: 'fabric.facade', parent: 'fabric.root', name: 'facade', kind: 'group' }, kitNode('fabric.shell', 'fabric.facade', 'facade-shell', shell, 'facade')],
], culls: farKits.length === 0 ? [] : [{ roots: farKits.map(row => row.id), origins: farKits.flatMap(row => row.at), units: [], details: [], hosted: [] }],
sets: [...market.length === 0 ? [] : [{ id: 'nine-dragon-stack/night-market', name: 'Lantern Square night market', file: 'src/shards/nine-dragon-stack/generators/stalls.ts', place: 'nine-dragon-stack/night-market', members: market }],
  ...worldRows.rows.regions.flatMap(region => {
    const members = [...DRAWN_PLACEMENTS.filter(row => region.kits.includes(row.kit)).map(row => row.id), ...extras[region.extra] ?? []];
    return members.length === 0 ? [] : [{ id: region.id, name: region.name, place: region.place, file: 'src/shards/nine-dragon-stack/generators/worldRows.ts', members }];
  })] });
if (DRAWN_PLACEMENTS.some(row => !FABRIC.nodes.some(node => node.id === row.drawnInto.part))) throw new Error('Nine drawn-in copies need their kit in the fabric');
// each deck ending's entry decks and the facade's sign boards (casts, generators/castSources.ts) on the kit look, one step per ending
const FIXED_RECIPE = parseWorldScene({ imports: [], scene: { version: 1, root: 'root', textures: [], nodes: [{ kind: 'group', id: 'root', children: ['entries', 'signs'] },
  { kind: 'mesh', id: 'entries', geometry: 'entries', material: 'kit', missing: 'omit', name: 'kit:entries' }, { kind: 'mesh', id: 'signs', geometry: 'signs', material: 'kit', missing: 'omit', name: 'kit:facade-signs' }],
  materials: [{ kind: 'port', id: 'kit', source: 'kit' }] } });
const FIXED_STEPS = (['open', 'capped'] as const).map(caps => ({ id: `fixed-${caps}`, cube: caps === 'open' ? 'cell' : 'standalone', scene: 'world/scenes/fixed.json',
  geometry: { entries: { library: castLibrary(`entries-${caps}`), model: `entries-${caps}` }, signs: { library: castLibrary('facade-signs'), model: 'facade-signs' } }, materials: { kit: 'kit' } }));
export const NINE_WORLD_SCENES = parseWorldScenes({ version: 1, catalogue: 'models/world-scenes.json', lent, welds: [CAST_WELD, { id: 'fabric', file: 'world/fabric.json' }], placements: [...SET_PLACEMENTS, ...LAYOUT_PLACEMENTS.map(row => ({ id: row.id, file: layoutPlacementFile(row.id) }))], libraries: [...SIGN_POOL_LIBRARIES, ...CAST_LIBRARIES, ...portalLook.scenes.libraries, library('native'), library('native-explorer'), { id: 'shapes', kind: 'owned', models: shapes.map(([id]) => ({ id, file: `world/geometry/${id}.glb` })) }],
  materials: [...CAST_MATERIALS, ...portalLook.scenes.materials, look('kit', 'nine-architecture'), look('kit-cut', 'nine-architecture-cut'), look('facade', 'nine-facade'), look('small', 'nine-facade-small'), look('windows', 'nine-windows'), look('lantern', 'nine-lantern'),
    look('canopy-core', 'nine-canopy-inner'), look('canopy-cards', 'nine-canopy-cards'), look('canopy-depth', 'nine-canopy-depth'), look('mist-sheet', 'nine-mist-sheet'), look('steam', 'nine-steam'), look('sky', 'nine-sky'), look('scroll', 'nine-scroll'), look('streaks', 'nine-streaks'), look('halo', 'nine-halo'),
    look('neon', 'nine-neon'), look('neon-board', 'nine-neon-board'), look('neon-tube', 'nine-neon-tube')],
  steps: [{ id: 'dressing', scene: 'world/scenes/dressing.json', geometry: { ...Object.fromEntries(dressing.map(({ model }) => [model, { library: libraryOf.get(model) ?? signLibrary.get(model) ?? 'shapes', model }])), ...windowStep([0, 1]).geometry },
    instanceAttributes: windowStep([0, 1]).instanceAttributes,
    materials: Object.fromEntries(recipe.scene.materials.map(row => [row.id, row.id])), publish: { ...windowStep([0, 1]).publish, ...Object.fromEntries(['crown-core', 'crown-cards', 'signs', 'neon-boards'].filter(id => dressing.some(row => row.id === id)).map(id => [id, { kind: 'object', part: id }])) } }, ...cardSteps, ...FIXED_STEPS, ...portalLook.scenes.steps] });
/** the layout placements' files (LAYOUT_PLACEMENTS) */
export const LAYOUT_PLACEMENT_BLOBS: NamedBlob[] = [...LAYOUT_PLACEMENTS.map(row => nameBlob(layoutPlacementFile(row.id), 'json', new TextEncoder().encode(JSON.stringify(row)))),
  nameBlob('world/fabric.json', 'json', json(FABRIC)), nameBlob('world/scenes/fixed.json', 'json', json(FIXED_RECIPE))];
