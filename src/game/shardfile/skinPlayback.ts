/**
 * Exported skins in the client (SHARD-PLATFORM SF9c, the playback half). The export half (`@wildshard/sdk/bake/export`)
 * turns a procedural creature or person into a self-contained GLB (geometry, joint order, weights, inverse binds, sampled
 * clips) plus a rig row (`skins.json`); its textures are separate KTX2 files. Here the client admits those bytes with the
 * shared GLB parser, loads them with three's GLTFLoader, checks them against the row with the engine's `bindRig` and plays
 * the named clips through the engine's `AnimMachine` (one AnimationMixer). The surface is a material the caller compiled
 * from the binding's family entry (SF10a: `familyMaterial`, the loader's `clientMaterials`), never an engine look id.
 *
 *   const skin = await loadSkin(bytes, row, binding, material);   // admitted, bound, posed at the clip's first frame
 *   skin.play('walk'); skin.update(dt);                            // per frame, as the engine's rigs do
 */
import * as v from 'valibot';
import type { Material, Object3D, SkinnedMesh } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { bindRig, type ClipName, type RigInstance } from '@wildshard/engine/anim/rig';
import { AnimMachine } from '@wildshard/engine/anim/machine';
import type { Scope } from '@wildshard/engine/app/scope';
import { parseGlb, type AssetCost } from './assets';
import { SkinPoseLayerSchema, validateSkinLayers, skinLayerDecoded } from './skinLayers';
import { skinPoseLayers } from './skinLayerPlayback';

const id = v.pipe(v.string(), v.regex(/^[a-z][a-z0-9.-]*$/u), v.maxLength(128));
const hash = v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/u));
const clip = v.pipe(v.string(), v.regex(/^(idle|walk|run|attack|hit|die|turn|swim|fly)(\.[a-z][a-z0-9-]*)?$/u), v.transform((name) => name as ClipName));
const joint = v.pipe(v.string(), v.regex(/^[A-Za-z][A-Za-z0-9_.-]*$/u), v.maxLength(64));
const bytes = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(25_000_000));

/** One exported skin as the export half writes it (`public/assets/baked/<shard>/skins.json`): the GLB's content hash and its rig. */
export const SkinRowSchema = v.object({
  id, file: hash, family: v.picklist(['toon', 'pbr']),
  rig: v.strictObject({ skeleton: v.pipe(v.string(), v.regex(/^[a-z][A-Za-z0-9.]*$/u), v.maxLength(128)), joints: v.pipe(v.array(v.pipe(v.array(joint), v.minLength(1), v.maxLength(128))), v.length(1)), clips: v.pipe(v.array(clip), v.minLength(1), v.maxLength(32)), sockets: v.pipe(v.array(joint), v.maxLength(32)) }),
  cost: v.strictObject({ decoded: bytes, gpu: bytes, triangles: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(400_000)), draws: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(512)) }),
});
/** A validated exported skin row. */
export type SkinRow = v.InferOutput<typeof SkinRowSchema>;
/** How a skin plays and draws: the family material entry (SF10a, validated by the family registry) the clips that loop and independent numeric pose clocks. */
export const SkinBindingSchema = v.strictObject({ skin: id, material: v.record(v.string(), v.unknown()), loops: v.pipe(v.array(clip), v.maxLength(32)), poseLayers: v.exactOptional(v.record(clip, v.pipe(v.array(SkinPoseLayerSchema), v.maxLength(32)))) });
/** A validated skin binding. */
export type SkinBinding = v.InferOutput<typeof SkinBindingSchema>;

/** Validate the export half's rows; unknown fields (its notes and motion receipt) are ignored. */
export function parseSkinRows(input: unknown): SkinRow[] {
  const r = v.safeParse(v.pipe(v.array(SkinRowSchema), v.maxLength(256)), input);
  if (!r.success) throw new Error(`skins: ${r.issues.map((i) => `${v.getDotPath(i) ?? '(root)'}: ${i.message}`).join('; ')}`);
  if (new Set(r.output.map((row) => row.id)).size !== r.output.length) throw new Error('skins: unique ids');
  return r.output;
}
/** Validate skin bindings against their rows: one per skin, loops only over the row's clips, with bounded periodic layer tables. */
export function parseSkinBindings(input: unknown, rows: readonly SkinRow[]): SkinBinding[] {
  const r = v.safeParse(v.pipe(v.array(SkinBindingSchema), v.maxLength(256)), input);
  if (!r.success) throw new Error(`skin bindings: ${r.issues.map((i) => `${v.getDotPath(i) ?? '(root)'}: ${i.message}`).join('; ')}`);
  for (const binding of r.output) {
    const row = rows.find((candidate) => candidate.id === binding.skin);
    if (row === undefined) throw new Error(`skin bindings: no skin ${binding.skin}`);
    if (binding.loops.some((name) => !row.rig.clips.includes(name))) throw new Error(`skin bindings: ${binding.skin} loops an unknown clip`);
    for (const [name, layers] of Object.entries(binding.poseLayers ?? {})) { if (layers === undefined) continue; if (!binding.loops.includes(name as ClipName)) throw new Error('skin layers require a looping base'); validateSkinLayers(layers, row.rig.joints[0] ?? []); }
  }
  if (new Set(r.output.map((binding) => binding.skin)).size !== r.output.length) throw new Error('skin bindings: one per skin');
  return r.output;
}

