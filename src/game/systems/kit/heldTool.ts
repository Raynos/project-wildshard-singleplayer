import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { isMesh, viewmodelMaterial, whiteColors } from '@wildshard/engine/combat/view/ranged';
import type { Game } from '@wildshard/engine/core/Game';
import type { ModelContext } from '@wildshard/engine/models/model';
import type { SkyRig } from '@wildshard/engine/world/skyRig';
import type { ShardContext } from '../../shard/context';
import { paintedPrimitives, type PaintedPrimitiveRow } from './mergedPrimitives';

/**
 * A first-person tool held through a timed beat (SHARD-PLATFORM M3, the kit system): a gloved hand holding a knife, a
 * brush, a trowel, at the lower right of the view on the viewmodels' shared lit program (no program of its own). Its look
 * is one GLB (one mesh, one baked atlas: albedo / normal / ARM), fetched once the level has loaded, with a vertex-coloured
 * stand-in of primitive rows until it lands (or when it fails). Through the beat it rises into view as the beat starts,
 * makes one stroke per cut (a short wind-up and a fast draw that lands on the cut) and drops out of view from the rise.
 * Every number is the shard's row; the Model Explorer's specimen is `heldToolSpecimen`.
 */

type Xyz = readonly [number, number, number];

/** A beat's clock (seconds): its length, the rise-in, the cuts, and where it starts to drop out. */
export interface HeldToolBeat { readonly len: number; readonly kneelIn: number; readonly cuts: readonly number[]; readonly rise: number }

/** One stroke's direction and wrist turn while drawing (camera space; the turns about y and z, radians). */
export interface HeldToolStroke { readonly dir: Xyz; readonly turn: readonly [y: number, z: number] }

/** A held tool's look and motion (a shard's data row). */
export interface HeldToolRow {
  /** its object's and material's name, and its GLB */
  readonly name: string;
  readonly url: string;
  /** the stand-in's roughness and metalness (one set over every part), the file's environment intensity and its atlas's
   *  anisotropy; ms after the level loads before the fetch (its shard's schedule reads it); its render order */
  readonly standIn: { readonly roughness: number; readonly metalness: number };
  readonly envMapIntensity: number;
  readonly anisotropy: number;
  readonly loadDelayMs: number;
  readonly renderOrder: number;
  /** the hold (camera space), its turn (YXZ), where it comes from and goes to, and the extra tip-up while away */
  readonly hold: Xyz;
  readonly holdRot: Xyz;
  readonly low: Xyz;
  readonly lowTilt: number;
  /** portrait: k = min(1, (1 − aspect) × gain) pulls the hold in by (x, y) × k */
  readonly portrait: { readonly gain: number; readonly x: number; readonly y: number };
  /**
   * The strokes: each starts `lead` s before its cut and lasts `span`; the wind-up rises over `windIn`, falls from
   * `windOut` over `windFall` and moves the hand by `windMove` and tips it by `windTilt`; the draw rises from `drawAt` over
   * `drawIn`, falls from `drawOut` over `drawFall` and tips it by `drawTilt`, moving it along its cut's row (the last row
   * for any later cut).
   */
  readonly stroke: {
    readonly lead: number; readonly span: number;
    readonly windIn: number; readonly windOut: number; readonly windFall: number; readonly windMove: Xyz; readonly windTilt: number;
    readonly drawAt: number; readonly drawIn: number; readonly drawOut: number; readonly drawFall: number; readonly drawTilt: number;
    readonly cuts: readonly HeldToolStroke[];
  };
  /** the stand-in: painted primitive rows in the GLB's model space */
  readonly parts: readonly PaintedPrimitiveRow[];
}

/** A held tool's file: its one mesh as plain float geometry and its atlas (albedo, normal, ARM). */
export interface HeldToolFile { geo: THREE.BufferGeometry; tex: { map: THREE.Texture; normalMap: THREE.Texture; arm: THREE.Texture } }

const ease = (x: number): number => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

