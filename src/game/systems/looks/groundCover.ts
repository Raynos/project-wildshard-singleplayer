import * as THREE from 'three';
import { gpuOnlyTexture } from '@wildshard/engine/core/gpuOnly';
import { TIER_CONFIG } from '@wildshard/engine/core/tier';
import { memorySaverOn } from '@wildshard/engine/render/memorySaver';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { attachFogUniforms } from '@wildshard/engine/world/Atmosphere';
import { bakedUndergrowth } from '@wildshard/engine/world/BakedTerrain';
import type { Forest } from '@wildshard/engine/world/forest/Forest';
import { DecisionLog, placeUndergrowth, placementChecksum, sameChecksum, type Placement, type UnderPlacements } from '@wildshard/engine/world/forest/placement';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { windUniforms } from '@wildshard/engine/world/TreeFactory';
import { patchWindField } from '@wildshard/engine/world/wind';
import { editShader, type ShaderEditRow, type ShaderStages } from './shaderEdits';

/**
 * A forest floor's ground cover as rows (SHARD-PLATFORM M3): the engine's undergrowth placement (ferns, shrubs, litter,
 * stones, moss, reeds: `placeUndergrowth`, replayed from the terrain bake's decision log when it fits) drawn with one
 * standard-material program for every kind — a distance fade (scale to 0 past `fadeFar`), a gentle wind, the shard's own
 * lit edits — and one shadow-depth program. The shard gives each kind's look as data (its wind, alpha test, roughness,
 * whether it lies flat or casts a shadow), its shapes, its texture painters (a canvas each) and its edit rows.
 *
 *   const cover = new GroundCover({ sky, forest, look, shapes, paint, edits }).build();   // or buildAsync(pause)
 *   cover.update(dt, playerPos);   // only feeds the viewer position uniform
 *
 * Every kind shares ONE lit program (its wind is a uniform; the patch's `key` names the material) and one depth program.
 * The uniforms are one set per patch id, shared by every field of that look.
 */

/** A ground-cover kind (the engine placement's kinds). */
export type GroundCoverKind = keyof UnderPlacements;

/** One kind's look as data. */
export interface GroundCoverKindRow {
  /** the material's name is `<namePrefix><key>` */
  readonly key: string;
  readonly wind: number;
  readonly alphaTest: number;
  /** the material's roughness when not the default */
  readonly roughness?: number;
  /** a flat ground layer: pulled toward the camera so the terrain never swallows it */
  readonly flat?: boolean;
  /** casts a shadow where the tier casts the ground cover's */
  readonly shadow: boolean;
}

/** The field's look as data: patch ids and program keys, the material names' prefix, and the kinds in build order. */
export interface GroundCoverLook {
  readonly patch: { readonly lit: string; readonly depth: string };
  readonly keys: { readonly lit: string; readonly depth: string };
  readonly namePrefix: string;
  /** the kinds in the order their materials are made (that order is the draw sort's) */
  readonly kinds: readonly (readonly [GroundCoverKind, GroundCoverKindRow])[];
}

/** One kind's geometry as data: positions, normals, uvs, the index. */
export interface GroundCoverShape { position: number[]; normal: number[]; uv: number[]; index: number[] }

/** One kind as the field draws it: its geometry, its material (and its shadow's). */
export interface GroundCoverDraw {
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.MeshStandardMaterial;
  readonly castShadow: boolean;
  readonly customDepthMaterial?: THREE.Material;
}

/** What a field is built from. */
export interface GroundCoverOptions {
  sky: Sky;
  forest: Forest;
  look: GroundCoverLook;
  shapes: Readonly<Record<GroundCoverKind, GroundCoverShape>>;
  /** each kind's texture, painted on a canvas */
  paint: Readonly<Record<GroundCoverKind, () => HTMLCanvasElement>>;
  /** the lit edits (after the vertex ones) and the vertex edits (lit and depth) */
  edits: { readonly lit: readonly ShaderEditRow[]; readonly vertex: readonly ShaderEditRow[] };
}

/** how a field's copies are culled: 32 m cells, a copy reaches 2.5 m, gone 2 m past the tier's fade (read when asked: this
 *  module loads before the tier is known) */
export function groundCoverCells(): { readonly size: 32; readonly pad: 2.5; readonly far: number } {
  return { size: 32, pad: 2.5, far: TIER_CONFIG.undergrowthFar + 2 };
}

interface CoverUniforms {
  uFadeFar: { value: number }; uFadeBand: { value: number }; uSunDir: { value: THREE.Vector3 }; uSunColor: { value: THREE.Color };
  /** the player's camera (shadow passes see the light's cameraPosition) */
  uViewerPos: { value: THREE.Vector3 };
}
const families = new Map<string, CoverUniforms>();
function uniformsOf(id: string): CoverUniforms {
  let u = families.get(id);
  if (u === undefined) {
    const far = TIER_CONFIG.undergrowthFar; // the tier's, read at the first field's build
    u = { uFadeFar: { value: far }, uFadeBand: { value: Math.min(25, far * 0.3) }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color(1, 0.93, 0.8) }, uViewerPos: { value: new THREE.Vector3() } };
    families.set(id, u);
  }
  return u;
}