/** A loaded exported skin: its scene root, its one skinned mesh, the bound rig and the engine's clip player. */
export interface SkinPlayer {
  readonly root: Object3D;
  readonly mesh: SkinnedMesh;
  readonly rig: RigInstance;
  readonly machine: AnimMachine;
  /** the admitted cost (the parser's, never the row's claim) */
  readonly cost: AssetCost;
  /** the clip now playing, or null before the first `play` */
  readonly clip: ClipName | null;
  /** play one clip alone from its first frame (a looping clip repeats, a one-shot holds its last frame) */
  play: (name: ClipName) => void;
  /** advance the clip by `dt` seconds (the engine's per-frame update) */
  update: (dt: number) => void;
  /** release the geometry, skeleton and mixer (the material belongs to the caller) */
  dispose: () => void;
}

const isSkin = (node: Object3D): node is SkinnedMesh => (node as Partial<SkinnedMesh>).isSkinnedMesh === true;

/**
 * Admit, load and bind one exported skin. Refuses bytes whose hash-addressed rig differs from the row (skeleton, joint
 * order, clips, sockets) or whose parsed cost exceeds the row's declared cost. `scope` disposes it with its owner.
 */
export async function loadSkin(glb: Uint8Array, row: SkinRow, binding: SkinBinding, material: Material, scope?: Scope): Promise<SkinPlayer> {
  if (binding.skin !== row.id) throw new Error(`skin ${row.id}: binding for ${binding.skin}`);
  parseSkinBindings([binding], [row]);
  const cost = parseGlb(glb);
  cost.decoded += skinLayerDecoded(binding.poseLayers ?? {}, row.rig.joints[0]?.length ?? 0);
  if (cost.gpu > row.cost.gpu || cost.decoded > row.cost.decoded || cost.triangles > row.cost.triangles || cost.draws > row.cost.draws) throw new Error(`skin ${row.id}: cost above its declaration`);
  const file = await new GLTFLoader().parseAsync(glb.slice().buffer, '');
  const meshes: SkinnedMesh[] = []; file.scene.traverse((node) => { if (isSkin(node)) meshes.push(node); });
  const mesh = meshes[0]; if (mesh === undefined || meshes.length !== 1) throw new Error(`skin ${row.id}: expected one skinned mesh`);
  const loaded = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const m of loaded) m.dispose();
  mesh.material = material;
  const extras: unknown = mesh.userData['castShadow'];
  mesh.castShadow = extras === true; mesh.receiveShadow = true;
  const rig = bindRig(file.scene, file.animations, { skeleton: row.rig.skeleton, clips: row.rig.clips, sockets: row.rig.sockets }, { skeleton: row.rig.skeleton, joints: row.rig.joints });
  const states: Record<string, { clip: ClipName; fade: number }> = {};
  for (const name of row.rig.clips) states[name] = { clip: name, fade: 0 };
  const machine = new AnimMachine({ states, loops: binding.loops }, rig);
  let current: ClipName | null = null, live = true, time = 0;
  const layers = new Map(Object.entries(binding.poseLayers ?? {}).filter((entry): entry is [string, NonNullable<typeof entry[1]>] => entry[1] !== undefined).map(([name, data]) => [name, skinPoseLayers(mesh, data)]));
  let activeLayers: ReturnType<typeof skinPoseLayers> | undefined;
  const player: SkinPlayer = {
    root: file.scene, mesh, rig, machine, cost,
    get clip() { return current; },
    play: (name) => {
      activeLayers?.restore();
      const action = machine.action(name);
      for (const other of row.rig.clips) if (other !== name) machine.action(other).stop();
      action.reset(); action.setEffectiveWeight(1); action.play();
      current = name; time = 0; machine.update(0);
      activeLayers = layers.get(name); activeLayers?.apply(time);
    },
    update: (dt) => { if (!Number.isFinite(dt) || dt < 0) throw new Error('Invalid skin step'); activeLayers?.restore(); machine.update(dt); time += dt; activeLayers?.apply(time); },
    dispose: () => {
      if (!live) return;
      live = false; machine.dispose(); mesh.geometry.dispose(); mesh.skeleton.dispose(); mesh.removeFromParent();
    },
  };
  scope?.onDispose(() => { player.dispose(); });
  return player;
}
