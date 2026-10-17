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
 * one painterly material that paints them like the terrain's granite: the painted rock texture triplanar in world
 * space, vertical fractures and strata bands, snow on every face that looks up above the snow line, blue in the shade.
 * src/shards/nalati-grasslands/cragRock.ts places ~500 over the snow ring, merged into four quadrant meshes (drawnInto them); each
 * collides as the hull of what it draws.
 */
import * as THREE from 'three';
import * as v from 'valibot';
import { loadNalatiTextures, TEX_METRES, TEX_MEAN, isPhoneTier } from '../look/nalatiTextures';
import { SNOW_LINE } from '../layout';
import cragRows from '../boot/cragRock.generated.json' with { type: 'json' };
import { assetBytes } from '@wildshard/sdk/assets';
import { readBakedGeometry } from '@wildshard/sdk/kit/bakedGeometry';
import { defineModel } from '@wildshard/engine/models/model';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { painterlyMaterial } from '@wildshard/engine/world/painterly';
import type { SkyRig as Sky } from '@wildshard/engine/world/skyRig';
import { ShaderFamily } from '@wildshard/sdk/looks/shaderFamily';
import { CRAG_GLSL } from '../runtime/looks/cragGlsl';

/** the GLSL below is trusted custom code (runtime/looks/cragGlsl.ts); `@{name}` splices the fragments this module passes */
const CRAG_GLSL_FAMILY = new ShaderFamily(CRAG_GLSL, {});

// ── the material: the terrain's granite (src/shards/nalati-grasslands/terrainSurface.ts cragRock), snow on what looks up ──────────

const CRAG_FRAG_PARS = CRAG_GLSL_FAMILY.glsl(CRAG_GLSL.CRAG_FRAG_PARS);
const cragFragMain = (phone: boolean): string => CRAG_GLSL_FAMILY.glsl(CRAG_GLSL.cragFragMain, { CRAG_DETAIL: phone ? '' : `vec2 st = vec2( 1.0, 0.45 ) * s * 0.21;
  r *= mix( vec3( 1.0 ), ( texture2D( tCragRock, p.zy * st ).rgb * w.x + texture2D( tCragRock, p.xz * s * 0.21 ).rgb * w.y + texture2D( tCragRock, p.xy * st ).rgb * w.z ) / uCragRockMean, 0.6 );`, SNOW_LO: (SNOW_LINE - 14).toFixed(1), SNOW_HI: (SNOW_LINE - 2).toFixed(1) });

export function cragMaterial(sky: Sky): THREE.MeshLambertMaterial {
  const mat = painterlyMaterial(sky, { vertexColors: true, rim: 0.3, bands: 0.8 });
  const white = new THREE.DataTexture(new Uint8Array([200, 200, 200, 255]), 1, 1);
  white.colorSpace = THREE.SRGBColorSpace; white.wrapS = white.wrapT = THREE.RepeatWrapping; white.needsUpdate = true;
  const uniforms = {
    tCragRock: { value: white as THREE.Texture }, tCragSnow: { value: white as THREE.Texture },
    uCragRockMean: { value: new THREE.Vector3(...TEX_MEAN.rock) },
    uCragScale: { value: new THREE.Vector2(1 / TEX_METRES.rock, 1 / TEX_METRES.snow) },
  };
  loadNalatiTextures(['rock', 'snow']).then((t) => { uniforms.tCragRock.value = t.rock; uniforms.tCragSnow.value = t.snow; return t; }).catch(() => null);
  const phone = isPhoneTier();
  patchShader(mat, 'nalati.crag-rock', PATCH_ORDER.decorate, (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCragW; varying vec3 vCragN;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvCragW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;\nvCragN = normalize( mat3( modelMatrix ) * objectNormal );');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${CRAG_FRAG_PARS}`)
      .replace('#include <color_fragment>', cragFragMain(phone));
  }, { key: `nalati-crag-rock${phone ? '-phone' : ''}` });
  return mat;
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
    return [{ geometry, material: ctx.once('nalati-crag-rock', () => cragMaterial(ctx.sky)), castShadow: true, receiveShadow: true }];
  },
});