/** The tool's GLB scene's first mesh as plain float geometry (position, normal, uv; its index kept) and its atlas. */
export function parseHeldToolFile(root: THREE.Object3D, row: Pick<HeldToolRow, 'name' | 'url' | 'anisotropy'>): HeldToolFile {
  root.updateMatrixWorld(true);
  const found: THREE.Mesh[] = [];
  root.traverse((o) => { if (isMesh(o)) found.push(o); });
  const mesh = found[0];
  if (mesh === undefined) throw new Error(`[${row.name}] ${row.url} has no mesh`);
  const src = mesh.geometry, g = new THREE.BufferGeometry();
  const copy = (name: string, size: number): Float32Array => {
    const a = src.getAttribute(name) as THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined;
    if (!a) throw new Error(`[${row.name}] no ${name}`);
    const out = new Float32Array(a.count * size);
    for (let i = 0; i < a.count; i++) { out[i * size] = a.getX(i); out[i * size + 1] = a.getY(i); if (size > 2) out[i * size + 2] = a.getZ(i); }
    return out;
  };
  g.setAttribute('position', new THREE.BufferAttribute(copy('position', 3), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(copy('normal', 3), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(copy('uv', 2), 2));
  const idx = src.getIndex();
  if (idx) g.setIndex(new THREE.BufferAttribute(Uint32Array.from(idx.array), 1));
  g.applyMatrix4(mesh.matrixWorld);
  g.computeBoundingSphere();
  const m = mesh.material;
  if (Array.isArray(m) || !(m instanceof THREE.MeshStandardMaterial)) throw new Error(`[${row.name}] not a PBR material`);
  const { map, normalMap, roughnessMap } = m;
  if (map === null || normalMap === null || roughnessMap === null) throw new Error(`[${row.name}] an atlas map is missing`);
  for (const t of [map, normalMap, roughnessMap]) t.anisotropy = row.anisotropy;
  return { geo: g, tex: { map, normalMap, arm: roughnessMap } };
}

/** Fetch and parse the tool's GLB (meshopt-decoded). */
export async function loadHeldToolFile(row: Pick<HeldToolRow, 'name' | 'url' | 'anisotropy'>): Promise<HeldToolFile> {
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(row.url);
  return parseHeldToolFile(gltf.scene, row);
}

/** the atlas on a viewmodel material: albedo, normal (glTF's v runs down the image) and ARM, full factors */
function dressAtlas(m: THREE.MeshPhysicalMaterial, tex: HeldToolFile['tex'], envMapIntensity: number): void {
  m.map = tex.map; m.normalMap = tex.normalMap; m.aoMap = tex.arm; m.roughnessMap = tex.arm; m.metalnessMap = tex.arm;
  m.normalScale.set(1, -1); // glTF's v runs down the image (three's GLTFLoader flips the green the same way)
  m.roughness = 1; m.metalness = 1; m.envMapIntensity = envMapIntensity;
}

/** A first-person tool held through its beat (see the module comment): parented to the camera, hidden until `update`. */
export class HeldTool {
  readonly group = new THREE.Group();
  private readonly pivot = new THREE.Group();
  private mesh: THREE.Mesh | null = null;
  private readonly mat: THREE.MeshPhysicalMaterial;
  private readonly game: Game;
  private readonly ctx: ShardContext;
  private readonly row: HeldToolRow;
  private readonly beat: HeldToolBeat;
  private readonly holdRot: THREE.Euler;

  /** `row` its look and motion, `beat` the clock `update` reads; `schedule` is handed the file's fetch to start when the
   *  shard is ready (after its boot, off the load's requests and bytes) */
  constructor(game: Game, sky: SkyRig, ctx: ShardContext, row: HeldToolRow, beat: HeldToolBeat, schedule: (fetch: () => void) => void) {
    this.game = game; this.ctx = ctx; this.row = row; this.beat = beat;
    this.holdRot = new THREE.Euler(row.holdRot[0], row.holdRot[1], row.holdRot[2], 'YXZ');
    this.mat = viewmodelMaterial(sky, row.name, { roughness: row.standIn.roughness, metalness: row.standIn.metalness });
    this.group.name = row.name;
    this.group.add(this.pivot);
    // no depth clear (the weapons' viewmodels have one): the tool works close and a clear washed the view in the haze
    this.group.visible = false;
    game.camera.add(this.group);
    this.use(paintedPrimitives(row.parts), null);
    // the stand-in holds until the file lands
    schedule(() => { void this.load(); });
    ctx.scope.onDispose(() => { this.group.removeFromParent(); this.mesh?.geometry.dispose(); this.mat.dispose(); });
  }

  private async load(): Promise<void> {
    try {
      const m = await loadHeldToolFile(this.row);
      if (this.ctx.scope.disposed) { m.geo.dispose(); for (const t of Object.values(m.tex)) t.dispose(); return; }
      this.use(m.geo, m.tex);
    } catch (e: unknown) { console.warn(`[${this.row.name}] the model did not load — the stand-in stays:`, e); }
  }

  private use(geo: THREE.BufferGeometry, tex: HeldToolFile['tex'] | null): void {
    whiteColors(geo);
    const m = this.mat;
    if (tex) {
      dressAtlas(m, tex, this.row.envMapIntensity);
      // upload now, not on the first harvest
      for (const t of [tex.map, tex.normalMap, tex.arm]) this.game.renderer.initTexture(t);
    } else { m.roughness = this.row.standIn.roughness; m.metalness = this.row.standIn.metalness; } // one set of factors over every part
    const old = this.mesh;
    const mesh = new THREE.Mesh(geo, m);
    mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = true; mesh.renderOrder = this.row.renderOrder;
    m.transparent = true; m.depthWrite = true;
    this.pivot.add(mesh);
    this.mesh = mesh;
    if (old) { old.removeFromParent(); old.geometry.dispose(); }
  }

  /** the beat's clock (−1 = none): place the hand for it */
  update(t: number): void {
    const B = this.beat, R = this.row, S = R.stroke;
    if (t < 0 || t >= B.len) { this.group.visible = false; return; }
    this.group.visible = true;
    const cam = this.game.camera;
    const port = cam.aspect < 1 ? Math.min(1, (1 - cam.aspect) * R.portrait.gain) : 0; // portrait: the frame is narrow — pull it in
    const up = ease(t / B.kneelIn) * (1 - ease((t - B.rise) / (B.len - B.rise)));
    const p = this.pivot.position.set(R.low[0], R.low[1], R.low[2]).lerp(new THREE.Vector3(R.hold[0], R.hold[1], R.hold[2]), up);
    p.x += port * R.portrait.x; p.y += port * R.portrait.y;
    const r = this.pivot.rotation; r.copy(this.holdRot);
    r.x += (1 - up) * R.lowTilt;
    for (let i = 0; i < B.cuts.length; i++) {
      const cut = B.cuts[i], row = S.cuts[Math.min(i, S.cuts.length - 1)];
      if (cut === undefined || row === undefined) continue;
      const s = t - (cut - S.lead);
      if (s < 0 || s > S.span) continue;
      const wind = ease(s / S.windIn) * (1 - ease((s - S.windOut) / S.windFall));
      const draw = ease((s - S.drawAt) / S.drawIn) * (1 - ease((s - S.drawOut) / S.drawFall));
      const dir = row.dir;
      p.x += S.windMove[0] * wind + dir[0] * draw; p.y += S.windMove[1] * wind + dir[1] * draw; p.z += S.windMove[2] * wind + dir[2] * draw;
      // a wrist flick, not an arm swing: small turns about the grip
      r.x += S.windTilt * wind + S.drawTilt * draw; r.y += row.turn[0] * draw; r.z += row.turn[1] * draw;
    }
  }
}

/**
 * The Model Explorer's specimen: the stand-in at once, then the file from its own load (parsed once per shard under
 * `onceKey`), each on its own copy of the viewmodel material dressed as the held one but opaque, in the normal queue.
 */
export function heldToolSpecimen(ctx: ModelContext, id: string, row: HeldToolRow, onceKey: string): THREE.Group {
  const holder = new THREE.Group();
  const show = (geo: THREE.BufferGeometry, tex: HeldToolFile['tex'] | null): void => {
    whiteColors(geo);
    const m = viewmodelMaterial(ctx.sky, row.name, { roughness: row.standIn.roughness, metalness: row.standIn.metalness }); // the stand-in's factors
    if (tex) dressAtlas(m, tex, row.envMapIntensity);
    const mesh = new THREE.Mesh(geo, m);
    mesh.castShadow = true; mesh.receiveShadow = true;
    holder.clear();
    holder.add(mesh);
  };
  show(paintedPrimitives(row.parts), null);
  const file = ctx.once(onceKey, (): Promise<HeldToolFile> => loadHeldToolFile(row));
  void (async (): Promise<void> => {
    try {
      const k = await file;
      show(k.geo, k.tex);
      if ('document' in globalThis) document.dispatchEvent(new CustomEvent('ws:model-ready', { detail: { id } }));
    } catch (e: unknown) { console.warn(`[${row.name}] Model Explorer: the model did not load — the stand-in stays:`, e); }
  })();
  return holder;
}
