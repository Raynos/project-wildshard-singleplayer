/**
 * Pine Hollow's birds (E306 / E315 M5): the raven, the great grey owl and the pileated woodpecker — Hunyuan3D-2 models
 * (art/pine-hollow/round-16-birds/: perched and flying each, one atlas; src/shards/pine-hollow/life/birdModels.ts) drawn with the
 * hares in the forest's ONE instanced draw (./wildlife.ts `WildlifeMesh`), their wings, heads and legs posed in its vertex
 * shader, not skinned. Its procedural birds stand in until the file has landed (or if it fails). The life code
 * (src/shards/pine-hollow/life/index.ts) flies every copy: the ravens to the kills and ahead of you toward the places your journal
 * has not seen, the owl at night, the woodpecker by day. A card is one bird at rest on the same program — the procedural
 * one, then the generated one the moment the file is in (`ws:model-ready`).
 */
import * as THREE from 'three';
import { defineModel, type ModelContext, type ModelDef } from '@wildshard/engine/models/model';
import { loadBirdModels, type BirdSet } from '../life/birdModels';
import { KIND, wildlifeSpecimen, type WildKind } from './wildlife';

const FILE = 'src/shards/pine-hollow/models/birds.ts';

/** the generated birds, fetched once per shard for the cards (the life code fetches its own once the game is up) */
interface Birds { set: BirdSet | null; readonly ready: Promise<BirdSet | null> }
function birdsOf(ctx: ModelContext): Birds {
  return ctx.once('pine-hollow/birds:set', (): Birds => {
    const b: Birds = { set: null, ready: loadBirdModels().then((s) => { b.set = s; return s; }) };
    return b;
  });
}

/** a bird's specimen: the generated one when it has landed, else the procedural stand-in, swapped when it lands */
function bird(id: string, kind: WildKind): (ctx: ModelContext) => THREE.Object3D {
  return (ctx) => {
    const birds = birdsOf(ctx);
    const holder = new THREE.Group();
    holder.add(wildlifeSpecimen(ctx, kind, birds.set));
    if (birds.set === null) {
      void (async (): Promise<void> => {
        const set = await birds.ready;
        if (set === null) return; // it failed: the procedural bird stays, as in the forest
        holder.clear();
        holder.add(wildlifeSpecimen(ctx, kind, set));
        if ('document' in globalThis) document.dispatchEvent(new CustomEvent('ws:model-ready', { detail: { id } }));
      })();
    }
    return holder;
  };
}

/** the common raven: 2–3 to every fresh kill (4 in the flock), and 3 more that fly ahead of you as breadcrumbs */
export const raven: ModelDef<object> = defineModel<object>({
  id: 'pine-hollow/raven', name: 'Common raven', category: 'creatures', pipeline: 'hunyuan', file: FILE, surface: 'flesh',
  defaults: {},
  build: bird('pine-hollow/raven', KIND.raven),
});

/** the great grey owl: after dark, one on a snag top near you, its head following you, its eyes shining */
export const owl: ModelDef<object> = defineModel<object>({
  id: 'pine-hollow/great-grey-owl', name: 'Great grey owl', category: 'creatures', pipeline: 'hunyuan', file: FILE, surface: 'flesh',
  defaults: {},
  build: bird('pine-hollow/great-grey-owl', KIND.owl),
});

/** the pileated woodpecker: by day, one drumming on a snag or a pine trunk, flushing to another as you come close */
export const woodpecker: ModelDef<object> = defineModel<object>({
  id: 'pine-hollow/pileated-woodpecker', name: 'Pileated woodpecker', category: 'creatures', pipeline: 'hunyuan', file: FILE, surface: 'flesh',
  defaults: {},
  build: bird('pine-hollow/pileated-woodpecker', KIND.woodpecker),
});
