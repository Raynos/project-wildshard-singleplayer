import * as THREE from 'three';
import { gpuOnlyTexture } from '@wildshard/engine/core/gpuOnly';
import { TIER_CONFIG } from '@wildshard/engine/core/tier';
import { memorySaverOn } from '@wildshard/engine/render/memorySaver';
import type { Forest } from '@wildshard/engine/world/forest/Forest';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { pineMappedLook, setPineLookParam } from './graphLooks';

/**
 * A forest floor's ground cover as rows (SHARD-PLATFORM M3): authored undergrowth placements (ferns, shrubs, litter,
 * stones, moss and reeds) drawn in SF59
 * material graphs (data/undergrowthLook.ts: the distance fade, the wind, the foliage light, the cut shadow) that each
 * kind wears over its own painted texture. The shard gives each kind's look as data (its wind, alpha cut, roughness,
 * whether it lies flat or casts a shadow), its shapes and its texture painters (a canvas each).
 *
 *   const cover = new GroundCover({ sky, forest, look, shapes, paint }).build();   // or buildAsync(pause)
 *   cover.update(dt, playerPos);   // feeds the graph the viewer and the sun
 *
 * Kinds that name the same graph share its lit program: a kind's wind is the `aWind` its geometry carries; its alpha
 * cut, roughness and depth bias are its material's own. Each graph's params are one set, shared by every field of it.
 */

/** Retained per-instance facts; matrices and tints still use the existing instanced draw. */
export interface Placement { x: number; y: number; z: number; nx: number; ny: number; nz: number; rot: number; scale: number; r: number; g: number; b: number }
export type UnderPlacements = Record<'ferns' | 'shrubs' | 'litter' | 'stones' | 'moss' | 'reeds', Placement[]>;

/** A ground-cover kind (the engine placement's kinds). */
export type GroundCoverKind = keyof UnderPlacements;

/** One kind's look as data. */
export interface GroundCoverKindRow {
  /** the material's name is `<namePrefix><key>` */
  readonly key: string;
  /** the look.materials id of the graph it wears */
  readonly graph: string;
  readonly wind: number;
  readonly alphaTest: number;
  /** the material's roughness when not the default */
  readonly roughness?: number;
  /** a flat ground layer: pulled toward the camera so the terrain never swallows it */
  readonly flat?: boolean;
  /** casts a shadow where the tier casts the ground cover's */
  readonly shadow: boolean;
}

/** The field's look as data: the material names' prefix, and the kinds in build order. */
export interface GroundCoverLook {
  readonly namePrefix: string;
  /** the kinds in the order their materials are made (that order is the draw sort's) */
  readonly kinds: readonly (readonly [GroundCoverKind, GroundCoverKindRow])[];
}

/** One kind's geometry as data: positions, normals, uvs, the index. */
export type GroundCoverShape = THREE.BufferGeometry;

/** A kind's material: the graph worn over the kind's texture (its map, alpha cut and roughness are its own). */
export type GroundCoverMaterial = THREE.Material & { map: THREE.Texture | null; roughness: number };

/** One kind as the field draws it: its geometry, its material (its shadow is the graph's own depth pass). */
export interface GroundCoverDraw {
  readonly geometry: THREE.BufferGeometry;
  readonly material: GroundCoverMaterial;
  readonly castShadow: boolean;
  readonly customDepthMaterial?: THREE.Material;
}

/** What a field is built from. */
export interface GroundCoverOptions {
  sky: Sky;
  forest: Forest;
  placements: UnderPlacements;
  look: GroundCoverLook;
  shapes: Readonly<Record<GroundCoverKind, GroundCoverShape>>;
  /** each kind's texture, painted on a canvas */
  paint: Readonly<Record<GroundCoverKind, () => HTMLCanvasElement>>;
}

/** how a field's copies are culled: 32 m cells, a copy reaches 2.5 m, gone 2 m past the tier's fade (read when asked: this
 *  module loads before the tier is known) */
export function groundCoverCells(): { readonly size: 32; readonly pad: 2.5; readonly far: number } {
  return { size: 32, pad: 2.5, far: TIER_CONFIG.undergrowthFar + 2 };
}

const UP = new THREE.Vector3(0, 1, 0);
/** the most graphs a field wears (one per kind) */
const GRAPHS_MAX = 6;

/** A forest floor's ground cover (see the module's comment). */
export class GroundCover {
  /** the kinds' placed meshes go in it */
  group = new THREE.Group();
  /** each kind's parts: its model draws them */
  kinds!: Readonly<Record<GroundCoverKind, GroundCoverDraw>>;
  /** how many copies of each kind */
  counts = { ferns: 0, shrubs: 0, litter: 0, stones: 0, moss: 0, reeds: 0 };
  /** where every copy of every kind stands */
  layout: UnderPlacements = { ferns: [], shrubs: [], litter: [], stones: [], moss: [], reeds: [] };
  private readonly viewer = new THREE.Vector3();
  private readonly v3 = [0, 0, 0];
  /** the graphs the kinds wear, each once */
  private readonly graphs: readonly string[];

  /** `o`: the sky, the forest, the look as data, the shapes and the painters. */
  constructor(private readonly o: GroundCoverOptions) { this.graphs = [...new Set(o.look.kinds.map(([, row]) => row.graph))]; }

