import * as THREE from 'three';
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import { atlasFigureSkin } from '@wildshard/game/systems/npc/figureSkins';
import { resourceScope } from '@wildshard/engine/app/resources';
import { TIER } from '@wildshard/engine/core/tier';
import population from '../boot/peopleFrames.generated.json' with { type: 'json' };
import { defineMountedSpecimen } from '@wildshard/game/models/mountedSpecimen';
import mountedSpecimen from '../boot/mountedSpecimen.json' with { type: 'json' };

type PersonId = keyof typeof population.figures;

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

export const campPeople: ModelDef<CampPersonParams> = defineModel<CampPersonParams>({
  id: 'nalati-grasslands/camp-people', name: 'Camp people', category: 'people', pipeline: ['hunyuan', 'code'],
  file: 'src/shards/nalati-grasslands/models/people.ts', surface: 'flesh',
  defaults: { person: 'elder' },
  variants: PEOPLE.map((p) => ({ id: p.id, label: p.label, params: { person: p.id } })),
  build: (ctx, p) => {
    const group = new THREE.Group(), owner = resourceScope();
    void atlasFigureSkin(population.figures[p.person].atlas[TIER], ctx.sky, owner).then(mesh => {
      const [root, head, arm] = mesh.skeleton.bones;
      if (root === undefined || head === undefined || arm === undefined) throw new Error('Missing figure pivots');
      for (const bone of [root, head, arm]) { bone.matrixAutoUpdate = true; bone.matrixWorldAutoUpdate = true; }
      root.add(head, arm); mesh.add(root); group.add(mesh);
      group.updateMatrixWorld(true); mesh.skeleton.update(); mesh.computeBoundingBox(); mesh.computeBoundingSphere();
      if ('document' in globalThis) document.dispatchEvent(new CustomEvent('ws:model-ready', { detail: { id: ID } }));
      return undefined;
    });
    return group;
  },
});

/** the mounted shepherd: his seated figure on the saddled camp horse's body bone, as the raid seats him (the horse is the
 *  Hunyuan3D-2 saddled hull on the horse's rig, the code horse until it loads; he is code) */
export const shepherd = defineMountedSpecimen(mountedSpecimen);
