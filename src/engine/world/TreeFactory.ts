import * as THREE from 'three';
import type { Renderer } from '../render/renderer';
import type { TreeSpecies } from './forest/treeSpecies';
import { crownTopUniforms, type CrownTop } from './forest/treeSet';
import { windUniforms as sharedWind, patchWindField } from './wind';
import { windStrength } from './windStrength';

export interface TreeVariant {
  trunk: THREE.BufferGeometry;
  cardsHi: THREE.BufferGeometry;
  cardsLo: THREE.BufferGeometry;
  /** near-field detail: individual photoscan twig quads along the branches (drawn within ~35 m) */
  twigs: THREE.BufferGeometry;
  /** far LOD: two crossed quads with the whole tree (cards + trunk) baked into `farMaterial`'s atlas — 4 tris */
  far: THREE.BufferGeometry;
  height: number;
  trunkRadius: number;
  /** the bark past treeHiDist (the species set's trunk without its small limbs); absent = `trunk` at every distance */
  trunkLo?: THREE.BufferGeometry;
  /** the species set's (PH-B4); the runtime pines have none */
  species?: TreeSpecies;
  /** the species set's capsule factor over the trunk radius (placement.ts TREE_SPECS_V2) */
  collider?: number;
}

/** `uTime` IS wind.ts's clock (PH-L6, one wind: Forest.update advances it with updateWind); `uWindStrength` scales the
 * forest's sway (pines, grass, undergrowth) */
export const windUniforms = { uTime: sharedWind.uWindTime, uWindStrength: windStrength };

/**
 * The forest's LOD fades (E94): Forest writes the viewer (its LOD centre) here every frame and sets each material's band.
 * A band is (start, end, dir) in metres from the viewer to the tree's origin: dir +1 dissolves the tree OUT from start to
 * end (the lo cards / trunk into the impostor, the twigs as they reach their draw distance), −1 dissolves it IN (the
 * impostor), 0 = never faded. The dissolve is a screen-door dither (interleaved gradient noise) whose threshold the +1 and
 * −1 sides share, so across a cross-fade band every pixel is drawn by exactly one of the two LODs. Only the forest's
 * instanced / batched draws fade: a single pine (Explore's specimen) is always whole.
 */
