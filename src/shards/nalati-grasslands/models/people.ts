/**
 * Nalati Grasslands' people (E306 / E315 M5).
 *
 * The nomad camp's five (src/shards/nalati-grasslands/campPeople.ts): Baqyt Ata the elder, who gives the quest, by the big yurt's door;
 * the herders Dauren at the corral gate and Erlan at the hitching rail; the child Ayan, skipping round the ribbon pole;
 * Gulnar Apa the cook at the iron stove. They are image-to-3D figures (Hunyuan3D-2, NALATI-MERGE D2, their faces the
 * Debug ▸ Creatures & NPCs ▸ Camp faces pick, E302 — src/shards/nalati-grasslands/campPeopleModels.ts) on the procedural figures' rig: a
 * root, a head and a right arm per figure, weighted at load. The procedural painterly figures stand in until they load
 * (and stay if they fail). The camp draws all five as ONE SkinnedMesh and turns them to you, glances, nods, gestures,
 * stirs and skips; the card is one figure at rest, and the variant row picks who.
 *
 * The mounted shepherd (src/shards/nalati-grasslands/sheepRaid.ts): Dauren's brother, a seated herder in code on a saddled camp horse,
 * who rides a slow ring round the flock and whips the raiding wolves off it.
 */
import type * as THREE from 'three';
import { creatureFactory } from '@wildshard/engine/models/creature';
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import { personFigure, type PersonId } from '../campPeople';
import { loadPeopleRig } from '../campPeopleModels';
import type { NpcFigureFrame as PersonFrame } from './npc/figureRig';
import { shepherdRider } from '../creatures/sheepRaid';

export interface CampPersonParams { readonly person: PersonId }

const ID = 'nalati-grasslands/camp-people';

/** who the variant row offers, in the camp's order (src/shards/nalati-grasslands/quest.ts CAMP_PEOPLE) */
const PEOPLE: readonly { readonly id: PersonId; readonly label: string }[] = [
  { id: 'elder', label: 'Baqyt Ata, the elder' },
  { id: 'herderGate', label: 'Dauren, herder (corral gate)' },
  { id: 'herderRail', label: 'Erlan, herder (hitching rail)' },
  { id: 'child', label: 'Ayan, the child' },
  { id: 'cook', label: 'Gulnar Apa, the cook' },
];

/** one figure's frame, keyed as the rig loader takes it */
function framesOf<K extends PersonId>(key: K, frame: PersonFrame): Record<K, PersonFrame> {
  const out = {} as Record<K, PersonFrame>;
  out[key] = frame;
  return out;
}

export const campPeople: ModelDef<CampPersonParams> = defineModel<CampPersonParams>({
  id: 'nalati-grasslands/camp-people', name: 'Camp people', category: 'people', pipeline: ['hunyuan', 'code'],
  file: 'src/shards/nalati-grasslands/models/people.ts', surface: 'flesh',
  defaults: { person: 'elder' },
  variants: PEOPLE.map((p) => ({ id: p.id, label: p.label, params: { person: p.id } })),
  build: (ctx, p) => {
    // the procedural figure: the frame the generated one is fitted to, and what shows until it loads (the camp's way)
    const { group, frame } = personFigure(ctx.sky, p.person);
    const standIn = [...group.children];
    void loadPeopleRig(ctx.sky, framesOf(p.person, frame)).then((rig) => {
      // the camp writes the bones' world matrices every frame; the card's stand at rest under the specimen instead
      const b = rig.bones[p.person];
      const bones: readonly THREE.Bone[] = [b.root, b.head, b.arm];
      for (const bone of bones) { bone.matrixAutoUpdate = true; bone.matrixWorldAutoUpdate = true; }
      b.head.position.copy(b.neck);
      b.arm.position.copy(b.shoulder);
      b.root.add(b.head, b.arm);
      rig.mesh.add(b.root);
      for (const o of standIn) { o.removeFromParent(); (o as Partial<THREE.Mesh>).geometry?.dispose(); }   // (its material is the camp's shared one)
      group.add(rig.mesh);
      // its bounds from the posed bones (three caches a skinned mesh's box; taken before its first frame, every vertex sat
      // on the origin and the turntable framed the figure's feet)
      group.updateMatrixWorld(true);
      rig.mesh.skeleton.update();
      rig.mesh.computeBoundingBox();
      rig.mesh.computeBoundingSphere();
      if ('document' in globalThis) document.dispatchEvent(new CustomEvent('ws:model-ready', { detail: { id: ID } }));
      return rig;
    }).catch((e: unknown) => { console.warn('[nalati] camp people model failed: the procedural figure stays', e); });
    return group;
  },
});

/** the mounted shepherd: his seated figure on the saddled camp horse's body bone, as the raid seats him (the horse is the
 *  Hunyuan3D-2 saddled hull on the horse's rig, the code horse until it loads; he is code) */
export const shepherd: ModelDef<object> = defineModel<object>({
  id: 'nalati-grasslands/shepherd', name: 'The mounted shepherd', category: 'people', pipeline: ['hunyuan', 'code'],
  file: 'src/shards/nalati-grasslands/models/people.ts', surface: 'flesh',
  defaults: {},
  build: (ctx) => {
    const f = creatureFactory(ctx);
    const rig = f.instantiate(f.model('horse', 'camp-bay'), 0.5);
    rig.bones['body']?.add(shepherdRider().rider);
    return rig.mesh;
  },
});
