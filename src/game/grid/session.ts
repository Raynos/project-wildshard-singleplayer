/**
 * The grid session (SHARD-PLATFORM SF17b / SF18a / SF18b / SF21a, the grid client): what turns EXPERIMENTAL Wildshard's
 * home-cell boot into a 3 × 3 grid inside the one page. The home cell boots through the normal shard flow (its own
 * player, camera, HUD and the page's one fixed step); this session adds, around it, in the home cell's frame:
 *
 * - **the highway deck and strips**: `generatePlatform` (the pure SF17b generator) over the assembly, drawn as one mesh
 *   and installed as platform-owned trimesh colliders in the home world (the same vertices; `installStripCollider`).
 *   No shard declares an edge profile yet, so every cell edge is the catalogue's empty-neighbour profile (road level).
 * - **render origin per cell** (C39): the home cell is the render origin; every other cell's root sits at its origin
 *   minus the home origin, and the rings get world positions (local + home origin).
 * - **neighbours as their declared fallback** (§3.3): no neighbour is a resident shardfile sim in the page yet, so each
 *   shows its baked far proxy (SF23) through the render rings (SF18b) and one residency allocator; its edge holds as a
 *   soft wall at the 6 m re-frame line (SF18d `ReadinessWalls`, closed while its sim is not ready, which today is always).
 *   The grid's outer rim is a closed edge past the outer strips (the empty neighbour: open sea at road level).
 * - **cell events**: `gridCells.enter` while the player's feet are in the home cell's interior, `leave` on the deck
 *   (SF46's hybrid runtime runs only inside its cell).
 * - **legacy bounds yield** (SF17a): the session asks the level to leave out its chunk-edge walls and hide the edge
 *   veil (`gridLevel`), the bounds' horizontal check reads `grid`; fall recovery stays.
 */
