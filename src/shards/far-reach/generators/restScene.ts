import { REST_URLS } from '../data/restFiles';
import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { clientSceneGlb, type ClientSceneBake } from '@wildshard/sdk/bake/glb';
import { SPANS, UPDRAFT } from '../data/layout';

/** Original winch parts in their local frame; wood and rope remain named client material owners. */
export function winchRest(): ClientSceneBake {
  const root = new Group(), wood = new MeshStandardMaterial(), rope = new MeshStandardMaterial(); root.name = 'winch';
  for (const [index, x] of [-0.7, 0.7].entries()) {
    const post = new Mesh(new BoxGeometry(0.2, 1.2, 0.2), wood); post.name = `winch-post-${index}`; post.position.set(x, 0.6, 0); root.add(post);
  }
  const drum = new Mesh(new CylinderGeometry(0.32, 0.32, 1.2, 8), rope); drum.name = 'winch-drum'; drum.rotation.z = Math.PI / 2; drum.position.y = 0.95; root.add(drum);
  const crank = new Mesh(new BoxGeometry(0.1, 0.6, 0.1), wood); crank.name = 'winch-crank'; crank.position.set(0.85, 1.15, 0); root.add(crank);
  const made = clientSceneGlb(root, new Map([[wood, 'wood'], [rope, 'rope']]));
  return { ...made, scene: { ...made.scene, materials: [
    { kind: 'standard', id: 'wood', properties: { color: 0x5a3f2e, flatShading: true, roughness: 0.95, metalness: 0 } },
    { kind: 'standard', id: 'rope', properties: { color: 0x6a5c4a, flatShading: true, roughness: 0.95, metalness: 0 } },
  ] } };
}

/** Original hover slab, frame and corner pylons, with shared glass/frame material ports. */
export function hoverRest(length: number, width: number, id: string): ClientSceneBake {
  const root = new Group(), glass = new MeshStandardMaterial(), frame = new MeshStandardMaterial(); root.name = id;
  const slab = new Mesh(new BoxGeometry(width - 0.16, 0.05, length - 0.16), glass);
  slab.name = `${id}-slab`; slab.position.set(0, -0.05, -length / 2); slab.renderOrder = 4; root.add(slab);
  for (const [index, side] of [-1, 1].entries()) {
    const bar = new Mesh(new BoxGeometry(0.1, 0.1, length), frame); bar.name = `${id}-bar-${index}`;
    bar.position.set(side * (width / 2 - 0.05), -0.04, -length / 2); root.add(bar);
  }
  for (const [index, z] of [0, -length].entries()) {
    const end = new Mesh(new BoxGeometry(width, 0.1, 0.1), frame); end.name = `${id}-end-${index}`; end.position.set(0, -0.04, z); root.add(end);
    for (const [corner, side] of [-1, 1].entries()) {
      const pylon = new Mesh(new CylinderGeometry(0.07, 0.1, 0.9, 6), frame); pylon.name = `${id}-pylon-${index}-${corner}`;
      pylon.position.set(side * (width / 2 - 0.05), 0.4, z); root.add(pylon);
    }
  }
  return clientSceneGlb(root, new Map([[glass, 'glass'], [frame, 'frame']]));
}

/** Finite playable hover spans and updraft, in their shipping allocation order. */
export function hoverRestRows(): ReturnType<typeof hoverRest>[] {
  return [...SPANS.filter(span => span.kind === 'hover'), UPDRAFT].map((span, index) =>
    hoverRest(Math.hypot(span.x1 - span.x0, span.y1 - span.y, span.z1 - span.z0), span.width, `hover-${index}`));
}

/** The existing finite scene and file catalogues; the SDK JSON driver owns all I/O. */
export function restScenes(): { readonly winch: ClientSceneBake['scene']; readonly hover: readonly { readonly id: string; readonly scene: ClientSceneBake['scene'] }[] } {
  const ids = [...SPANS.filter(span => span.kind === 'hover'), UPDRAFT].map(span => span.id);
  return { winch: winchRest().scene, hover: hoverRestRows().map((made, index) => { const id = ids[index]; if (id === undefined) throw new Error('Undeclared hover span'); return { id, scene: made.scene }; }) };
}
export function restPools(): readonly { readonly url: string; readonly parts: readonly string[] }[] {
  const scenes = [winchRest(), ...hoverRestRows()];
  return scenes.map((made, index) => {
    const url = REST_URLS[index]; if (url === undefined) throw new Error('Undeclared hover pool');
    return { url, parts: made.scene.nodes.flatMap(node => node.kind === 'mesh' ? [node.geometry] : []) };
  });
}
export function winchGlb(): Uint8Array { return winchRest().glb; }
export function hover0Glb(): Uint8Array { const made = hoverRestRows()[0]; if (made === undefined) throw new Error('Missing first hover span'); return made.glb; }
export function hover1Glb(): Uint8Array { const made = hoverRestRows()[1]; if (made === undefined) throw new Error('Missing second hover span'); return made.glb; }
export function hover2Glb(): Uint8Array { const made = hoverRestRows()[2]; if (made === undefined) throw new Error('Missing updraft span'); return made.glb; }
