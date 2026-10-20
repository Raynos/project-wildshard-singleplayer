import * as THREE from 'three';
import { resourceScope } from '@wildshard/engine/app/resources';
import { publicBytes } from '@wildshard/engine/boot/tables';
import { loadTexture, loadPBRArray } from '@wildshard/engine/core/assets';
import { TIER_CONFIG } from '@wildshard/engine/core/tier';
import type { LookReplaceContext } from '@wildshard/engine/render/look';
import { BARK_LAYERS, treeSetUrls } from '@wildshard/engine/world/forest/treeSet';
import { TreeFactory, isTreeMaterial, type TreeMaterial } from '@wildshard/engine/world/TreeFactory';
import { lendLooks } from '@wildshard/game/shardfile/lentLooks';
import { lookGraphMaterials } from '@wildshard/game/plugin/shaderFamily';
import { createModelLibrary } from '@wildshard/game/plugin/geometry';
import treeRest from '../data/treeRest.generated.json';
import { firstPartyDescriptor } from '@wildshard/game/shardfile/runtimeProduct';
import { FOREST_LOOKS } from '../data/forestLook';
import { PINE_TREE_ASSETS, PINE_TREE_SET as TREE_SPECS_V2 } from './treeSet';

export interface PineTreeFactoryOptions { set: string }

const treeLibrary = createModelLibrary({ meshes: [], meshUrls: {}, hd: [], hdUrls: {}, hdLooks: {}, aoFloor: 1,
  geometryPools: [{url: treeRest.geometry, parts: treeRest.parts, channels: treeRest.channels}] }, '[trees]');

/**
 * Pine Hollow's trees: the Blender species set (PH-B4), its geometry, card and impostor atlases baked offline. Shipped content
 * always carries the set (G285, as Nine Dragon's layout dropped its live builder): the procedural pines and their runtime
 * branch-card and impostor bakes that stood in for a build without it are gone, and a missing set is a load fault
 * (test/shards/pine-hollow/tree-set.test.ts holds the set's files present).
 */
export class PineTreeFactory extends TreeFactory {
  constructor(private readonly renderer: LookReplaceContext['renderer'], private readonly opts: PineTreeFactoryOptions) {
    super(renderer);
  }

  override build(): Promise<this> { return this.buildSet(this.opts.set); }

  // ---------------------------------------------------------------- the Blender species set (PH-B4)
  /**
   * The species set: geometry, card and impostor atlases baked in Blender (src/engine/world/forest/treeSet.ts), nothing baked at
   * launch. Four materials in the engine forest's LOD slots — four batches and three shadow draws — wearing the forest's
   * look.materials graphs (../data/forestLook.ts), compiled here on the page renderer with the set's textures lent: the
   * bark tiles five PBR sets from one texture array (the layer per vertex); the cards carry their crown occlusion in the
   * vertex colour and crown-bent normals (treegen.py), lit from both faces alike.
   */
  private async buildSet(set: string): Promise<this> {
    const U = treeSetUrls(set);
    // The loader fences compressed maps before returning; choose the final sampler while mips exist.
    const cards = (texture: THREE.Texture): void => { texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping; texture.anisotropy = 8; };
    const far = (texture: THREE.Texture): void => { texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping; texture.anisotropy = 4; };
    const [, cardAlbedo, cardNormal, cardArm, farAlbedo, farNormal, bark, looks] = await Promise.all([
      treeLibrary.preload(),
      loadTexture(U.cardsAlbedo, true, 1, undefined, cards), loadTexture(U.cardsNormal, false, 1, undefined, cards), loadTexture(U.cardsArm, false, 1, undefined, cards),
      loadTexture(U.farAlbedo, true, 1, undefined, far), loadTexture(U.farNormal, false, 1, undefined, far),
      loadPBRArray([...BARK_LAYERS], TIER_CONFIG.layerSize),
      firstPartyDescriptor('pine-hollow').then(source => lookGraphMaterials(resourceScope(), { renderer: this.renderer }, source, Object.values(FOREST_LOOKS))),
    ]);
    this.tintBark = false;
    lendLooks(resourceScope(), looks);
    const look = (id: string, lent: Readonly<Record<string, THREE.Texture>>): TreeMaterial => {
      for (const [name, texture] of Object.entries(lent)) looks.setTexture(id, name, texture);
      const m = looks.materials.get(id);
      if (m === undefined) throw new Error(`[trees] look.materials lacks ${id}`);
      if (!isTreeMaterial(m)) throw new Error(`[trees] ${id} has no base colour (not a standard-model graph)`);
      return m;
    };
    this.barkMaterial = look(FOREST_LOOKS.bark, { barkMap: bark.map, barkNormal: bark.normalMap, barkArm: bark.armMap });
    const card = { cardMap: cardAlbedo, cardNormal, cardArm };
    this.needleMaterial = look(FOREST_LOOKS.needles, card);
    this.twigMaterial = look(FOREST_LOOKS.twigs, card);
    this.farMaterial = look(FOREST_LOOKS.far, { farMap: farAlbedo, farNormal });

    for (const s of TREE_SPECS_V2) {
      const part = (id: string): THREE.BufferGeometry => {
        const geometry = treeLibrary.geometry(`${s.name}__${id}`, {borrow: true});
        if (geometry === null) throw new Error(`[trees] the set has no ${s.name}__${id}`);
        return geometry;
      };
      this.variants.push({ trunk: part('trunk'), trunkLo: part('trunkLo'), cardsHi: part('hi'), cardsLo: part('lo'), twigs: part('twigs'), far: part('far'), height: s.height, trunkRadius: s.trunk, species: s.species, collider: s.collider });
    }
    return this;
  }
}

/** Awaited by the cards boot step: the species set, which every build ships (its trees.glb in the public byte table). */
export function pineFactory(renderer: LookReplaceContext['renderer']): Promise<TreeFactory> {
  const { set } = PINE_TREE_ASSETS, glb = treeRest.geometry;
  if (!(glb in publicBytes())) throw new Error(`[trees] Pine Hollow's tree set is missing: ${glb}`);
  return new PineTreeFactory(renderer, { set }).build();
}
