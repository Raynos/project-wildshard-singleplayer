import { parsePrivateScene, parseWorldScene, parseWorldSceneBindings, type PrivateScene, type WorldSceneRecipe } from '@wildshard/format/clientChannels';
import { bridgeRestValues } from './bridgeRest';
import REST from '../data/restScenes.generated.json' with { type: 'json' };
import { FALLEN_BRIDGE, NOTES, SPANS, UPDRAFT, VANES, WINCH } from "./layout";
import { FALLEN_ANGLE } from './rows/moverBindings';
import STRINGS from '../data/strings.json' with { type: 'json' };
import { RISING_ISLETS } from './risingIslets';
import { PALETTE } from './palette';

type SceneMaterial = PrivateScene['materials'][number];
/** The rope rails (faceted rope brown) and the hover decks' faint glass, declared here so the client builds no material of its
 *  own: the glowing frame shows the path while you walk (E399), the plugin fills the glass in while you ride (`glass`). */
const ROPE: SceneMaterial = { kind: 'standard', id: 'rails', properties: { color: PALETTE.rope, flatShading: true, roughness: 0.95, metalness: 0 } };
const GLASS: SceneMaterial = { kind: 'standard', id: 'glass', properties: { color: PALETTE.glow, emissive: PALETTE.glow, emissiveIntensity: 0.25,
  transparent: true, opacity: 0.16, depthWrite: false, flatShading: false, roughness: 0.15, metalness: 0.1 } };
/** The Explorer's bridge kit keeps its original vertex-coloured deck. */
const KIT_DECK: SceneMaterial = { kind: 'standard', id: 'deck', properties: { color: 0xffffff, vertexColors: true, flatShading: false, roughness: 0.9, metalness: 0 } };
const declared = (materials: readonly SceneMaterial[], own: readonly SceneMaterial[]): SceneMaterial[] => materials.map(row => own.find(entry => entry.id === row.id) ?? row);

/** Source-owned route hierarchies, original registry identities and native motion ports. */
export interface SkyRouteValues {
  readonly SKY_ROUTE_SCENE: PrivateScene;
  readonly SKY_ROUTES: {
    readonly registry: readonly { readonly id: string; readonly name: string; readonly category: 'buildings'; readonly file: string; readonly surface: 'wood'; readonly mode?: 'board' }[];
    readonly bindings: readonly { readonly piece: string; readonly part: string }[];
  };
  readonly SKY_ROUTE_FRAMES: {
    readonly recipe: WorldSceneRecipe;
    readonly bindings: { readonly fallen: { readonly kind: 'group'; readonly part: string };
      readonly winchAt: { readonly kind: 'vector'; readonly value: readonly [number, number, number] };
      readonly notesAt: { readonly kind: 'vector'; readonly value: readonly [number, number, number] } };
  };
  readonly SKY_BRIDGE_KIT: PrivateScene;
  readonly SKY_VANES: {
    readonly recipe: WorldSceneRecipe;
    readonly kinds: Readonly<Record<string, 'group' | 'vector'>>;
    readonly ports: Readonly<Record<string, { kind: 'group'; part: string } | { kind: 'vector'; value: number[] }>>;
    readonly rows: readonly { readonly id: string; readonly flag: string; readonly rotor: string; readonly at: string }[];
    readonly bindings: readonly { readonly piece: string; readonly part: string }[];
  };
  readonly SKY_VANE: PrivateScene;
}

/** Registry identity does not require borrowing or constructing native bridge geometry. */
export function skyRouteRegistry(): SkyRouteValues['SKY_ROUTES']['registry'] {
  return [...SPANS, ...RISING_ISLETS.map(entry => entry.bridge), UPDRAFT].map(span => {
    const hover = span.kind === 'hover';
    const row: SkyRouteValues['SKY_ROUTES']['registry'][number] = { id: span.id, name: span.id === UPDRAFT.id ? STRINGS.updraft : hover ? STRINGS.hover : STRINGS.rope,
      category: 'buildings', file: 'src/shards/far-reach/world/build.ts', surface: 'wood' };
    return hover ? Object.assign(row, { mode: 'board' as const }) : row;
  });
}

