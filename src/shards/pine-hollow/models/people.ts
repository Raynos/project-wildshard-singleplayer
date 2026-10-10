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
import { buildPrimitiveParts, type PrimitivePartRow } from '@wildshard/sdk/kit/primitiveParts';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { standInPerson, type StandInPerson } from '@wildshard/sdk/npc/standInPerson';
import { NPC_FIGURE, NPC_MILLER_BODY, NPC_RANGER_BODY, NPC_RANGER_GLASS, NPC_TRADER_BODY } from '../data/peopleLook';
import { KINGS_CLEARING } from '../layout';
import { npcModels, type NpcModels } from '../quest/npcModels';
import { MILLER, RANGER, TRADER } from '../quest/wardensHollow';

export type NpcKind = 'ranger' | 'miller' | 'trader';

/** a person's handle (@wildshard/sdk/npc/standInPerson): the quest reads `group`, `talkPoint`, `collider`, `update`, `lod`, `walkTo` */
export type NpcFigure = StandInPerson;

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
  return standInPerson({
    name: `npc-${kind}`, feet, yaw, row: NPC_FIGURE,
    body: buildPrimitiveParts(F.body), bodyMaterial: npcMaterial(sky),
    glass: F.glass ? buildPrimitiveParts(F.glass) : null, glowMaterial: npcGlowMaterial,
    // PH-M4: the generated person, once loaded (then the stand-in leaves the group); the ranger points toward the old-growth
    rig: () => models.rig(kind, sky), pointAt: KINGS_CLEARING, points: kind === 'ranger',
  });
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
