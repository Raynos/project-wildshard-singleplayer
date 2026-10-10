import * as THREE from 'three';
import { publicBytes } from '@wildshard/engine/boot/tables';
import { loadTexture, loadPBRArray } from '@wildshard/engine/core/assets';
import { TIER_CONFIG } from '@wildshard/engine/core/tier';
import type { LookReplaceContext } from '@wildshard/engine/render/look';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { editShader } from '@wildshard/sdk/looks/shaderEdits';
import { attachFogUniforms } from '@wildshard/engine/world/Atmosphere';
import { BARK_LAYERS, loadTreeSetGeometry, patchBarkArrays, patchCardCrownTop, patchImpostorCrownTop, standIn, treeSetUrls } from '@wildshard/engine/world/forest/treeSet';
import { TreeFactory, patchFade, patchWind, type FadeBand } from '@wildshard/engine/world/TreeFactory';
import { TREE_CROWN_EDITS, TREE_FAR_EDITS } from '../data/forestLook';
import { PINE_TREE_SET as TREE_SPECS_V2 } from './treeSet';
import { PINE_TREE_ASSETS } from './treeAssets';

export interface PineTreeFactoryOptions { set: string }

/**
 * Pine Hollow's trees: the Blender species set (PH-B4), its geometry, card and impostor atlases baked offline. Shipped content
 * always carries the set (G285, as Nine Dragon's layout dropped its live builder): the procedural pines and their runtime
 * branch-card and impostor bakes that stood in for a build without it are gone, and a missing set is a load fault
 * (test/shards/pine-hollow/tree-set.test.ts holds the set's files present).
 */
export class PineTreeFactory extends TreeFactory {
  constructor(renderer: LookReplaceContext['renderer'], private readonly opts: PineTreeFactoryOptions) {
    super(renderer);
  }

  override build(): Promise<this> { return this.buildSet(this.opts.set); }

  /** the impostor: albedo + normal atlas on the 2-quad crosses, alpha sharpened by its own derivative, fading in (E94) */
  private makeFarMaterial(albedo: THREE.Texture, normal: THREE.Texture, color = new THREE.Color(1, 1, 1), crownTop = false): THREE.MeshStandardMaterial {
    const far = new THREE.MeshStandardMaterial({
      map: albedo, normalMap: normal, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.96, metalness: 0, envMapIntensity: 0.45,
      color, normalScale: new THREE.Vector2(1, 1),
    });
    patchShader(far, 'pine.tree-far', PATCH_ORDER.material, (shader) => {
      attachFogUniforms(shader); patchWind(shader); patchFade(shader, this.fade.far);
      editShader(shader, TREE_FAR_EDITS); // ../data/forestLook.ts
      if (crownTop) patchImpostorCrownTop(shader, this.crownTop);
    }, { mode: 'replace', key: (crownTop ? 'tree-far-crown' : 'tree-far') });
    return far;
  }

