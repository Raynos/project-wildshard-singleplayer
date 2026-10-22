import * as THREE from 'three';
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import { atlasFigureSkin } from '@wildshard/game/systems/npc/figureSkins';
import { resourceScope } from '@wildshard/engine/app/resources';
import { TIER } from '@wildshard/engine/core/tier';
import population from '../boot/peopleFrames.generated.json' with { type: 'json' };
import PEOPLE from '../boot/peopleVariants.generated.json' with { type: 'json' };
import { defineMountedSpecimen } from '@wildshard/game/models/mountedSpecimen';
import mountedSpecimen from '../boot/mountedSpecimen.json' with { type: 'json' };

type PersonId = keyof typeof population.figures;

export interface CampPersonParams { readonly person: PersonId }

const ID = 'nalati-grasslands/camp-people';


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
