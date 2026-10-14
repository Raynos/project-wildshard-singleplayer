import { CatmullRomCurve3, CylinderGeometry, Group, Mesh, MeshStandardMaterial, TubeGeometry, Vector3, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clientSceneGlb } from '@wildshard/sdk/bake/glb';
import { GeometryPack, packedRows } from '@wildshard/sdk/kit/geometryPack';
import source from '../data/bridges.json' with { type: 'json' };
import { BRIDGES_URL } from '../data/files';
import { BRIDGE_REST_URL } from '../data/restFiles';
import type { PrivateScene } from '@wildshard/format/clientChannels';

type ReadAsset = (url: string) => Uint8Array;
interface BridgeSpan { id: string; deckGeometry: string; deck: number[]; posts: number[]; ropes: string[] }
/** Static bridge hierarchy; materials and the prepared anchor-post geometry remain borrowed visual ports. */
function bridgeScene(span: BridgeSpan): PrivateScene {
  const nodes: PrivateScene['nodes'] = [
    { kind: 'group', id: 'bridge', children: ['deck', 'posts', ...span.ropes] },
    { kind: 'mesh', id: 'deck', geometry: span.deckGeometry, material: 'deck', instances: span.deck.length / 16,
      matrices: span.deck, missing: 'empty', children: [] },
    { kind: 'mesh', id: 'posts', geometry: 'post-hd', material: 'posts', instances: span.posts.length / 16,
      matrices: span.posts, missing: 'omit', children: [] },
    ...span.ropes.map(name => ({ kind: 'mesh' as const, id: name, geometry: name, material: 'rails', missing: 'empty' as const, children: [] })),
  ];
  return { version: 1, root: 'bridge', nodes, textures: [], materials: [
    { kind: 'port', id: 'deck', source: 'deck' }, { kind: 'port', id: 'posts', source: 'posts' },
    { kind: 'port', id: 'rails', source: 'rails' },
  ] };
}
/** Compile all static decks, curved rails and ties; the native owners retain instancing and materials. */
async function make(read: ReadAsset): Promise<{ glb: Uint8Array; rows: { pool: { url: string; parts: string[] }; spans: (BridgeSpan & { scene: PrivateScene })[] } }> {
  const inflated = await new Response(new Blob([new Uint8Array(read(BRIDGES_URL))]).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer();
  const pack = new GeometryPack(new Uint8Array(inflated), packedRows(source), 'Sky bridge author');
  const root = new Group(), material = new MeshStandardMaterial(); root.name = 'bridge-rest';
  const owned: BufferGeometry[] = [];
  const spans = source.spans.map((span, index) => {
    const prefix = `bridge-${String(index)}`, deckGeometry = `${prefix}-deck`, ropes: string[] = [];
    const geometry = pack.geometry(source.deck), [sx = 1, sy = 1, sz = 1] = span.deck.scale;
    geometry.scale(sx, sy, sz); geometry.computeVertexNormals(); geometry.computeBoundingBox(); owned.push(geometry);
    const deck = new Mesh(geometry, material); deck.name = deckGeometry; root.add(deck);
    for (const [sideIndex, side] of span.sides.entries()) {
      for (const [name, row] of [['top', side.top], ['mid', side.mid]] as const) {
        const points = Array.from({ length: row.at.length / 3 }, (_, i) => new Vector3(row.at[i * 3], row.at[i * 3 + 1], -(row.at[i * 3 + 2] ?? 0)));
        const mesh = new Mesh(new TubeGeometry(new CatmullRomCurve3(points), 48, row.r, 6, false), material);
        mesh.name = `${prefix}-${String(sideIndex)}-${name}`; root.add(mesh); ropes.push(mesh.name); owned.push(mesh.geometry);
      }
      const ties = [];
      for (let i = 0; i + 3 < side.ties.length; i += 4) {
        const tie = new CylinderGeometry(0.009, 0.009, side.ties[i + 3], 4, 1);
        tie.translate(side.ties[i] ?? 0, side.ties[i + 1] ?? 0, -(side.ties[i + 2] ?? 0)); ties.push(tie.toNonIndexed()); tie.dispose();
      }
      if (ties.length > 0) {
        const combined = mergeGeometries(ties); owned.push(combined);
        const mesh = new Mesh(combined, material); mesh.name = `${prefix}-${String(sideIndex)}-ties`; root.add(mesh); ropes.push(mesh.name);
        for (const tie of ties) tie.dispose();
      }
    }
    const row = { id: span.id, deckGeometry, deck: Array.from(pack.floats(span.deck.at)), posts: Array.from(pack.floats(span.posts)), ropes };
    return Object.assign(row, { scene: bridgeScene(row) });
  });
  try {
    const made = clientSceneGlb(root, new Map([[material, 'bridge-material']]));
    return { glb: made.glb, rows: { pool: { url: BRIDGE_REST_URL, parts: root.children.map(part => part.name) }, spans } };
  } finally { for (const geometry of owned) geometry.dispose(); material.dispose(); }
}
export async function bridgeRestGlb(read: ReadAsset): Promise<Uint8Array> { return (await make(read)).glb; }
export async function bridgeRestRows(read: ReadAsset): Promise<Uint8Array> { return new TextEncoder().encode(`${JSON.stringify((await make(read)).rows)}\n`); }