  // ---------------------------------------------------------------- the Blender species set (PH-B4)
  /**
   * The species set: geometry, card and impostor atlases baked in Blender (src/engine/world/forest/treeSet.ts), nothing baked at
   * launch. Four materials in the engine forest's LOD slots — four batches and three shadow draws.
   * The bark tiles five PBR sets from one texture array (the layer per vertex); the cards carry their crown occlusion
   * in the vertex colour and crown-bent normals (treegen.py), lit from both faces alike.
   */
  private async buildSet(set: string): Promise<this> {
    const U = treeSetUrls(set);
    // The loader fences compressed maps before returning; choose the final sampler while mips exist.
    const cards = (texture: THREE.Texture): void => { texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping; texture.anisotropy = 8; };
    const far = (texture: THREE.Texture): void => { texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping; texture.anisotropy = 4; };
    const [geo, cardAlbedo, cardNormal, cardArm, farAlbedo, farNormal, bark] = await Promise.all([
      loadTreeSetGeometry(U.glb, TREE_SPECS_V2),
      loadTexture(U.cardsAlbedo, true, 1, undefined, cards), loadTexture(U.cardsNormal, false, 1, undefined, cards), loadTexture(U.cardsArm, false, 1, undefined, cards),
      loadTexture(U.farAlbedo, true, 1, undefined, far), loadTexture(U.farNormal, false, 1, undefined, far),
      loadPBRArray([...BARK_LAYERS], TIER_CONFIG.layerSize),
    ]);
    this.tintBark = false;

    const white = standIn([255, 255, 255, 255]);
    this.barkMaterial = new THREE.MeshStandardMaterial({
      map: white, normalMap: standIn([128, 128, 255, 255]), roughnessMap: white, aoMap: white,
      roughness: 1, metalness: 0, vertexColors: true, color: new THREE.Color(1.22, 1.2, 1.18),
    });
    patchShader(this.barkMaterial, 'pine.bark-set', PATCH_ORDER.material, (shader) => { attachFogUniforms(shader); patchWind(shader, true); patchFade(shader, this.fade.trunk); patchBarkArrays(shader, bark); }, { mode: 'replace', key: 'bark-set', textures: [bark.map, bark.normalMap, bark.armMap] });

    const needles = (band: FadeBand, key: string): THREE.MeshStandardMaterial => {
      const m = new THREE.MeshStandardMaterial({
        map: cardAlbedo, normalMap: cardNormal, aoMap: cardArm, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.92, metalness: 0,
        envMapIntensity: 0.5, vertexColors: true, color: new THREE.Color(0.86, 0.92, 0.8), normalScale: new THREE.Vector2(0.8, 0.8),
      });
      patchShader(m, 'pine.crown', PATCH_ORDER.material, (shader) => {
        attachFogUniforms(shader); patchWind(shader); patchFade(shader, band);
        editShader(shader, TREE_CROWN_EDITS); // ../data/forestLook.ts
        patchCardCrownTop(shader, this.crownTop);
      }, { mode: 'replace', key: `${key}-crown` });
      return m;
    };
    this.needleMaterial = needles(this.fade.cards, 'needles-set');
    this.twigMaterial = needles(this.fade.twigs, 'twigs-set');
    this.needleDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: cardAlbedo, alphaTest: 0.45, side: THREE.DoubleSide });
    patchShader(this.needleDepth, 'pine.needle-depth', PATCH_ORDER.material, (shader) => { patchWind(shader); patchFade(shader, this.fade.cards); }, { mode: 'replace', key: 'tree-depth' });
    this.twigDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: cardAlbedo, alphaTest: 0.45, side: THREE.DoubleSide });
    patchShader(this.twigDepth, 'pine.twig-depth', PATCH_ORDER.material, (shader) => { patchWind(shader); patchFade(shader, this.fade.twigs); }, { mode: 'replace', key: 'tree-depth' });
    this.farMaterial = this.makeFarMaterial(farAlbedo, farNormal, new THREE.Color(0.92, 0.95, 0.9), true);

    for (const s of TREE_SPECS_V2) {
      const g = geo.get(s.name);
      if (!g) throw new Error(`[trees] the set has no ${s.name}`);
      this.variants.push({ trunk: g.trunk, trunkLo: g.trunkLo, cardsHi: g.hi, cardsLo: g.lo, twigs: g.twigs, far: g.far, height: s.height, trunkRadius: s.trunk, species: s.species, collider: s.collider });
    }
    return this;
  }
}

/** Awaited by the cards boot step: the species set, which every build ships (its trees.glb in the public byte table). */
export function pineFactory(renderer: LookReplaceContext['renderer']): Promise<TreeFactory> {
  const { set } = PINE_TREE_ASSETS, glb = `/assets/models/${set}/trees.glb`;
  if (!(glb in publicBytes())) throw new Error(`[trees] Pine Hollow's tree set is missing: ${glb}`);
  return new PineTreeFactory(renderer, { set }).build();
}
