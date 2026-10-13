import { Group, InstancedMesh, Matrix4, Mesh, type Object3D } from 'three';
import type { ShardProps } from '@wildshard/format/props';
import type { Shardfile } from '@wildshard/format/shardSchema';
import { readScene, type SceneDescription } from './scene';
// oxlint-disable-next-line import/no-nodejs-modules -- scene.json, the inspectable intermediate, is written inside the author project.
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Cache destinations must remain within the project.
import { dirname, resolve, sep } from 'node:path';
import { encodeCanonicalJson, hashImmutableBytes } from './immutable';
import { Collider } from './physics';
import { bakeTerrain, type BakedTerrain, type TerrainBakeSource } from './bake/terrain';
import { bakeProps, type BakedProps, type PropScatter, type PropsBakeSource } from './bake/props';
import { bakeKinds, type KindBakeOptions, type KindCollider, type PieceBake } from './bake/kinds';

/**
 * SHARD-PLATFORM SF80 (design-system.md §3, "the design's central call"): `bake(scene, identity)`. A generator builds an
 * ordinary three.js `Scene`; `bake` walks it once, writes its inspectable `scene.json` (`synth`), and emits the shardfile
 * content the scene declares:
 *
 * - **terrain**: the ground's height / colour recipe (`inputs.terrain`) baked into the 64 L0 + 16 L1 tiles and the critical
 *   collider (`bake/terrain`);
 * - **static props**: every plain `Mesh` outside a `BakedPiece` / `Scatter`, merged per tile onto those tiles (`bake/props`);
 * - **scatter**: every `InstancedMesh` (one model) and every `Scatter` (a multi-mesh model) as per-tile instance lists;
 * - **pieces**: every `BakedPiece`, its named `InstancedMesh` kinds folded into one instanced GLB (`bake/kinds`; one draw
 *   per kind, never multi-draw) with the collider rows it declares;
 * - **colliders**: the SDK `Collider` nodes (`@wildshard/sdk/physics`), the props' collider rows and each piece's rows.
 *
 * It runs only at build time and never installs a service. Generic: it knows no shard, only the scene it is handed.
 */

/** An inspected author graph and the exact digest/path of its canonical JSON; neither is a finished shardfile. */
export interface SynthResult {
  scene: SceneDescription;
  hash: string;
  path: string;
}

/** A path under the author project, refused when it (or its nearest existing parent) resolves outside it. */
export function confined(root: string, path: string): string {
  const destination = resolve(root, path);
  let existing = destination;
  while (!existsSync(existing)) existing = dirname(existing);
  const actual = realpathSync(existing);
  if (actual !== root && !actual.startsWith(root + sep)) throw new Error('Scene synth path resolves outside project');
  return destination;
}

/** Publish an already-read description as canonical scene.json (and its content-hash copy); `synth` and `bake` both write through it. */
export function publishScene(description: SceneDescription, project: string, slug: string): SynthResult {
  if (!/^[a-z][a-z0-9-]{0,127}$/u.test(slug)) throw new Error('Scene synth requires a bounded shard slug');
  const root = realpathSync(project);
  const bytes = new TextEncoder().encode(encodeCanonicalJson(description)), hash = hashImmutableBytes(bytes);
  const cache = `.wildshard/cache/${slug}`, immutable = confined(root, `${cache}/${hash}/scene.json`);
  const path = confined(root, `${cache}/scene.json`);
  if (existsSync(immutable)) {
    if (hashImmutableBytes(readFileSync(immutable)) !== hash) throw new Error('Scene synth cached bytes disagree with their content hash');
  } else { mkdirSync(dirname(immutable), { recursive: true }); writeFileSync(immutable, bytes, { flag: 'wx' }); }
  writeFileSync(path, bytes);
  return { scene: description, hash, path };
}

/** The shard a scene bakes into (`shard.config.ts`'s identity). */
export interface BakeIdentity { slug: string; name?: string }

