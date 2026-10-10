import { cacheUntilDisposed } from '@wildshard/engine/app/cachedAssets';
/**
 * The hamlet's people, stand-ins (PINE-HOLLOW-REMASTER PH-C1 / C6): Hale the ranger, Brandt the miller, Mott the trader
 * as simple standing figures until PH-M4's generated, rigged humans land. ONE factory — `makeNpcFigure(kind, sky)` —
 * is all PH-M4 swaps: the quest only reads the returned handle (`group`, `talkPoint`, `collider`, `update`).
 * PH-M4 (built): the figure below is the stand-in until the person's generated model has loaded (npcModels.ts: photoreal,
 * rigged at load, idle / talk / point clips); `update` swaps it in on the first frame it is ready (Debug ▸ Pine Hollow people = Stand-ins: never).
 *
 * Each figure is one merged mesh on a vertex-coloured PBR material shared by all three (+ the ranger's lantern glass on
 * the glow material): 1–2 draws, no lights. The ranger is board B3's "old warden": a long coat, a campaign hat, a grey
 * beard, a brass badge and a lantern held low. They turn to face you when you come near and sway a little as they talk.
 */
import * as THREE from 'three';
import { defineModel, type ModelContext, type ModelDef } from '@wildshard/engine/models/model';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { buildPrimitiveParts, type PrimitivePartRow } from '@wildshard/sdk/kit/primitiveParts';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { NPC_MILLER_BODY, NPC_RANGER_BODY, NPC_RANGER_GLASS, NPC_TRADER_BODY } from '../data/peopleLook';
import { KINGS_CLEARING } from '../layout';
import { npcModels, type NpcModels, type NpcRig } from '../quest/npcModels';
import { MILLER, RANGER, TRADER } from '../quest/wardensHollow';

export type NpcKind = 'ranger' | 'miller' | 'trader';

export interface NpcFigure {
  readonly group: THREE.Group;
  /** where the "[E] Talk" prompt sits (world, the head) */
  readonly talkPoint: THREE.Vector3;
  readonly collider: Collider;
  talking: boolean;
  update: (dt: number, t: number, player: THREE.Vector3) => void;
  /** draw distance: drawn inside 140 m, casting a shadow inside 45 m (`d` = metres from the camera) */
  lod: (d: number) => void;
  /**
   * E322 F-M3: walk to (x, y, z) at the rig's walk pace, playing its walk (the legs step, npcRig.ts),
   * then face the post's way again; the collider and the talk point go along (a caller that moves a person moves its
   * prompt). Nothing in the quest moves the people yet: this is the walk, ready for when it does.
   */
  walkTo: (x: number, y: number, z: number) => void;
}

/** each person's stand-in parts (../data/peopleLook.ts): the body, and the lantern glass when they carry one */
const FIGURES: Readonly<Record<NpcKind, { readonly body: readonly PrimitivePartRow[]; readonly glass: readonly PrimitivePartRow[] | null }>> = {
  ranger: { body: NPC_RANGER_BODY, glass: NPC_RANGER_GLASS },
  miller: { body: NPC_MILLER_BODY, glass: null },
  trader: { body: NPC_TRADER_BODY, glass: null },
};

let sharedMat: THREE.MeshStandardMaterial | null = null;
let sharedGlow: THREE.MeshBasicMaterial | null = null;
/** the figures' lit material (vertex colours, PBR) — also the ride props' (the zipline trolley, the canoe) */
export function npcMaterial(sky: Sky): THREE.MeshStandardMaterial {
  if (!sharedMat) {
    sharedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 });
    sharedMat.name = 'ph-npc';
    sky.setupMaterial(sharedMat);
    cacheUntilDisposed(sharedMat, () => { sharedMat = null; });
  }
  return sharedMat;
}
/** unlit glow (lantern glass): the interactables kit's glow program (vertex colours on MeshBasicMaterial) */
export function npcGlowMaterial(): THREE.MeshBasicMaterial {
  sharedGlow ??= cacheUntilDisposed(new THREE.MeshBasicMaterial({ vertexColors: true, fog: true, toneMapped: true }), () => { sharedGlow = null; });
  return sharedGlow;
}

