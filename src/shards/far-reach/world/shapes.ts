import { PALETTE, flat } from './materials';
import { Group, type Material, Mesh, type MeshStandardMaterial, type Object3D } from 'three';
import { createClientScene } from '@wildshard/game/plugin/ui';
import BRIDGES from '../data/bridgeRest.generated.json' with { type: 'json' };
import { SKY_LIBRARY, skyHd, skyMesh } from './meshes';
import { skyMappedLook } from './looks';
import { towerMill } from './mill';

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

/** The windmill: the code-built tower mill (loop 5, world/mill.ts); the generated C6 tower stays in the Model Explorer. */
export function windmill(): { group: Group; hub: Object3D } {
  const { group, hub } = towerMill();
  return { group, hub };
}

/** The generated vane's rotor: every facet above this height (the cups and the arrow) turns. */
const VANE_ROTOR_Y = 2.2;
/**
 * A wind vane: the generated shrine post (C6, Hunyuan3D-2 from `art/far-reach/round-7-models/ref-vane.jpg`), its cups and
 * arrow split off as the rotor the plugin spins once a GUST hits it (empty while the model is not loaded).
 */
export function vane(): { group: Group; rotor: Object3D } {
  const group = new Group(), rotor = new Group(), post = skyMesh('vane-post'), top = skyMesh('vane-rotor');
  if (post === null || top === null) return { group, rotor };
  const mat = flat(0xffffff, { vertexColors: true });
  group.add(new Mesh(post, mat)); rotor.add(new Mesh(top, mat)); rotor.position.y = VANE_ROTOR_Y; group.add(rotor);
  return { group, rotor };
}