/** Motion owners consume only the authored vane identities and flags, independent of a visual bake. */
export function skyVaneRows(): SkyRouteValues['SKY_VANES']['rows'] {
  return VANES.map(row => ({ id: row.id, flag: row.flag, rotor: `${row.id}.rotor`, at: `${row.id}.at` }));
}

/** Place the static spans and board-only updraft in their original world frames. */
export async function skyRouteValues(read: (url: string) => Uint8Array): Promise<SkyRouteValues> {
  const BRIDGES = await bridgeRestValues(read);
  const root = { kind: 'group' as const, id: 'routes', children: [] as string[] };
  const nodes: PrivateScene['nodes'] = [root];
  const registry = skyRouteRegistry(), bindings: SkyRouteValues['SKY_ROUTES']['bindings'][number][] = [];
  for (const span of [...SPANS, ...RISING_ISLETS.map(entry => entry.bridge), UPDRAFT]) {
    const hover = span.kind === 'hover', row = hover ? REST.hover.find(entry => entry.id === span.id) : BRIDGES.spans.find(entry => entry.id === span.id);
    if (row === undefined) throw new Error(`Missing route scene ${span.id}`);
    const scene = parsePrivateScene(row.scene), prefix = `${span.id}.`;
    root.children.push(prefix + scene.root);
    for (const node of scene.nodes) {
      nodes.push({ ...node, id: prefix + node.id, children: node.children.map(id => prefix + id),
        ...(node.id === scene.root ? { position: [span.x0, span.y, span.z0],
          rotation: [Math.atan2(span.y1 - span.y, Math.hypot(span.x1 - span.x0, span.z1 - span.z0)), Math.atan2(-(span.x1 - span.x0), -(span.z1 - span.z0)), 0],
          order: 'YXZ' } : {}) });
    }
    bindings.push({ piece: span.id, part: prefix + scene.root });
  }
  const scene: PrivateScene = { version: 1, root: root.id, nodes, textures: [], materials: declared(['deck', 'posts', 'rails', 'glass', 'frame'].map(id => ({ kind: 'port', id, source: id })), [ROPE, GLASS]) };
  parsePrivateScene(scene);
  const fallenRow = BRIDGES.spans.find(row => row.id === FALLEN_BRIDGE.id), kitRow = BRIDGES.spans.find(row => row.id === 'kit');
  if (fallenRow === undefined || kitRow === undefined) throw new Error('Missing authored bridge scene');
  const deck = parsePrivateScene(fallenRow.scene), authoredKit = parsePrivateScene(kitRow.scene);
  const kit: PrivateScene = { ...authoredKit, materials: declared(authoredKit.materials, [ROPE, KIT_DECK]) };
  const deckId = (id: string): string => id === deck.root ? 'deck' : `deck.${id}`;
  const fallen: PrivateScene = { version: 1, root: 'fallen', materials: declared(deck.materials, [ROPE]), textures: deck.textures, nodes: [
    { kind: 'group', id: 'fallen', position: [FALLEN_BRIDGE.x0, FALLEN_BRIDGE.y, FALLEN_BRIDGE.z0],
      rotation: [FALLEN_ANGLE, Math.atan2(-(FALLEN_BRIDGE.x1 - FALLEN_BRIDGE.x0), -(FALLEN_BRIDGE.z1 - FALLEN_BRIDGE.z0)), 0], order: 'YXZ', children: ['deck'] },
  ] };
  for (const node of deck.nodes) fallen.nodes.push({ ...node, id: deckId(node.id), children: node.children.map(deckId) });
  parsePrivateScene(fallen);
  const frames: SkyRouteValues['SKY_ROUTE_FRAMES'] = { recipe: { scene: fallen, imports: [] }, bindings: { fallen: { kind: 'group', part: 'fallen' },
    winchAt: { kind: 'vector', value: [WINCH.x, WINCH.y + 1.2, WINCH.z] }, notesAt: { kind: 'vector', value: [NOTES.x, NOTES.y + 1.3, NOTES.z] } } };
  const vaneNodes: PrivateScene['nodes'] = [
    { kind: 'group', id: 'vane', children: ['post', 'rotor'] },
    { kind: 'mesh', id: 'post', geometry: 'vane-post', material: 'facets', missing: 'omit', children: [] },
    { kind: 'group', id: 'rotor', position: [0, 2.2, 0], children: ['cups'] },
    { kind: 'mesh', id: 'cups', geometry: 'vane-rotor', material: 'facets', missing: 'omit', children: [] },
  ];
  const vane: PrivateScene = { version: 1, root: 'vane', nodes: vaneNodes, textures: [], materials: [
    { kind: 'standard', id: 'facets', properties: { color: 0xffffff, vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 } },
  ] };
  const vaneWorld: PrivateScene = { ...vane, root: 'vanes', nodes: [{ kind: 'group', id: 'vanes', children: VANES.map(row => `${row.id}.vane`) }] };
  const vanePorts: Record<string, { kind: 'group'; part: string } | { kind: 'vector'; value: number[] }> = {};
  const vaneKinds: Record<string, 'group' | 'vector'> = {};
  for (const row of VANES) {
    for (const node of vaneNodes) {
      const placed = { ...node, id: `${row.id}.${node.id}`, children: node.children.map(id => `${row.id}.${id}`) };
      if (placed.kind === 'group' && node.id === vane.root) placed.position = [row.x, row.y, row.z];
      vaneWorld.nodes.push(placed);
    }
    vanePorts[`${row.id}.rotor`] = { kind: 'group', part: `${row.id}.rotor` }; vaneKinds[`${row.id}.rotor`] = 'group';
    vanePorts[`${row.id}.at`] = { kind: 'vector', value: [row.x, row.y + 3.3, row.z] }; vaneKinds[`${row.id}.at`] = 'vector';
  }
  parsePrivateScene(vane); parsePrivateScene(vaneWorld);
  const vanes = { recipe: { scene: vaneWorld, imports: [] }, kinds: vaneKinds, ports: vanePorts,
    rows: skyVaneRows(),
    bindings: VANES.map(row => ({ piece: `far.vane.${row.id}`, part: `${row.id}.vane` })) };
  return structuredClone({ SKY_ROUTE_SCENE: scene, SKY_ROUTES: { registry, bindings }, SKY_ROUTE_FRAMES: frames, SKY_BRIDGE_KIT: kit, SKY_VANES: vanes, SKY_VANE: vane });
}