/** a stand-in NPC at `feet` facing `yaw` (the quest's one factory: PH-M4 replaces this body, nothing else); `models`: the page's people unless a test passes its own */
export function makeNpcFigure(kind: NpcKind, sky: Sky, feet: { x: number; y: number; z: number }, yaw: number, models: NpcModels = npcModels): NpcFigure {
  const F = FIGURES[kind];
  void models.preload(); // the play installer already awaited these; standalone specimens may still request them
  const group = new THREE.Group();
  group.name = `npc-${kind}`;
  group.position.set(feet.x, feet.y, feet.z);
  group.rotation.y = yaw;
  const mesh = new THREE.Mesh(buildPrimitiveParts(F.body), npcMaterial(sky));
  mesh.castShadow = true; mesh.receiveShadow = true;
  group.add(mesh);
  const glass = F.glass ? new THREE.Mesh(buildPrimitiveParts(F.glass), npcGlowMaterial()) : null;
  if (glass) group.add(glass);
  // PH-M4: the generated person, once loaded (then the stand-in above leaves the group)
  let rig: NpcRig | null = null, shown: THREE.Mesh = mesh;
  let talkK = 0, pointK = 0, talkT = 0;
  const adopt = (r: NpcRig): void => {
    rig = r;
    group.remove(mesh); if (glass) group.remove(glass);
    r.mesh.castShadow = mesh.castShadow;
    group.add(r.mesh);
    shown = r.mesh;
    if (r.lanternAt) {
      // the lantern's flame: a small glow in the model's own lantern, riding the right hand
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), npcGlowMaterial());
      const hand = new THREE.Vector3().setFromMatrixPosition(r.handR.matrixWorld).applyMatrix4(new THREE.Matrix4().copy(group.matrixWorld).invert());
      flame.position.copy(r.lanternAt).sub(hand);
      const col = new Float32Array(flame.geometry.getAttribute('position').count * 3);
      for (let i = 0; i < col.length; i += 3) { col[i] = 2.4; col[i + 1] = 1.35; col[i + 2] = 0.45; }
      flame.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
      flame.castShadow = false;
      r.handR.add(flame);
    }
  };
  const pos = { x: feet.x, y: feet.y, z: feet.z };   // where they stand: a walk moves it
  const collider: Collider = { x: pos.x, z: pos.z, hw: 0.28, hd: 0.28, rot: 0, yTop: pos.y + 1.8, yBottom: pos.y - 0.3 };
  const talkPoint = new THREE.Vector3(pos.x, pos.y + 1.6, pos.z);
  // the walk (E322 F-M3): from → to, `walkK` easing the clip in and out, `phase` advanced by the distance walked
  let walk: { from: THREE.Vector3; to: THREE.Vector3; done: number } | null = null, walkK = 0, phase = 0;
  const stepWalk = (dt: number): number | null => {
    const speed = rig?.walkSpeed ?? 0.72, cycle = rig?.walkCycle ?? 0.72;
    walkK += ((walk ? 1 : 0) - walkK) * Math.min(1, dt * 5);
    if (!walk) return null;
    const len = walk.from.distanceTo(walk.to);
    walk.done = Math.min(len, walk.done + speed * walkK * dt);
    phase = (phase + (speed * walkK * dt) / Math.max(0.01, cycle)) % 1;
    const k = len > 1e-6 ? walk.done / len : 1;
    pos.x = walk.from.x + (walk.to.x - walk.from.x) * k; pos.y = walk.from.y + (walk.to.y - walk.from.y) * k; pos.z = walk.from.z + (walk.to.z - walk.from.z) * k;
    group.position.set(pos.x, pos.y, pos.z);
    collider.x = pos.x; collider.z = pos.z; collider.yTop = pos.y + 1.8; collider.yBottom = pos.y - 0.3;
    talkPoint.set(pos.x, pos.y + 1.6, pos.z);
    const heading = Math.atan2(walk.to.x - walk.from.x, walk.to.z - walk.from.z);
    if (walk.done >= len) walk = null;
    return heading;
  };
  const home = yaw;
  let cur = yaw;
  let lodState = -1;
  const fig: NpcFigure = {
    group, talkPoint, collider, talking: false,
    lod: (d) => {
      const st = d > 140 ? 0 : d > 45 ? 1 : 2;
      if (st === lodState) return;
      lodState = st; group.visible = st > 0; shown.castShadow = st === 2; mesh.castShadow = st === 2;
    },
    walkTo: (x, y, z) => {
      walk = { from: new THREE.Vector3(pos.x, pos.y, pos.z), to: new THREE.Vector3(x, y, z), done: 0 };
    },
    update: (dt, t, player) => {
      const heading = stepWalk(dt);
      const dx = player.x - pos.x, dz = player.z - pos.z, near = heading === null && dx * dx + dz * dz < 9 * 9;
      const want = heading ?? (near ? Math.atan2(dx, dz) : home);
      let d = want - cur; d = Math.atan2(Math.sin(d), Math.cos(d));
      cur += d * Math.min(1, dt * (heading === null ? 3 : 6));
      group.rotation.y = cur;
      if (rig === null) { const r = models.rig(kind, sky); if (r) adopt(r); }
      if (rig !== null) {
        // idle / talk / point (npcModels.ts): the talk eases in and out; the ranger points toward the old-growth now and then
        talkK += ((fig.talking ? 1 : 0) - talkK) * Math.min(1, dt * 4);
        talkT = fig.talking ? talkT + dt : 0;
        const pointing = kind === 'ranger' && fig.talking && talkT % 9 > 5.5 && talkT % 9 < 8;
        pointK += ((pointing ? 1 : 0) - pointK) * Math.min(1, dt * 3);
        let py = Math.atan2(KINGS_CLEARING.x - pos.x, KINGS_CLEARING.z - pos.z) - cur;
        py = Math.max(-1, Math.min(1, Math.atan2(Math.sin(py), Math.cos(py))));
        const look = near ? Math.max(-0.6, Math.min(0.6, Math.atan2(Math.sin(want - cur), Math.cos(want - cur)))) : 0;
        rig.pose(t, talkK, pointK, py, look, walkK, phase);
        return;
      }
      mesh.scale.y = 1 + Math.sin(t * 1.7) * 0.006;
      mesh.rotation.z = fig.talking ? Math.sin(t * 2.3) * 0.025 : 0;
    },
  };
  const loaded = models.rig(kind, sky);
  if (loaded !== null) adopt(loaded);
  return fig;
}

