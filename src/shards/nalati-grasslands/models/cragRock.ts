/**
 * The snow ring's crag rock (E306 / E315 second pass; the pieces and their material were src/shards/nalati-grasslands/cragRock.ts, the
 * crags pass): real faceted granite the terrain's 2 m grid cannot carry, in three kinds —
 *
 *   fin      a blade-like tower standing ON a crest, long axis along the ridge (the serrated skyline), 5–18 m tall
 *   rib      a buttress standing AGAINST a steep face, long axis down the fall line, its top slanting with the face
 *   tower    a squat broken tower on a steep shoulder, where the crags rise out of the scree
 *
 * Every piece is a stack of jittered polygon rings (5–7 sides) tapering to a split crown, with a stepped ledge or two
 * (the strata — snow lies on them), flat-shaded, drawn from its placer's rng stream (so the ring is bit-identical). On
 * one painterly look graph that paints them like the terrain's granite (data/lookGraphs.json 'nalati-crag', the phone's
 * without the second rock octave): the painted rock texture triplanar in world space, vertical fractures and strata
 * bands, snow on every face that looks up above the snow line, blue in the shade.
 * src/shards/nalati-grasslands/cragRock.ts places ~500 over the snow ring, merged into four quadrant meshes (drawnInto them); each
 * collides as the hull of what it draws.
 */
import type * as THREE from 'three';
import * as v from 'valibot';
import paintedTextures from '../boot/paintedTextures.generated.json' with { type: 'json' };
import specimenData from '../boot/specimens.generated.json' with { type: 'json' };
import { loadSpecimenTexture } from '@wildshard/game/models/specimenCatalogue';
import { TIER_CONFIG } from '@wildshard/engine/core/tier';
import { lentLook, setLentParam, setLentTexture } from '@wildshard/sdk/looks/lentLooks';
import layoutRows from '../boot/layout.generated.json' with { type: 'json' };
import cragRows from '../boot/cragRock.generated.json' with { type: 'json' };
import { assetBytes } from '@wildshard/sdk/assets';
import { readBakedGeometry } from '@wildshard/sdk/kit/bakedGeometry';
import { defineModel } from '@wildshard/engine/models/model';

const { SNOW_LINE } = layoutRows;

/** the crags' look graph: the phone's drops the second rock octave */
export const CRAG_LOOK = TIER_CONFIG.maxTexture <= 1024 ? 'nalati-crag-phone' : 'nalati-crag';

export function cragMaterial(): THREE.Material {
  setLentParam(CRAG_LOOK, 'rockMean', paintedTextures.mean.rock);
  setLentParam(CRAG_LOOK, 'scale', [1 / paintedTextures.metres.rock, 1 / paintedTextures.metres.snow]);
  setLentParam(CRAG_LOOK, 'snowBand', [SNOW_LINE - 14, SNOW_LINE - 2]);
  Promise.all([loadSpecimenTexture(specimenData.materials.rock.texture), loadSpecimenTexture(specimenData.materials.snow.texture)]).then(([rock, snow]) => { setLentTexture(CRAG_LOOK, 'rock', rock); setLentTexture(CRAG_LOOK, 'snow', snow); return rock; }).catch(() => null);
  return lentLook(CRAG_LOOK);
}

export type CragKind = 'fin' | 'rib' | 'tower';
/** Numeric geometry layout shared by the fixed world quadrants and Explorer cards. */
export const CRAG_GEOMETRY = v.object({ attrs: v.array(v.tuple([v.string(), v.literal('f32'), v.number(), v.boolean()])),
  count: v.number(), index: v.nullable(v.picklist(['u16', 'u32'])), indexCount: v.number(), box: v.boolean() });

export const cragRock = defineModel<{ readonly kind: CragKind }>({
  id: 'nalati-grasslands/crag-rock', name: 'Crag rock', category: 'nature', pipeline: 'code',
  file: 'src/shards/nalati-grasslands/models/cragRock.ts', surface: 'rock',
  defaults: { kind: 'fin' },
  variants: [{ id: 'fin', label: 'Fin', params: {} }, { id: 'rib', label: 'Rib', params: { kind: 'rib' } }, { id: 'tower', label: 'Tower', params: { kind: 'tower' } }],
  build: (ctx, p) => {
    const part = cragRows.specimens[p.kind];
    const geometry = readBakedGeometry(assetBytes(part.bytes), 0, v.parse(CRAG_GEOMETRY, part.row));
    return [{ geometry, material: ctx.once('nalati-crag-rock', cragMaterial), castShadow: true, receiveShadow: true }];
  },
});