/** A code-built world piece baked as instanced kinds: its children are the named kinds, its rows the colliders it declares. */
export class BakedPiece<C extends KindCollider = KindCollider> extends Group {
  readonly colliders: readonly C[];
  readonly options: KindBakeOptions;
  /** Extra plain JSON rows the piece's client reads beside its kinds (anchors, per-piece placements). */
  readonly rows: Readonly<Record<string, unknown>>;
  constructor(name: string, kinds: readonly (readonly [string, InstancedMesh])[], colliders: readonly C[], options: KindBakeOptions = {}, rows: Readonly<Record<string, unknown>> = {}) {
    super();
    this.name = name; this.colliders = colliders; this.options = options; this.rows = rows;
    for (const [kind, mesh] of kinds) { mesh.name = kind; this.add(mesh); }
  }
  /** The piece's kinds, in authored order. */
  kinds(): (readonly [string, InstancedMesh])[] {
    return this.children.filter((child): child is InstancedMesh => child instanceof InstancedMesh).map((mesh) => [mesh.name, mesh] as const);
  }
}

/** One (possibly multi-mesh) model scattered at world transforms; the model is its only child, at the scatter's origin. */
export class Scatter extends Group {
  readonly model: Object3D;
  readonly transforms: readonly Matrix4[];
  constructor(name: string, model: Object3D, transforms: readonly Matrix4[]) {
    super();
    this.name = name; this.model = model; this.transforms = transforms.map((m) => m.clone());
    this.add(model);
  }
}

/** Build-time inputs a scene graph cannot hold: closures, library panels and hand-made proxies. */
export interface BakeInputs {
  /** Repository / author-project root: `scene.json` goes to `<project>/.wildshard/cache/<slug>/`. Omitted: nothing is written. */
  project?: string;
  /** The ground's recipe (closures run here only). Omitted: the shardfile has no terrain. */
  terrain?: TerrainBakeSource;
  /** Props options the graph does not express yet: panels, library models, coarse / far proxies, family, colour texture. */
  props?: Omit<PropsBakeSource, 'static' | 'scatter'>;
}

/** A baked piece: its GLB, kind rows, collider rows and extra rows. */
export interface BakedSceneParts extends PieceBake { name: string; rows: Readonly<Record<string, unknown>> }

/** Everything `bake` emits: the shardfile rows, the immutable files by hash and the pieces' GLBs. */
export interface BakedScene {
  identity: BakeIdentity;
  /** The synthesized description, its content hash and where it was written (null without `inputs.project`). */
  scene: SceneDescription; sceneHash: string | null; scenePath: string | null;
  terrain: BakedTerrain | null;
  props: BakedProps | null;
  pieces: BakedSceneParts[];
  /** Shardfile rows in the product's canonical order (tiles by lod, x, z; files by hash). */
  shardfile: Pick<Shardfile, 'tiles' | 'files' | 'critical'> & Partial<Pick<Shardfile, 'edge' | 'terrain' | 'far' | 'library'>>;
  colliders: { scene: SceneDescription['colliders']; props: ShardProps['colliders']; pieces: { piece: string; colliders: PieceBake['colliders'] }[] };
  assets: Map<string, Uint8Array>;
}

const SLUG = /^[a-z][a-z0-9-]{0,127}$/u;

const isPiece = (object: Object3D): object is BakedPiece => object instanceof BakedPiece;
const isMesh = (object: Object3D): object is Mesh => object instanceof Mesh;

/** Inside a piece or a scatter (their own bakers own those meshes). */
function owned(object: Object3D): boolean {
  for (let node: Object3D | null = object.parent; node !== null; node = node.parent) if (node instanceof BakedPiece || node instanceof Scatter) return true;
  return false;
}

/** World-placed stand-in for a mesh, so the props merge reads exactly its world triangles. */
function placed(mesh: Mesh): Mesh {
  const proxy = new Mesh(mesh.geometry, mesh.material);
  proxy.matrixAutoUpdate = false; proxy.matrix.copy(mesh.matrixWorld);
  return proxy;
}