// ─────────────── the models (E306 / E315 M5) ───────────────

const FILE = 'src/shards/pine-hollow/models/people.ts';
/** the generated rig's procedural clips (npcModels.ts `pose`): breathing and a weight shift, the talk gestures, the point */
const NPC_CLIPS: readonly string[] = ['idle', 'talk', 'point'];
/** where a card's person looks while no one is near: straight ahead (the player far off down +z) */
const NOBODY = new THREE.Vector3(0, 0, 1e4);

/**
 * A person's specimen: `makeNpcFigure` at the origin facing +z, exactly the figure the quest stands up — the generated,
 * rigged person (npcModels.ts) once the model has loaded, the stand-in above until then (the card then swaps, `ws:model-ready`).
 */
function person(id: string, kind: NpcKind): (ctx: ModelContext) => THREE.Object3D {
  return (ctx) => {
    const fig = makeNpcFigure(kind, ctx.sky, { x: 0, y: 0, z: 0 }, 0);
    const rigged = (): boolean => fig.group.children.some((c) => (c as Partial<THREE.SkinnedMesh>).isSkinnedMesh === true);
    fig.update(0, 0, NOBODY); // adopts the generated person when it has loaded, posed at rest
    if (!rigged()) {
      void (async (): Promise<void> => {
        if (await npcModels.load(kind) === null) return; // it failed: the stand-in stays, as in the hamlet
        fig.update(0, 0, NOBODY);
        if (rigged() && 'document' in globalThis) document.dispatchEvent(new CustomEvent('ws:model-ready', { detail: { id } }));
      })();
    }
    return fig.group;
  };
}

/** Hale, the ranger (board B3 pick A, "the old warden": long coat, campaign hat, grey beard, brass badge, a lantern held
 *  low): out front of his cabin, gives the quest, and points toward the old-growth now and then as he talks */
export const rangerHale: ModelDef<object> = defineModel<object>({
  id: 'pine-hollow/ranger-hale', name: RANGER.name, category: 'people', pipeline: ['hunyuan', 'code'], file: FILE, surface: 'flesh',
  defaults: {}, rig: { clips: NPC_CLIPS },
  build: person('pine-hollow/ranger-hale', 'ranger'),
});

/** Brandt, the miller (the apron, the cap): in front of the miller's house */
export const millerBrandt: ModelDef<object> = defineModel<object>({
  id: 'pine-hollow/miller-brandt', name: MILLER.name, category: 'people', pipeline: ['hunyuan', 'code'], file: FILE, surface: 'flesh',
  defaults: {}, rig: { clips: NPC_CLIPS },
  build: person('pine-hollow/miller-brandt', 'miller'),
});

/** Mott, the trader (the fur hat, the red coat): at his stall — his swaps and the errand */
export const traderMott: ModelDef<object> = defineModel<object>({
  id: 'pine-hollow/trader-mott', name: TRADER.name, category: 'people', pipeline: ['hunyuan', 'code'], file: FILE, surface: 'flesh',
  defaults: {}, rig: { clips: NPC_CLIPS },
  build: person('pine-hollow/trader-mott', 'trader'),
});