/** Retained publication keeps the original complete JSON transport over owned source values. */
export async function skyRouteSource(read: (url: string) => Uint8Array): Promise<Uint8Array> {
  return new TextEncoder().encode(`${JSON.stringify(await skyRouteValues(read))}\n`);
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
function bindingRows(value: unknown): SkyRouteValues['SKY_ROUTES']['bindings'] {
  if (!Array.isArray(value) || value.length > 1024) throw new Error('Sky route bindings differ');
  return value.map((row: unknown) => {
    if (!record(row) || Object.keys(row).length !== 2 || typeof row['piece'] !== 'string' || typeof row['part'] !== 'string'
      || row['piece'].length > 128 || row['part'].length > 128) throw new Error('Sky route binding differs');
    return { piece: row['piece'], part: row['part'] };
  });
}

/** Admit the bounded owned wire through the defining hierarchy/binding parsers before publication. */
export function readSkyRouteValues(bytes: Uint8Array): SkyRouteValues {
  if (bytes.byteLength === 0 || bytes.byteLength > 1_000_000) throw new Error('Sky route wire exceeds its bound');
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!record(value) || Object.keys(value).sort().join('|') !== 'SKY_BRIDGE_KIT|SKY_ROUTES|SKY_ROUTE_FRAMES|SKY_ROUTE_SCENE|SKY_VANE|SKY_VANES'
    || !record(value['SKY_ROUTES']) || !record(value['SKY_ROUTE_FRAMES']) || !record(value['SKY_VANES'])) throw new Error('Sky route envelope differs');
  const routes = value['SKY_ROUTES'], frames = value['SKY_ROUTE_FRAMES'], vanes = value['SKY_VANES'];
  const registry = skyRouteRegistry(), rows = skyVaneRows();
  if (Object.keys(routes).length !== 2 || Object.keys(frames).length !== 2 || Object.keys(vanes).length !== 5
    || JSON.stringify(routes['registry']) !== JSON.stringify(registry) || JSON.stringify(vanes['rows']) !== JSON.stringify(rows)) throw new Error('Sky route identity inventory differs');
  const scene = parsePrivateScene(value['SKY_ROUTE_SCENE']), bindings = bindingRows(routes['bindings']);
  if (bindings.length !== registry.length || bindings.some((row, index) => row.piece !== registry[index]?.id || !scene.nodes.some(node => node.id === row.part))) throw new Error('Sky route registry bindings differ');
  const frameBindings = parseWorldSceneBindings(frames['bindings']);
  const fallen = frameBindings['fallen'], winchAt = frameBindings['winchAt'], notesAt = frameBindings['notesAt'];
  if (Object.keys(frameBindings).length !== 3 || fallen?.kind !== 'group' || winchAt?.kind !== 'vector' || notesAt?.kind !== 'vector') throw new Error('Sky route frame bindings differ');
  const expectedKinds: Record<string, 'group' | 'vector'> = Object.fromEntries(rows.flatMap((row): [string, 'group' | 'vector'][] => [[row.rotor, 'group'], [row.at, 'vector']]));
  if (JSON.stringify(vanes['kinds']) !== JSON.stringify(expectedKinds)) throw new Error('Sky vane port inventory differs');
  const vaneRecipe = parseWorldScene(vanes['recipe']), parsedPorts = parseWorldSceneBindings(vanes['ports']);
  const vaneBindings = bindingRows(vanes['bindings']);
  if (JSON.stringify(vaneBindings) !== JSON.stringify(rows.map(row => ({ piece: `far.vane.${row.id}`, part: `${row.id}.vane` })))) throw new Error('Sky vane registry differs');
  if (Object.keys(parsedPorts).length !== Object.keys(expectedKinds).length) throw new Error('Sky vane bindings differ');
  const ports: SkyRouteValues['SKY_VANES']['ports'] = Object.fromEntries(Object.entries(expectedKinds).map(([key, kind]): [string, SkyRouteValues['SKY_VANES']['ports'][string]] => {
    const port = parsedPorts[key];
    if (kind === 'group' && port?.kind === 'group' && vaneRecipe.scene.nodes.some(node => node.id === port.part)) return [key, { kind: 'group', part: port.part }];
    if (kind === 'vector' && port?.kind === 'vector') return [key, { kind: 'vector', value: [...port.value] }];
    throw new Error('Sky vane binding kind differs');
  }));
  return { SKY_ROUTE_SCENE: scene, SKY_ROUTES: { registry, bindings }, SKY_ROUTE_FRAMES: { recipe: parseWorldScene(frames['recipe']),
    bindings: { fallen: { kind: 'group', part: fallen.part }, winchAt: { kind: 'vector', value: winchAt.value }, notesAt: { kind: 'vector', value: notesAt.value } } },
    SKY_BRIDGE_KIT: parsePrivateScene(value['SKY_BRIDGE_KIT']), SKY_VANES: { recipe: vaneRecipe, kinds: expectedKinds, ports, rows, bindings: vaneBindings }, SKY_VANE: parsePrivateScene(value['SKY_VANE']) };
}
