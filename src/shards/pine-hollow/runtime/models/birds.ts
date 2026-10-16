/**
 * Pine Hollow's wildlife models as rows (E306 / E315 M5, G465): the raven, the great grey owl and the pileated woodpecker —
 * Hunyuan3D-2 models
 * (art/pine-hollow/round-16-birds/: perched and flying each, one atlas; src/shards/pine-hollow/life/birdModels.ts) drawn with the
 * hares in the forest's ONE instanced draw (./wildlife.ts `WildlifeMesh`), their wings, heads and legs posed in its vertex
 * shader, not skinned. Its procedural birds stand in until the file has landed (or if it fails). The life code
 * (src/shards/pine-hollow/life/index.ts) flies every copy: the ravens to the kills and ahead of you toward the places your journal
 * has not seen, the owl at night, the woodpecker by day. A card is one bird at rest on the same program — the procedural
 * one, then the generated one the moment the file is in (`ws:model-ready`). The snowshoe hare, in its summer coat, is a row
 * of the same draw (code: `hare` in ./wildlife.ts).
 */
import { defineModel, type ModelDef } from '@wildshard/engine/models/model';
import { loadingSpecimen } from '@wildshard/engine/models/gear';
import { KIND, preloadPineWildlife, wildlifeBaked, wildlifeSpecimen, type WildKind } from './wildlife';

interface WildRow { readonly id: string; readonly name: string; readonly pipeline: 'hunyuan' | 'code'; readonly kind: WildKind; readonly box: readonly [number, number, number] }

/** A row's model: its card waits for the same required authored draw as the living forest. */
function wild(r: WildRow): ModelDef<object> {
  const id = `pine-hollow/${r.id}`;
  return defineModel<object>({
    id, name: r.name, category: 'creatures', pipeline: r.pipeline, file: 'src/shards/pine-hollow/runtime/models/birds.ts', surface: 'flesh', defaults: {},
    build: (ctx) => wildlifeBaked() ? wildlifeSpecimen(ctx, r.kind) : loadingSpecimen(id, r.box, async () => { await preloadPineWildlife(); return wildlifeSpecimen(ctx, r.kind); }),
  });
}

/** The wildlife models (life/index.ts flies and runs every copy). */
export const WILD_MODELS = {
  /** the common raven: 2–3 to every fresh kill (4 in the flock), and 3 more that fly ahead of you as breadcrumbs */
  raven: wild({ id: 'raven', name: 'Common raven', pipeline: 'hunyuan', kind: KIND.raven, box: [0.6, 0.3, 0.8] }),
  /** the great grey owl: after dark, one on a snag top near you, its head following you, its eyes shining */
  owl: wild({ id: 'great-grey-owl', name: 'Great grey owl', pipeline: 'hunyuan', kind: KIND.owl, box: [0.6, 0.3, 0.8] }),
  /** the pileated woodpecker: by day, one drumming on a snag or a pine trunk, flushing to another as you come close */
  woodpecker: wild({ id: 'pileated-woodpecker', name: 'Pileated woodpecker', pipeline: 'hunyuan', kind: KIND.woodpecker, box: [0.6, 0.3, 0.8] }),
  /** the snowshoe hare: five about you on open ground (life/index.ts N_HARE); they graze, hop, sit up when you are near
   *  and bolt in zig-zags */
  hare: wild({ id: 'snowshoe-hare', name: 'Snowshoe hare', pipeline: 'code', kind: KIND.hare, box: [0.2, 0.42, 0.5] }),
} as const;
