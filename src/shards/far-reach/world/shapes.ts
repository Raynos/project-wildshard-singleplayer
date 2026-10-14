import { PALETTE, flat } from './materials';
import type { Group, Material, MeshStandardMaterial } from 'three';
import { createWorldScene, type WorldScenePorts } from '@wildshard/game/plugin/ui';
import { SKY_LIBRARY, skyHd, skyMesh } from './meshes';
import { SKY_BRIDGE_KIT, SKY_VANE } from '../data/routeScene.generated';
import { WORLD } from './baked';

/** Shared prepared bridge parts and native look loans for world spans, their pivot and the Explorer. */
export function routeScenePorts(rails: MeshStandardMaterial, deck: Material, extra: ReadonlyMap<string, Material> = new Map()): WorldScenePorts {
  const post = skyHd('post-hd');
  return { geometry: name => {
    const geometry = name === 'post-hd' ? post?.geometry ?? null : SKY_LIBRARY.geometry(name);
    if (geometry === null && name !== 'post-hd') throw new Error(`Missing route part ${name}`);
    return geometry;
  }, materials: new Map<string, Material | null>([...extra, ['rails', rails], ['deck', deck], ['posts', post === null ? null : SKY_LIBRARY.mappedLook('post-weather', post.map)]]),
  model: SKY_LIBRARY.model, baked: WORLD.object };
}
/** The Explorer's one bridge segment uses the original vertex-coloured deck and rope looks. */
export function bridgeKit(): Group {
  return createWorldScene({ scene: SKY_BRIDGE_KIT, imports: [] }, routeScenePorts(flat(PALETTE.rope), flat(0xffffff, { vertexColors: true, flatShading: false, roughness: 0.9 }))).root;
}

/** The Explorer borrows the same authored vane hierarchy as the world. */
export function vane(): Group {
  return createWorldScene({ scene: SKY_VANE, imports: [] }, { geometry: vaneGeometry(), model: SKY_LIBRARY.model, baked: WORLD.object }).root;
}
/** Both prepared parts must be present before any vane facet is drawn. */
export function vaneGeometry(): (name: string) => ReturnType<typeof skyMesh> {
  const post = skyMesh('vane-post'), top = skyMesh('vane-rotor');
  return name => post === null || top === null ? null : name === 'vane-post' ? post : name === 'vane-rotor' ? top : null;
}
