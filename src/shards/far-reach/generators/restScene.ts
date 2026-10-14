import { parseWorldScene, type WorldSceneRecipe } from '@wildshard/format/clientChannels';
import { LECTERN } from '../data/bookStand';
import { REST_URLS } from '../data/restFiles';
import { BoxGeometry, BufferGeometry, CylinderGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, RingGeometry, SphereGeometry } from 'three';
import { clientSceneGlb, type ClientSceneBake } from '@wildshard/sdk/bake/glb';
import { SPANS, UPDRAFT } from '../data/layout';
import { STORM } from '../data/storm';

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
export function restScenes(): { readonly winch: ClientSceneBake['scene']; readonly hover: readonly { readonly id: string; readonly scene: ClientSceneBake['scene'] }[]; readonly storm: ClientSceneBake['scene']; readonly books:{readonly notes:WorldSceneRecipe;readonly keeper:WorldSceneRecipe} } {
  const ids = [...SPANS.filter(span => span.kind === 'hover'), UPDRAFT].map(span => span.id);
  return { winch: winchRest().scene, hover: hoverRestRows().map((made, index) => { const id = ids[index]; if (id === undefined) throw new Error('Undeclared hover span'); return { id, scene: made.scene }; }), storm: stormRest().scene, books:{notes:bookStandRows(false),keeper:bookStandRows(true)} };
}
export function restPools(): readonly { readonly url: string; readonly parts: readonly string[] }[] {
  const scenes = [winchRest(), ...hoverRestRows(), stormRest(), bookHaloRest()];
  return scenes.map((made, index) => {
    const url = REST_URLS[index]; if (url === undefined) throw new Error('Undeclared hover pool');
    return { url, parts: made.scene.nodes.flatMap(node => node.kind === 'mesh' ? [node.geometry] : []) };
  });
}
export function winchGlb(): Uint8Array { return winchRest().glb; }
export function hover0Glb(): Uint8Array { const made = hoverRestRows()[0]; if (made === undefined) throw new Error('Missing first hover span'); return made.glb; }
export function hover1Glb(): Uint8Array { const made = hoverRestRows()[1]; if (made === undefined) throw new Error('Missing second hover span'); return made.glb; }
export function hover2Glb(): Uint8Array { const made = hoverRestRows()[2]; if (made === undefined) throw new Error('Missing updraft span'); return made.glb; }

/** A seeded stream for the bolts' zig-zags (mulberry32): every bake draws the same three bolts. */
function stormRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** A jagged bolt: a crossed pair of thin ribbons along a zig-zag from the storm's base down `length` metres. */
function boltGeometry(random: () => number, length: number): BufferGeometry {
  const pts: [number, number, number][] = [[0, 0, 0]];
  let x = 0, z = 0;
  for (let i = 1; i <= 9; i++) { x += (random() - 0.5) * 4; z += (random() - 0.5) * 4; pts.push([x, -(i / 9) * length, z]); }
  const pos: number[] = [], w = 0.35;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]; if (a === undefined || b === undefined) continue;
    const ww = w * (1 - i / pts.length);
    for (const [ox, oz] of [[ww, 0], [0, ww]] as const) {
      pos.push(a[0] - ox, a[1], a[2] - oz, a[0] + ox, a[1], a[2] + oz, b[0] + ox, b[1], b[2] + oz);
      pos.push(a[0] - ox, a[1], a[2] - oz, b[0] + ox, b[1], b[2] + oz, b[0] - ox, b[1], b[2] - oz);
    }
  }
  const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pos, 3)); return g;
}
/**
 * The crown's storm (loop 3), centred at its origin (world/build.ts hangs it over the crown at `STORM.lift`, leaning
 * toward the arena): the vortex's dished ring (the first layer's; data/stormLook.ts paints it in the `storm-ring` look)
 * and three hidden lightning bolts the plugin flashes (world/storm.ts). Ring and bolts are client material ports; the
 * lightning's per-vertex flash stays the client's.
 */
export function stormRest(): ClientSceneBake {
  const root = new Group(), ringLook = new MeshStandardMaterial(), boltLook = new MeshStandardMaterial(); root.name = 'storm';
  const layer = STORM.layers[0], ringShape = new RingGeometry(0.5, STORM.radius * layer.r, 72, 10); ringShape.rotateX(-Math.PI / 2);
  const ring = new Mesh(ringShape, ringLook); ring.name = 'storm-ring'; ring.position.y = layer.dy; ring.renderOrder = 3; ring.frustumCulled = false; root.add(ring);
  const random = stormRandom(STORM.boltSeed);
  for (let i = 0; i < STORM.bolts; i++) {
    const bolt = new Mesh(boltGeometry(random, 18 + i * 6), boltLook), a = random() * Math.PI * 2, rr = 8 + random() * 18; bolt.name = `storm-bolt-${String(i)}`;
    bolt.position.set(Math.cos(a) * rr, 2, Math.sin(a) * rr); bolt.visible = false; bolt.frustumCulled = false; root.add(bolt);
  }
  const made = clientSceneGlb(root, new Map([[ringLook, 'storm-ring'], [boltLook, 'storm-bolt']])), top = made.scene.nodes.find(node => node.id === 'storm');
  if (top?.kind !== 'group') throw new Error('Storm scene lost its root');
  top.name = 'far.storm';
  return made;
}
export function stormGlb(): Uint8Array { return stormRest().glb; }

/** Only the static halo is a new pool; fitted painted models and their maps stay borrowed. */
function bookHaloRest():ClientSceneBake {
  const root=new Group(),material=new MeshStandardMaterial();root.name='book-halo-pool';
  const halo=new Mesh(new SphereGeometry(0.12,12,8),material);halo.name='stand-halo';root.add(halo);
  return clientSceneGlb(root,new Map([[material,'halo']]));
}
export function bookStandGlb():Uint8Array { return bookHaloRest().glb; }
/** Notes and keeper use the same original named hierarchy and explicit whole-model fallback. */
function bookStandRows(withLantern:boolean):WorldSceneRecipe {
  const [x,y,z]=LECTERN.hook;
  return parseWorldScene({scene:{version:1,root:'stand',textures:[{kind:'port',id:'ready',source:'ready'}],
    nodes:[{kind:'group',id:'stand',name:'far.book-stand',children:['carved','book']},
      {kind:'group',id:'carved',children:withLantern?['lectern','lantern','halo']:['lectern'],whenTexture:{texture:'ready',present:true}},
      {kind:'mesh',id:'lectern',name:'far.lectern',geometry:'lectern',material:'lectern',missing:'omit'},
      ...(withLantern?[{kind:'mesh',id:'lantern',name:'far.lectern-lantern',geometry:'lantern',material:'lantern',position:[x,y-LECTERN.lantern,z],missing:'omit'},
        {kind:'mesh',id:'halo',geometry:'stand-halo',material:'halo',position:[x,y-LECTERN.lantern*(1-LECTERN.glass),z],missing:'empty'}]:[]),
      {kind:'object',id:'book',source:'book',missing:'refuse'}],
    materials:[{kind:'port',id:'lectern',source:'lectern'},...(withLantern?[{kind:'port',id:'lantern',source:'lantern'},{kind:'port',id:'halo',source:'halo'}]:[])]},
    imports:[{kind:'baked',id:'book',piece:'book-stand'}]});
}
