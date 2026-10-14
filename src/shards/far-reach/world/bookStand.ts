import { AdditiveBlending, Group, Mesh, MeshBasicMaterial, SphereGeometry } from 'three';
import { LECTERN } from '../data/bookStand';
import { hdMaterial, skyHd } from './meshes';
import { skyMappedLook } from './looks';
import { WORLD } from './baked';

/**
 * The keeper's book stand (E399, mockup B: beside the bridge-keeper a carved wooden lectern holds an open book, a lit
 * lantern hung at its side). Since E410 row 8 the support is the modelled lectern (a carved post on an iron-strapped
 * plinth, a slanted desk, an iron arm) with its modelled lantern on the arm's hook (undrawn when a model did not load),
 * carrying a code-built open book, so its pages stay readable. The notes lectern on the keeper's isle (quest step 1) is
 * the same stand without the lantern. SF72: the book is built offline (`generators/bookStand.ts` → `baked/book-stand.glb`).
 * Its size and the lectern's measures are data (`data/bookStand.ts`).
 */

/** The modelled lectern (and its lantern on the hook) into `group`; nothing when a model is not loaded. */
function modelled(group: Group, withLantern: boolean): void {
  const l = skyHd('lectern-hd'), h = withLantern ? skyHd('lantern-hd') : null;
  if (l === null || (withLantern && h === null)) return;
  const lectern = new Mesh(l.geometry, hdMaterial(l.map)); lectern.name = 'far.lectern';
  group.add(lectern);
  if (h !== null) {
    // hung by its ring from the hook: the lantern's top at the hook's tip
    const lantern = new Mesh(h.geometry, skyMappedLook('lantern-glow', h.map)); lantern.name = 'far.lectern-lantern';
    const [hx, hy, hz] = LECTERN.hook; lantern.position.set(hx, hy - LECTERN.lantern, hz); group.add(lantern);
    // a small warm halo round the glass, so the light reads from the spawn (mockup B's lit lantern)
    const halo = new Mesh(new SphereGeometry(0.12, 12, 8), new MeshBasicMaterial({ color: 0xffb860, transparent: true, opacity: 0.18, blending: AdditiveBlending, depthWrite: false }));
    halo.position.set(hx, hy - LECTERN.lantern * (1 - LECTERN.glass), hz); group.add(halo);
  }
}

/** A stand in its own frame: the modelled lectern with the baked book on its desk. */
export function bookStand(withLantern: boolean): Group {
  const group = new Group(); group.name = 'far.book-stand';
  const carved = new Group(); modelled(carved, withLantern); group.add(carved, ...WORLD.piece('book-stand').kinds.values());
  return group;
}