export const forestFade = { uViewer: { value: new THREE.Vector3(1e9, 0, 1e9) } };
export interface FadeBand { value: THREE.Vector3 }
const noFade = (): FadeBand => ({ value: new THREE.Vector3(1e9, 1e9, 0) });
export function patchFade(shader: { vertexShader: string; fragmentShader: string; uniforms: Record<string, THREE.IUniform> }, band: FadeBand): void {
  shader.uniforms['uViewer'] = forestFade.uViewer;
  shader.uniforms['uFadeBand'] = band;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nuniform vec3 uViewer; uniform vec3 uFadeBand; varying float vFadeKeep;')
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      vFadeKeep = 1.0;
      #if defined( USE_INSTANCING ) || defined( USE_BATCHING )
      {
        vec4 fo = vec4( 0.0, 0.0, 0.0, 1.0 );
        #ifdef USE_INSTANCING
          fo = instanceMatrix * fo;
        #endif
        #ifdef USE_BATCHING
          fo = batchingMatrix * fo;
        #endif
        fo = modelMatrix * fo;
        float ft = clamp( ( distance( fo.xz, uViewer.xz ) - uFadeBand.x ) / max( uFadeBand.y - uFadeBand.x, 1e-3 ), 0.0, 1.0 );
        vFadeKeep = uFadeBand.z > 0.5 ? 1.0 - ft : ( uFadeBand.z < -0.5 ? ft : 1.0 );
      }
      #endif`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform vec3 uFadeBand; varying float vFadeKeep;')
    .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
      if ( vFadeKeep < 1.0 ) {
        float ign = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
        if ( vFadeKeep <= ( uFadeBand.z < -0.5 ? 1.0 - ign : ign ) ) discard;
      }`);
}

export type TreeMaterial = THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;

export class TreeFactory {
  barkMaterial!: TreeMaterial;
  needleMaterial!: TreeMaterial;
  needleDepth!: THREE.MeshDepthMaterial;
  twigMaterial!: TreeMaterial;
  twigDepth!: THREE.MeshDepthMaterial;
  /** far-tree impostor: albedo + normal atlas, one column per variant (baked from the hi tree at load) */
  farMaterial!: TreeMaterial;
  /** each material's dissolve band (`forestFade`): Forest sets them from the tier's LOD distances */
  readonly fade = { cards: noFade(), trunk: noFade(), far: noFade(), twigs: noFade() };
  /** the species set's "Crowns from above" pick (E322 F-L3): 0 = A today, 1 = B (treeSet.ts patchImpostorCrownTop) */
  readonly crownTop: CrownTop = crownTopUniforms();
  variants: TreeVariant[] = [];
  /** the per-tree tint reaches the bark too (the runtime pines; the species set's bark carries its own colour) */
  tintBark = true;

  /** Renderer capability for the forest's existing batching path. */
  readonly multiDraw: boolean;
  constructor(renderer: Renderer) {
    this.multiDraw = renderer.extensions.has('WEBGL_multi_draw');
  }

  /**
   * A factory with no tree variants (ChunkTrees.factory `'none'`): untextured stand-in materials that are
   * never drawn, nothing fetched, no geometry, no branch-card bake. Forest plants nothing with it.
   */
  buildEmpty(): this {
    this.barkMaterial = new THREE.MeshStandardMaterial();
    this.needleMaterial = new THREE.MeshStandardMaterial();
    this.twigMaterial = new THREE.MeshStandardMaterial();
    this.farMaterial = new THREE.MeshStandardMaterial();
    this.needleDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    this.twigDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    return this;
  }

  build(): Promise<this> { return Promise.resolve(this.buildEmpty()); }
}

export function patchWind(shader: { vertexShader: string; uniforms: Record<string, THREE.IUniform> }, trunk = false): void {
  patchWindField(shader);
  shader.uniforms['uWindStrength'] = windUniforms.uWindStrength;
  const flutter = trunk ? '' : /* glsl */`
        // needles / twigs flutter: faster, smaller, out of phase across the crown (a branch flexes, it does not slide)
        float fl = dot( wp.xyz, vec3( 0.83, 0.61, 0.71 ) );
        float flut = ( sin( uWindTime * 6.1 + fl ) * 0.7 + sin( uWindTime * 9.7 + fl * 1.7 + ph ) * 0.3 ) * ( 0.02 + 0.06 * G ) * w;
        off += vec3( d.x * flut, flut * 0.35, d.y * flut );`;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>
      uniform float uWindStrength;
      attribute float windWeight;`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        // world = model · instance · batching · v (three's order): the tree's root, this vertex, and their 3×3
        mat3 wm = mat3( 1.0 );
        vec4 wo = vec4( 0.0, 0.0, 0.0, 1.0 );
        vec4 wp = vec4( transformed, 1.0 );
        #ifdef USE_BATCHING
          wm = mat3( batchingMatrix ); wo = batchingMatrix * wo; wp = batchingMatrix * wp;
        #endif
        #ifdef USE_INSTANCING
          wm = mat3( instanceMatrix ) * wm; wo = instanceMatrix * wo; wp = instanceMatrix * wp;
        #endif
        wm = mat3( modelMatrix ) * wm; wo = modelMatrix * wo; wp = modelMatrix * wp;
        float hN = clamp( windWeight${trunk ? ' / 0.35' : ''}, 0.0, 1.2 );
        float w = hN * hN * uWindStrength;
        float G = windGustAt( wo.xz );
        float ph = fract( sin( dot( wo.xz, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ) * 6.2832;
        float along = 0.1 + 0.6 * G
          + sin( uWindTime * 1.75 + ph ) * ( 0.06 + 0.24 * G )
          + sin( uWindTime * 2.9 + ph * 1.9 ) * 0.05 * G;
        float across = sin( uWindTime * 1.3 + ph * 2.3 ) * ( 0.04 + 0.1 * G );
        vec2 d = windDirXZ();
        vec3 off = vec3( d.x * along - d.y * across, 0.0, d.y * along + d.x * across ) * w;${flutter}
        transformed += ( off * wm ) / max( dot( wm[0], wm[0] ), 1e-6 );
      }`);
}