import { BufferAttribute, BufferGeometry, Group, Mesh, MeshLambertMaterial, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as v from 'valibot';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import { versionedUrl } from '@wildshard/engine/boot/bytes';
import type { LevelSpec } from '@wildshard/engine/level/spec';
import type { Scope } from '@wildshard/engine/app/scope';
import { app } from '@wildshard/engine/app/runtime';
import type { Physics } from '@wildshard/engine/physics/Physics';
import { installStripCollider } from '@wildshard/engine/physics/stripColliders';
import { ReadinessWalls, type ReadinessEdge } from '@wildshard/engine/physics/readinessWalls';
import { installGridBorders } from '@wildshard/engine/physics/gridBorders';
import { generatePlatform, type GeneratedStrip, type PlatformCell, type StripMesh } from '@wildshard/engine/sim/strips';
import { GridAssembly, type GridCell } from './assembly';
import { gridMode } from './menu';
import { devserverCellOn, gridOneFrameOn, installGridFrameRow } from './debug';
import { gridCells, pageGridInstance, pageMode } from './boot';
import { ResidencyAllocator } from './allocator';
import { RenderRings, levelPorts, type LevelPrepared, type RingPorts } from './rings';
import { farRingPorts, type FarPrepared } from './farView';
import type { FarLookRuntime } from './farProxy';
import { GridFrame, type GridFrameHost, type GridFrameState } from './frame';

/** In grid mode the level's own chunk-edge walls and veil yield to the platform (the standalone path is unchanged). */
export function gridLevel(spec: LevelSpec): LevelSpec {
  if (pageMode() !== 'grid') return spec;
  return { ...spec, boundary: { ...spec.boundary, visible: false, walls: false } };
}

/** What the session reads from the page: the player's feet in the home frame, the scene, the world, the fixed step. */
export interface GridSessionHost {
  readonly scene: Object3D;
  readonly physics: Physics;
  readonly scope: Scope;
  readonly feet: () => { readonly x: number; readonly y: number; readonly z: number };
  /** Register once per fixed step (the page's one fixed step; never a second loop). */
  readonly onFixed: (fn: (dt: number) => void) => void;
  /** SF19a's one frame: the camera, composer and grade effects, and the page's late phase (absent: never built) */
  readonly frame?: GridFrameHost & { readonly onLate: (fn: () => void) => void };
}
/** What each cell shows today, for the readout and the report. */
export type GridCellShows = 'playing' | 'far proxy' | 'loading';
/** The session's readout (tests, harness, the board). */
export interface GridSessionState {
  readonly home: string; readonly inside: string | null; readonly feet: { x: number; z: number };
  readonly cells: readonly { readonly instance: string; readonly slug: string; readonly cell: readonly [number, number]; readonly shows: GridCellShows }[];
  readonly strips: number; readonly ringsReady: boolean;
  /** the allocator's grid content (MB) and the §3.2 playing total with the engine base (MB, the 850 MB envelope) */
  readonly residentMB: number; readonly playingMB: number;
  readonly rings: { readonly far: number; readonly l1: number; readonly l0: number; readonly refused: number };
  /** SF19a's one frame (null with its Debug row off) */
  readonly frame: GridFrameState | null;
}

const FALLBACK = (): never => { throw new Error('Grid neighbours have no streamed tiles yet (their far proxy is the fallback)'); };
const noTiles: RingPorts<never> = { fetch: (_tile, done) => { done(new Error('no tiles')); }, upload: FALLBACK };

/** The far proxy and its row, fetched from the shard's baked folder (`public/assets/baked/<slug>/far.*`). */
async function loadFar(slug: string): Promise<{ prepared: FarPrepared; bytes: number }> {
  const base = `/assets/baked/${slug}/far`;
  const response = await fetch(versionedUrl(`${base}.json`));
  if (!response.ok) throw new Error(`far.json ${slug}: ${String(response.status)}`);
  const row: unknown = await response.json();
  const look = farLook(row), bytes = farBytes(row);
  const gltf = await new GLTFLoader().loadAsync(versionedUrl(`${base}.glb`));
  const meshes: BufferGeometry[] = [];
  gltf.scene.traverse((node) => { if (!(node instanceof Mesh)) return; const found: unknown = node.geometry; if (found instanceof BufferGeometry) meshes.push(found as BufferGeometry); });
  const geometry = meshes[0];
  if (geometry === undefined) throw new Error(`far.glb ${slug}: no mesh`);
  return { prepared: { geometry, look }, bytes };
}
const num = v.pipe(v.number(), v.finite());
/** The part of `far.json` the client reads: the resident cost and the look (the bake writes more). */
const FarRow = v.object({ far: v.object({ gpu: num, decoded: num }),
  look: v.object({ family: v.picklist(['toon', 'painterly', 'pbr']), haze: v.object({ colour: v.tuple([num, num, num]), near: num, far: num, max: num }),
    grade: v.optional(v.object({ exposure: num, saturation: num, contrast: num })) }) });
function farLook(row: unknown): FarLookRuntime { return v.parse(FarRow, row).look; }
function farBytes(row: unknown): number { const { far } = v.parse(FarRow, row); return Math.round(far.gpu + far.decoded); }

/** One draw for every strip and crossroads, in the home frame, vertex-coloured (the generator's colours). */
function deckMesh(strips: readonly GeneratedStrip[], home: GridCell): Mesh {
  let vertices = 0, indices = 0;
  for (const strip of strips) { vertices += strip.mesh.positions.length / 3; indices += strip.mesh.indices.length; }
  const position = new Float32Array(vertices * 3), colour = new Float32Array(vertices * 3), index = new Uint32Array(indices);
  let vert = 0, i = 0;
  for (const { mesh } of strips) {
    const dx = mesh.origin.x - home.origin.x, dz = mesh.origin.z - home.origin.z, base = vert;
    for (let k = 0; k < mesh.positions.length; k += 3) {
      position[vert * 3] = (mesh.positions[k] ?? 0) + dx; position[vert * 3 + 1] = mesh.positions[k + 1] ?? 0; position[vert * 3 + 2] = (mesh.positions[k + 2] ?? 0) + dz;
      colour[vert * 3] = mesh.colours[k] ?? 0; colour[vert * 3 + 1] = mesh.colours[k + 1] ?? 0; colour[vert * 3 + 2] = mesh.colours[k + 2] ?? 0;
      vert++;
    }
    for (const n of mesh.indices) index[i++] = n + base;
  }
  const geometry = new BufferGeometry().setAttribute('position', new BufferAttribute(position, 3)).setAttribute('color', new BufferAttribute(colour, 3)).setIndex(new BufferAttribute(index, 1));
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  const mesh = new Mesh(geometry, new MeshLambertMaterial({ vertexColors: true }));
  mesh.name = 'grid-deck'; mesh.receiveShadow = true; mesh.castShadow = false; mesh.matrixAutoUpdate = false; mesh.updateMatrix();
  return mesh;
}

/** A neighbour's four soft walls on the 6 m re-frame line, in the home frame (`ReadinessWalls` edges). */
function neighbourEdges(cell: GridCell, home: GridCell): ReadinessEdge[] {
  const x = cell.origin.x - home.origin.x, z = cell.origin.z - home.origin.z, r = CHUNK_HALF + 6, halfLength = CHUNK_HALF + 6;
  const edge = (ex: number, ez: number, axis: 'x' | 'z'): ReadinessEdge => ({ instance: cell.instance, x: ex, z: ez, axis, halfLength, floor: 0 });
  return [edge(x + r, z, 'x'), edge(x - r, z, 'x'), edge(x, z + r, 'z'), edge(x, z - r, 'z')];
}
/** The closed outer rim, just past the outer strips (the empty neighbour has no sim to wait for). */
function rimEdges(assembly: GridAssembly, home: GridCell): ReadinessEdge[] {
  const xs = assembly.cells.map((c) => c.cell[0]), zs = assembly.cells.map((c) => c.cell[1]), p = assembly.pitch;
  const minX = Math.min(...xs) * p - p / 2, maxX = Math.max(...xs) * p + p / 2, minZ = Math.min(...zs) * p - p / 2, maxZ = Math.max(...zs) * p + p / 2;
  const cx = (minX + maxX) / 2 - home.origin.x, cz = (minZ + maxZ) / 2 - home.origin.z, hx = (maxX - minX) / 2, hz = (maxZ - minZ) / 2;
  return [
    { instance: null, x: minX - home.origin.x, z: cz, axis: 'x', halfLength: hz, floor: 0 }, { instance: null, x: maxX - home.origin.x, z: cz, axis: 'x', halfLength: hz, floor: 0 },
    { instance: null, x: cx, z: minZ - home.origin.z, axis: 'z', halfLength: hx, floor: 0 }, { instance: null, x: cx, z: maxZ - home.origin.z, axis: 'z', halfLength: hx, floor: 0 },
  ];
}

/** The live grid session. Installed only in grid page mode; disposed with the level scope. */
export class GridSession {
  readonly assembly: GridAssembly;
  readonly home: GridCell;
  readonly allocator = new ResidencyAllocator();
  private readonly rings: RenderRings<LevelPrepared<FarPrepared, never>>;
  private readonly neighbours: readonly GridCell[];
  private readonly costs = new Map<string, number>();
  private readonly strips: readonly GeneratedStrip[];
  private readonly host: GridSessionHost;
  private last: { x: number; z: number } | null = null;
  private velocity = { x: 0, z: 0 };
  private readonly frame: GridFrame | null;

  constructor(host: GridSessionHost) {
    this.host = host;
    const instance = pageGridInstance();
    this.assembly = new GridAssembly(gridMode(devserverCellOn()));
    if (instance === null) throw new Error('A grid session needs a grid page');
    this.home = this.assembly.cell(instance);
    const home = this.home, empty = this.assembly.emptyNeighbour.edge;
    this.neighbours = this.assembly.cells.filter((cell) => cell.instance !== home.instance);
    // the deck: one generator run, one draw, the same vertices as the platform colliders
    const cells = this.assembly.cells.map((cell): PlatformCell => ({ instance: cell.instance, cell: cell.cell, origin: { x: cell.origin.x, z: cell.origin.z },
      edges: { north: empty, east: empty, south: empty, west: empty } }));
    this.strips = generatePlatform(cells, empty);
    const deck = deckMesh(this.strips, home);
    // SF19a: one frame for the grid, behind its Debug row (default off; applies at the next grid start)
    host.scope.onDispose(installGridFrameRow());
    const frameHost = host.frame;
    this.frame = frameHost !== undefined && gridOneFrameOn() ? new GridFrame({ host: frameHost, scope: host.scope, home, half: CHUNK_HALF, band: (this.assembly.pitch - 2 * CHUNK_HALF) / 2,
      cells: this.assembly.cells.map((cell) => ({ instance: cell.instance, origin: { x: cell.origin.x, z: cell.origin.z } })) }) : null;
    const frame = this.frame;
    if (frame !== null && frameHost !== undefined) { frame.deck(deck); frameHost.onLate(() => { frame.frame(); }); }
    host.scene.add(deck);
    for (const { mesh } of this.strips) installStripCollider(host.physics, this.rebased(mesh), host.scope);
    new ReadinessWalls(host.physics, [...this.neighbours.flatMap((cell) => neighbourEdges(cell, home)), ...rimEdges(this.assembly, home)], host.scope); // never synced open: no neighbour sim is resident in the page yet
    installGridBorders(host.physics, host.scope); // the home cell's creatures stay home (SF20d)
    // neighbours: the far ring through the one allocator; each cell's root sits at its render origin
    const roots = new Map<string, Group>();
    for (const cell of this.neighbours) {
      const root = new Group(); root.name = `grid-cell:${cell.instance}`; root.position.set(cell.origin.x - home.origin.x, 0, cell.origin.z - home.origin.z);
      root.updateMatrixWorld(); host.scene.add(root); roots.set(cell.instance, root);
    }
    const far = farRingPorts({
      root: (id) => { const root = roots.get(id); if (root === undefined) throw new Error(`No grid cell root ${id}`); return root; },
      load: async (id) => { const { prepared, bytes } = await loadFar(this.assembly.cell(id).slug); this.costs.set(id, bytes); frame?.declare(id, prepared.look); return prepared; },
    });
    const farPorts = frame === null ? far : { ...far, upload: (tile: { instance: string }, data: FarPrepared) => {
      const view = far.upload(tile, data), untag = frame.tag(tile.instance, view, data.look.haze), dispose = view.dispose;
      view.dispose = () => { untag(); dispose(); };
      return view;
    } };
    this.rings = new RenderRings(this.neighbours, this.allocator, (id, level) => (level === 'far' ? this.costs.get(id) ?? 1_600_000 : null), levelPorts<FarPrepared, never>(farPorts, noTiles));
    host.scope.onDispose(() => {
      this.rings.dispose(); deck.removeFromParent(); deck.geometry.dispose();
      const material = deck.material; if (!Array.isArray(material)) material.dispose();
      for (const root of roots.values()) root.removeFromParent();
    });
    host.onFixed((dt) => { this.step(dt); });
    host.scope.onDispose(app.debug.scopedExpose('grid', { state: () => this.state() })); // the harness readout: __wildshard.shard.grid.state()
  }

  private rebased(mesh: StripMesh): StripMesh { return { ...mesh, origin: { x: mesh.origin.x - this.home.origin.x, z: mesh.origin.z - this.home.origin.z } }; }
  /** World feet (grid metres) from the home-frame feet. */
  private world(): { x: number; z: number } { const feet = this.host.feet(); return { x: feet.x + this.home.origin.x, z: feet.z + this.home.origin.z }; }

  /** One fixed step: the rings from the player's world pose and velocity, then the cell events. */
  step(dt: number): void {
    const at = this.world();
    if (this.last !== null && dt > 0) { this.velocity = { x: (at.x - this.last.x) / dt, z: (at.z - this.last.z) / dt }; }
    this.last = at;
    const speed = Math.hypot(this.velocity.x, this.velocity.z), clamp = speed > 60 ? 60 / speed : 1; // a respawn's jump is not a velocity
    this.rings.step({ x: at.x, z: at.z, vx: this.velocity.x * clamp, vz: this.velocity.z * clamp });
    const inside = this.assembly.at(at.x, at.z);
    if (inside?.instance === this.home.instance) gridCells.enter({ instance: this.home.instance, slug: this.home.slug });
    else gridCells.leave();
  }

  /** Hold the loading screen until every visible neighbour is drawn (or the time limit: the soft walls hold anyway). */
  async ready(limitMs = 20_000): Promise<boolean> {
    for (let waited = 0; ; waited += 16) {
      this.step(1 / 60);
      if (this.rings.ready()) return true;
      if (waited > limitMs) return false;
      await new Promise<void>((resolve) => { this.host.scope.timeout(16, resolve); });
    }
  }

  /** The readout: what each cell shows, the rings and the allocator. */
  state(): GridSessionState {
    const stats = this.rings.stats(), resident = new Set(this.rings.resident().map((key) => key.split(':')[0]));
    const at = this.world(), cost = this.allocator.cost();
    return {
      home: this.home.instance, inside: gridCells.cell?.instance ?? null, feet: { x: Math.round(at.x * 100) / 100, z: Math.round(at.z * 100) / 100 },
      cells: this.assembly.cells.map((cell) => ({ instance: cell.instance, slug: cell.slug, cell: cell.cell,
        shows: cell.instance === this.home.instance ? 'playing' : resident.has(cell.instance) ? 'far proxy' : 'loading' })),
      strips: this.strips.length, ringsReady: this.rings.ready(),
      residentMB: Math.round(cost.accounted / 1e4) / 100, playingMB: Math.round(cost.playing / 1e4) / 100,
      rings: { far: stats.resident.far, l1: stats.resident.l1, l0: stats.resident.l0, refused: stats.refused },
      frame: this.frame?.state() ?? null,
    };
  }
}
