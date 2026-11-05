import { CatmullRomCurve3, CylinderGeometry, Group, Mesh, MeshStandardMaterial, TubeGeometry, Vector3, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clientSceneGlb } from '@wildshard/sharddev/bake/glb';
import { GeometryPack, packedRows } from '@wildshard/sharddev/kit/geometryPack';
import { bakeSkyBridges, ropeSpans } from './bridges';
import { BRIDGE_REST_URL } from './restFiles';
import type { AuthorPrivateScene as PrivateScene } from '@wildshard/sharddev/worldScenes';

type ReadAsset = (url: string) => Uint8Array;
interface BridgeSpan { id: string; deckGeometry: string; deck: number[]; posts: number[]; ropes: string[] }
export interface BridgeRestRows { pool: { url: string; parts: string[] }; spans: (BridgeSpan & { scene: PrivateScene })[] }

function partNames(index: number): { deck: string; ropes: string; ties: string } {
  const prefix = `bridge-${String(index)}`;
  return { deck: `${prefix}-deck`, ropes: `${prefix}-ropes`, ties: `${prefix}-ties` };
}
/** Derive the native pool inventory from the same authored spans and names as the geometry builder. */
export function bridgeRestPool(): BridgeRestRows['pool'] {
  const parts: string[] = [];
  for (const [index, span] of ropeSpans().entries()) {
    const names = partNames(index);
    parts.push(names.deck, names.ropes);
    if (span.length - 1.2 > 2.5) parts.push(names.ties);
  }
  return { url: BRIDGE_REST_URL, parts };
}
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
async function make(read: ReadAsset): Promise<{ glb: Uint8Array; rows: BridgeRestRows }> {
  const { bin, rows: source } = await bakeSkyBridges(read);
  const pack = new GeometryPack(bin, packedRows(source), 'Sky bridge author');
  const root = new Group(), material = new MeshStandardMaterial(); root.name = 'bridge-rest';
  const owned: BufferGeometry[] = [];
  const spans = source.spans.map((span, index) => {
    const names = partNames(index), deckGeometry = names.deck, ropes: string[] = [];
    const geometry = pack.geometry(source.deck), [sx, sy, sz] = span.deck.scale;
    geometry.scale(sx, sy, sz); geometry.computeVertexNormals(); geometry.computeBoundingBox(); owned.push(geometry);
    const deck = new Mesh(geometry, material); deck.name = deckGeometry; root.add(deck);
    // Far Reach's phone draw cap (5c72 Simulator census): both sides' top and mid ropes in one indexed geometry and both
    // sides' ties in one non-indexed one, two draws a span (was six); the same triangles in the span's space and the same
    // flat-shaded rails material. The ties stay non-indexed and apart from the tubes: indexed and merged they cost the
    // phone 19 KB more at the deploy's brotli (quality 3) for one draw less
    const tubes: BufferGeometry[] = [], ties: BufferGeometry[] = [];
    for (const side of span.sides) {
      for (const row of [side.top, side.mid]) {
        const points = Array.from({ length: row.at.length / 3 }, (_, i) => new Vector3(row.at[i * 3], row.at[i * 3 + 1], -(row.at[i * 3 + 2] ?? 0)));
        tubes.push(new TubeGeometry(new CatmullRomCurve3(points), 48, row.r, 6, false));
      }
      for (let i = 0; i + 3 < side.ties.length; i += 4) {
        const tie = new CylinderGeometry(0.009, 0.009, side.ties[i + 3], 4, 1);
        tie.translate(side.ties[i] ?? 0, side.ties[i + 1] ?? 0, -(side.ties[i + 2] ?? 0)); ties.push(tie.toNonIndexed()); tie.dispose();
      }
    }
    for (const [name, parts] of [[names.ropes, tubes], [names.ties, ties]] as const) {
      if (parts.length === 0) continue;
      const combined = mergeGeometries(parts);
      for (const piece of parts) piece.dispose();
      if (combined === null) throw new Error('Sky bridge rails do not merge');
      owned.push(combined);
      const mesh = new Mesh(combined, material); mesh.name = name; root.add(mesh); ropes.push(mesh.name);
    }
    const row = { id: span.id, deckGeometry, deck: Array.from(pack.floats(span.deck.at)), posts: Array.from(pack.floats(span.posts)), ropes };
    return Object.assign(row, { scene: bridgeScene(row) });
  });
  try {
    const pool = bridgeRestPool();
    if (JSON.stringify(pool.parts) !== JSON.stringify(root.children.map(part => part.name))) throw new Error('Sky bridge pool inventory differs');
    const made = clientSceneGlb(root, new Map([[material, 'bridge-material']]));
    return { glb: made.glb, rows: { pool, spans } };
  } finally { for (const geometry of owned) geometry.dispose(); material.dispose(); }
}

/** Supply the complete typed original hierarchy directly to retained author readers. */
export async function bridgeRestValues(read: ReadAsset): Promise<BridgeRestRows> {
  const made = await make(read);
  return made.rows;
}

/** Return both original outputs from one native bake, without publishing an intermediate file. */
export async function bridgeRestFiles(read: ReadAsset): Promise<Map<string, Uint8Array>> {
  const made = await make(read);
  return new Map([
    ['bridge-rest.glb', made.glb],
    ['bridge-rest.json', new TextEncoder().encode(`${JSON.stringify(made.rows)}\n`)],
  ]);
}