  /** the view the copies are culled from: the forest's padded frustum, refilled when it moves or turns */
  get view(): Forest { return this.o.forest; }

  /** Every stage in one go. */
  build(): this {
    const g = this.stages();
    while (g.next().done !== true) { /* every stage in one go */ }
    return this;
  }

  /**
   * `build()` with the event loop let in between its stages (`pause`, e.g. a macrotask): the textures, then
   * each kind's placement pass. Same rolls, same placements.
   */
  async buildAsync(pause: () => Promise<void>): Promise<this> {
    const g = this.stages();
    while (g.next().done !== true) await pause();
    return this;
  }

  private *stages(): Generator<void, void, undefined> {
    const far = TIER_CONFIG.undergrowthFar, fade = [far, Math.min(25, far * 0.3)]; // the tier's, read at the build
    this.graphs.forEach((id) => { setPineLookParam(id, 'fade', fade); });
    const made = new Map(this.o.look.kinds.map(([kind, row]) => [kind, { mat: this.makeMaterial(canvasTexture(this.o.paint[kind]()), row), row }]));
    yield;

    const place = this.o.placements;
    this.layout = place;
    const draw = (kind: GroundCoverKind): GroundCoverDraw => {
      const m = made.get(kind);
      if (m === undefined) throw new Error(`[ground cover] no look for ${kind}`);
      const geometry = this.o.shapes[kind];
      // the kind's wind on every vertex: a shared program sways each kind by its own
      geometry.setAttribute('aWind', new THREE.BufferAttribute(new Float32Array(geometry.getAttribute('position').count).fill(m.row.wind), 1));
      return { geometry, material: m.mat, castShadow: m.row.shadow && TIER_CONFIG.undergrowthShadows };
    };
    this.kinds = { ferns: draw('ferns'), shrubs: draw('shrubs'), litter: draw('litter'), stones: draw('stones'), moss: draw('moss'), reeds: draw('reeds') };
    this.counts = { ferns: place.ferns.length, shrubs: place.shrubs.length, litter: place.litter.length, stones: place.stones.length, moss: place.moss.length, reeds: place.reeds.length };
  }

  /** `playerPos` in the floor's own frame; the fade compares world positions, so it goes out through the group's world
   *  matrix, whose offset (`shift`) carries each copy's origin out too. The sun's direction and colour are the sky's, moved by the day clock. */
  update(_dt: number, playerPos: THREE.Vector3): void {
    const sky = this.o.sky, frame = this.group.matrixWorld.elements, at = this.viewer.copy(playerPos).applyMatrix4(this.group.matrixWorld);
    for (let i = 0; i < GRAPHS_MAX; i++) {
      const id = this.graphs[i];
      if (id === undefined) break;
      setPineLookParam(id, 'viewer', this.xyz(at.x, at.y, at.z));
      setPineLookParam(id, 'shift', this.xyz(frame[12], frame[13], frame[14]));
      setPineLookParam(id, 'sunDir', this.xyz(sky.sunDir.x, sky.sunDir.y, sky.sunDir.z));
      setPineLookParam(id, 'sunTint', this.xyz(sky.sunColor.r, sky.sunColor.g, sky.sunColor.b));
    }
  }

  /** the one reused vec3 a param is set from (the setter copies it) */
  private xyz(x: number, y: number, z: number): readonly number[] {
    const v = this.v3; v[0] = x; v[1] = y; v[2] = z; return v;
  }

  /** the graph worn over a kind's texture, with the kind's own cut, roughness and depth bias; throws when the graph did
   *  not compile (no silent fallback to another look) */
  private makeMaterial(tex: THREE.Texture, row: GroundCoverKindRow): GroundCoverMaterial {
    const mat = pineMappedLook(row.graph, tex);
    if (!isCoverMaterial(mat) || mat.map !== tex) throw new Error(`[ground cover] ${row.graph} is not a compiled mapped graph`);
    mat.name = `${this.o.look.namePrefix}${row.key}`;
    mat.alphaTest = row.alphaTest;
    mat.roughness = row.roughness ?? 0.8;
    // flat ground layers: pull towards the camera so the terrain mesh (±5 cm off heightAt) never swallows them
    if (row.flat === true) { mat.polygonOffset = true; mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -2; }
    return mat;
  }
}

/** a lit graph's material: a colour map slot and a roughness */
function isCoverMaterial(m: THREE.Material): m is GroundCoverMaterial {
  const map: unknown = Reflect.get(m, 'map');
  return (map === null || map instanceof THREE.Texture) && typeof Reflect.get(m, 'roughness') === 'number';
}

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _n = new THREE.Vector3();

/** a copy's transform: tilted to the ground's normal, turned about it, scaled */
export function groundCoverMatrix(it: Placement, target = new THREE.Matrix4()): THREE.Matrix4 {
  _n.set(it.nx, it.ny, it.nz);
  _q2.setFromUnitVectors(UP, _n);
  _q.setFromAxisAngle(UP, it.rot).premultiply(_q2);
  return target.compose(_p.set(it.x, it.y, it.z), _q, _s.set(it.scale, it.scale, it.scale));
}

function canvasTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  // Per-build immutable pixels; the lit and shadow-depth passes share this exact texture, with no CPU readers.
  if (memorySaverOn()) gpuOnlyTexture(tex, 'undergrowth/canvas');
  return tex;
}
