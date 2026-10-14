import { PALETTE, flat } from './materials';
import { Group, type Material, type MeshStandardMaterial, type Object3D } from 'three';
import { createClientScene, createWorldScene } from '@wildshard/game/plugin/ui';
import BRIDGES from '../data/bridgeRest.generated.json' with { type: 'json' };
import { SKY_LIBRARY, skyHd, skyMesh } from './meshes';
import { skyMappedLook } from './looks';
import { SKY_VANE } from '../data/routeScene.generated';
import { WORLD } from './baked';

const isGroup = (value: Object3D): value is Group => value instanceof Group;

/**
 * A rope span from its bake (SHARD-PLATFORM M3: generators/bridges.ts, by span id; `kit` is the Explorer's one segment):
 * the generated deck segments in their painted wood along the sag, the textured posts at its corners, the hand ropes (tubes
 * through their baked points) and ties in `rails`; `deck` is the planks' painted wood (`look.materials.deck-wood`, a
 * material graph). Empty when the bake did not load (the span's colliders are its own).
 */
export function ropeBridge(id: string, rails: MeshStandardMaterial, deck: Material): Group {
  const span = BRIDGES.spans.find(row => row.id === id);
  if (span === undefined) return new Group();
  const post = skyHd('post-hd'), made = createClientScene(span.scene, {
    geometry: name => { const geometry = name === 'post-hd' ? post?.geometry ?? null : SKY_LIBRARY.geometry(name);
      if (geometry === null && name !== 'post-hd') throw new Error(`Missing bridge part ${name}`); return geometry; },
    materials: new Map<string, Material | null>([['rails', rails], ['deck', deck], ['posts', post === null ? null : skyMappedLook('post-weather', post.map)]]),
  });
  if (!isGroup(made.root)) throw new Error('Bridge scene requires a group root');
  return made.root;
}
/** The rope-bridge kit for the Model Explorer: one deck segment (its plain vertex-coloured wood) with its four posts and the ropes. */
export function bridgeKit(): Group { return ropeBridge('kit', flat(PALETTE.rope), flat(0xffffff, { vertexColors: true, flatShading: false, roughness: 0.9 })); }

/** The Explorer borrows the same authored vane hierarchy as the world. */
export function vane(): Group {
  return createWorldScene({ scene: SKY_VANE, imports: [] }, { geometry: vaneGeometry(), model: SKY_LIBRARY.model, baked: WORLD.object }).root;
}
/** Both prepared parts must be present before any vane facet is drawn. */
export function vaneGeometry(): (name: string) => ReturnType<typeof skyMesh> {
  const post = skyMesh('vane-post'), top = skyMesh('vane-rotor');
  return name => post === null || top === null ? null : name === 'vane-post' ? post : name === 'vane-rotor' ? top : null;
}
