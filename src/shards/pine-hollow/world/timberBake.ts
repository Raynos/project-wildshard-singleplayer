/** Render-only moss channel rename on admitted cabin geometry. */
import type * as THREE from 'three';

/** a baked draw's `moss` hint (the roof's and the stone's), named as the moss graphs read it (`aMoss`, data/lookGraphs.json) */
export function mossHint(g: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!g.hasAttribute('moss')) return g;
  const moss = g.getAttribute('moss'); g.deleteAttribute('moss');
  return g.setAttribute('aMoss', moss);
}