/** Walk `scene`, synthesize `scene.json` and bake the shardfile content it declares (see the module comment). */
export function bake(scene: Object3D, identity: BakeIdentity, inputs: BakeInputs = {}): BakedScene {
  if (!SLUG.test(identity.slug)) throw new Error('bake: identity needs a bounded shard slug');
  scene.updateMatrixWorld(true);
  const statics = new Group(), scatter: PropScatter[] = [], pieces: BakedPiece[] = [];
  scene.traverse((object) => {
    if (owned(object)) return;
    if (isPiece(object)) { pieces.push(object); return; }
    if (object instanceof Scatter) {
      if (!object.matrixWorld.equals(new Matrix4())) throw new Error(`bake: scatter ${object.name} must sit at the world origin (its transforms are world space)`);
      scatter.push({ model: object.model, transforms: object.transforms }); return;
    }
    if (object instanceof InstancedMesh) {
      const transforms = Array.from({ length: object.count }, (_, i) => { const m = new Matrix4(); object.getMatrixAt(i, m); return object.matrixWorld.clone().multiply(m); });
      scatter.push({ model: new Mesh(object.geometry, object.material), transforms }); return;
    }
    if (isMesh(object) && !(object instanceof Collider)) statics.add(placed(object));
  });
  if (new Set(pieces.map((p) => p.name)).size !== pieces.length || pieces.some((p) => p.name === '')) throw new Error('bake: every piece needs a unique name');

  // synth: the inspectable middle step, with each scatter's instances and each piece's declared rows on its node
  const description = readScene(scene), byId = new Map(description.nodes.map((n) => [n.id, n]));
  scene.traverse((object) => {
    if (!(object instanceof Scatter)) return;
    const node = byId.get(object.name);
    if (node === undefined) throw new Error(`bake: scatter ${object.name} needs a unique name`);
    node.instances = object.transforms.map((m) => [...m.elements]);
  });
  const published = inputs.project === undefined ? null : publishScene(description, inputs.project, identity.slug);

  const terrain = inputs.terrain === undefined ? null : bakeTerrain(inputs.terrain);
  if (terrain !== null) { terrain.tiles.sort((a, b) => a.lod - b.lod || a.x - b.x || a.z - b.z); terrain.files.sort((a, b) => a.hash.localeCompare(b.hash)); }
  const hasProps = statics.children.length > 0 || scatter.length > 0 || (inputs.props?.panels?.length ?? 0) > 0;
  const props = hasProps ? bakeProps({ ...inputs.props, static: statics, scatter }, terrain?.tiles ?? []) : null;
  const baked = pieces.map((piece): BakedSceneParts => Object.assign(bakeKinds(piece.name, piece.kinds(), piece.colliders, piece.options), { name: piece.name, rows: piece.rows }));

  const assets = new Map([...terrain?.assets ?? [], ...props?.assets ?? []]);
  const tiles = (props?.tiles ?? terrain?.tiles ?? []).slice().sort((a, b) => a.lod - b.lod || a.x - b.x || a.z - b.z);
  const files = [...terrain?.files ?? [], ...props?.files ?? []].sort((a, b) => a.hash.localeCompare(b.hash));
  const shardfile: BakedScene['shardfile'] = { tiles, files, critical: terrain?.critical ?? [],
    ...(terrain === null ? {} : { terrain: terrain.terrain, edge: terrain.edge }), ...(props === null ? {} : { far: props.far, library: props.library }) };
  return { identity, scene: description, sceneHash: published?.hash ?? null, scenePath: published?.path ?? null, terrain, props, pieces: baked, shardfile,
    colliders: { scene: description.colliders, props: props?.props.colliders ?? inputs.props?.colliders ?? [], pieces: baked.map((p) => ({ piece: p.name, colliders: p.colliders })) }, assets };
}