const UP = new THREE.Vector3(0, 1, 0);

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
  private readonly u: CoverUniforms;

  /** `o`: the sky, the forest, the look as data, the shapes, the painters and the edit rows. */
  constructor(private readonly o: GroundCoverOptions) { this.u = uniformsOf(o.look.patch.lit); }

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
    // the sky's own objects (not copies): the day / night clock moves the sun by mutating them in place
    this.u.uSunDir.value = this.o.sky.sunDir;
    this.u.uSunColor.value = this.o.sky.sunColor;
    const made = new Map<GroundCoverKind, { tex: THREE.Texture; mat: THREE.MeshStandardMaterial; row: GroundCoverKindRow }>();
    for (const [kind, row] of this.o.look.kinds) {
      const tex = canvasTexture(this.o.paint[kind]());
      const mat = this.makeMaterial(tex, row.key, row.wind, row.alphaTest);
      if (row.roughness !== undefined) mat.roughness = row.roughness;
      // flat ground layers: pull towards the camera so the terrain mesh (±5 cm off heightAt) never swallows them
      if (row.flat === true) { mat.polygonOffset = true; mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -2; }
      made.set(kind, { tex, mat, row });
    }
    yield;

    const place = yield* this.placements();
    this.layout = place;
    const draw = (kind: GroundCoverKind): GroundCoverDraw => {
      const m = made.get(kind);
      if (m === undefined) throw new Error(`[ground cover] no look for ${kind}`);
      return this.kindDraw(toGeometry(this.o.shapes[kind]), m.mat, m.row.shadow, m.tex, m.row.wind);
    };
    this.kinds = { ferns: draw('ferns'), shrubs: draw('shrubs'), litter: draw('litter'), stones: draw('stones'), moss: draw('moss'), reeds: draw('reeds') };
    this.counts = { ferns: place.ferns.length, shrubs: place.shrubs.length, litter: place.litter.length, stones: place.stones.length, moss: place.moss.length, reeds: place.reeds.length };
  }

  /**
   * Where everything goes (the engine's forest placement): the build's decision log replayed when the chunk's
   * terrain bake carries one that fits this build — no candidate tested at launch — else the tests run.
   */
  private *placements(): Generator<void, UnderPlacements, undefined> {
    const baked = bakedUndergrowth();
    const forest = this.o.forest;
    if (baked) {
      try {
        const p = yield* placeUndergrowth(forest.trees, forest, DecisionLog.replay(baked.bits, baked.length));
        if (sameChecksum(placementChecksum(p), baked.checksum)) return p;
        console.warn('[baked] undergrowth decision log does not fit this build; placing at launch');
      } catch (e) { console.warn(`[baked] undergrowth decision log not used (${(e as Error).message}); placing at launch`); }
    }
    return yield* placeUndergrowth(forest.trees, forest, DecisionLog.record());
  }

  /** `playerPos` in the floor's own frame; the fade compares world positions, so it goes out through the group's world matrix */
  update(_dt: number, playerPos: THREE.Vector3): void { this.u.uViewerPos.value.copy(playerPos).applyMatrix4(this.group.matrixWorld); }

  private makeMaterial(tex: THREE.Texture, key: string, wind: number, alphaTest: number): THREE.MeshStandardMaterial {
    const look = this.o.look;
    const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest, side: THREE.DoubleSide, roughness: 0.8, metalness: 0 });
    mat.name = `${look.namePrefix}${key}`;
    patchShader(mat, look.patch.lit, PATCH_ORDER.material, (shader) => {
      attachFogUniforms(shader);
      Object.assign(shader.uniforms, this.u);
      this.patchVertex(shader, wind);
      editShader(shader, this.o.edits.lit);
    }, { mode: 'replace', key: look.keys.lit }); // `key` names the material; wind is a uniform, so every kind shares ONE program
    this.o.sky.setupMaterial(mat);
    return mat;
  }

  /** a kind's parts: its geometry and material, and — where the tier casts its shadow — the alpha-tested shadow material */
  private kindDraw(geometry: THREE.BufferGeometry, material: THREE.MeshStandardMaterial, shadow: boolean, tex: THREE.Texture, wind: number): GroundCoverDraw {
    const castShadow = shadow && TIER_CONFIG.undergrowthShadows;
    if (!castShadow) return { geometry, material, castShadow };
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
    patchShader(depth, this.o.look.patch.depth, PATCH_ORDER.material, (shader) => { this.patchVertex(shader, wind); }, { mode: 'replace', key: this.o.look.keys.depth }); // wind is a uniform: one depth program for every kind
    return { geometry, material, castShadow, customDepthMaterial: depth };
  }

  /** Distance fade (scale to 0) + gentle wind, shared by the lit and the shadow-depth materials. */
  private patchVertex(shader: ShaderStages & { uniforms: Record<string, THREE.IUniform> }, wind: number): void {
    shader.uniforms['uWindScale'] = { value: wind }; // per material, not baked into the source: the program is shared
    patchWindField(shader); // the shared clock + gust front
    shader.uniforms['uWindStrength'] = windUniforms.uWindStrength;
    shader.uniforms['uFadeFar'] = this.u.uFadeFar;
    shader.uniforms['uFadeBand'] = this.u.uFadeBand;
    shader.uniforms['uViewerPos'] = this.u.uViewerPos;
    editShader(shader, this.o.edits.vertex);
  }
}

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _n = new THREE.Vector3();

/** a copy's transform: tilted to the ground's normal, turned about it, scaled */
export function groundCoverMatrix(it: Placement, target = new THREE.Matrix4()): THREE.Matrix4 {
  _n.set(it.nx, it.ny, it.nz);
  _q2.setFromUnitVectors(UP, _n);
  _q.setFromAxisAngle(UP, it.rot).premultiply(_q2);
  return target.compose(_p.set(it.x, it.y, it.z), _q, _s.set(it.scale, it.scale, it.scale));
}

function toGeometry({ position: verts, normal: norms, uv: uvs, index: idx }: GroundCoverShape): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}

function canvasTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  // Per-build immutable pixels; lit and depth materials share this exact texture, with no CPU readers.
  if (memorySaverOn()) gpuOnlyTexture(tex, 'undergrowth/canvas');
  return tex;
}
