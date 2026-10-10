import { AdditiveBlending, Group, Mesh, MeshBasicMaterial, SphereGeometry, type InstancedMesh, type Texture } from 'three';
import { PATCH_ORDER, patchShader } from '@wildshard/engine/render/shaderPatches';
import { editShader } from '@wildshard/sdk/looks/shaderEdits';
import { LANTERN_GLOW_EDITS } from '../data/paintLook';
import { LECTERN } from '../data/bookStand';
import { fit, hdMaterial, skyHd } from './meshes';
import { skyBakedPiece } from './baked';

/**
 * The keeper's book stand (E399, mockup B: beside the bridge-keeper a carved wooden lectern holds an open book, a lit
 * lantern hung at its side). Since E410 row 8 the support is the modelled lectern (a carved post on an iron-strapped
 * plinth, a slanted desk, an iron arm) with its modelled lantern on the arm's hook; the code stand (a turned post on a
 * plinth, a reading box, an iron lantern on its bracket) stays the fallback. Both carry the same code-built open book, so
 * its pages stay readable. The notes lectern on the keeper's isle (quest step 1) is the same stand without the lantern.
 * SF72: the code parts (the book, the code stand) are built offline (`generators/bookStand.ts` → `baked/book-stand.glb`).
 * Its size and the lectern's measures are data (`data/bookStand.ts`).
 */

/** The lantern's warm glass: the paint's bright amber texels burn (emissive); the iron and brass stay as painted. */
function lanternMaterial(map: Texture): ReturnType<typeof hdMaterial> {
  const material = hdMaterial(map);
  patchShader(material, 'far.lantern-glow', PATCH_ORDER.decorate, (shader) => {
    editShader(shader, LANTERN_GLOW_EDITS);
  }, { key: (prior) => `${prior}|far.lantern-glow` });
  return material;
}

/** The modelled lectern (and its lantern on the hook), or null when a model is not loaded (the code stand stays). */
function modelled(withLantern: boolean): Group | null {
  const l = skyHd('lectern-hd'), h = withLantern ? skyHd('lantern-hd') : null;
  if (l === null || (withLantern && h === null)) return null;
  const group = new Group();
  const lectern = new Mesh(fit(l.geometry, { size: LECTERN.height, by: 'height', floor: 0, centre: 'base' }), hdMaterial(l.map)); lectern.name = 'far.lectern';
  group.add(lectern);
  if (h !== null) {
    // hung by its ring from the hook: the lantern's top at the hook's tip
    const lantern = new Mesh(fit(h.geometry, { size: LECTERN.lantern, by: 'height', floor: 0, centre: 'base' }), lanternMaterial(h.map)); lantern.name = 'far.lectern-lantern';
    const [hx, hy, hz] = LECTERN.hook; lantern.position.set(hx, hy - LECTERN.lantern, hz); group.add(lantern);
    // a small warm halo round the glass, so the light reads from the spawn (mockup B's lit lantern)
    const halo = new Mesh(new SphereGeometry(0.12, 12, 8), new MeshBasicMaterial({ color: 0xffb860, transparent: true, opacity: 0.18, blending: AdditiveBlending, depthWrite: false }));
    halo.position.set(hx, hy - LECTERN.lantern * (1 - LECTERN.glass), hz); group.add(halo);
  }
  return group;
}

/** A stand in its own frame: the modelled lectern with the baked book on its desk, else the baked code stand (and its lantern). */
export function bookStand(withLantern: boolean): Group {
  const group = new Group(); group.name = 'far.book-stand';
  const carved = modelled(withLantern), baked = skyBakedPiece('book-stand');
  const names = carved !== null ? ['desk-wood', 'desk-paper'] : withLantern ? ['stand-wood', 'stand-paper', 'cage', 'glass'] : ['stand-wood', 'stand-paper'];
  const parts: InstancedMesh[] = [];
  // the kinds this stand draws; the others' row materials are never drawn
  for (const [name, mesh] of baked.kinds) {
    if (names.includes(name)) parts.push(mesh);
    else for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
  }
  if (carved !== null) group.add(carved);
  if (parts.length > 0) group.add(...parts);
  return group;
}
