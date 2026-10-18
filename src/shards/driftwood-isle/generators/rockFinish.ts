/** Rock finishing is author work; products carry final vertex channels. */
import * as THREE from 'three';

export interface RockOpts {
  /** vertical half-height ÷ r (default 0.7) */
  squash?: number;
  /** 0 = bare stone, 1 = a full moss cap (default 0.8) */
  moss?: number;
  /** default SHORE_ROCK */
  palette?: RockPalette;
  /** where the ground (or the water line) meets the rock, in its local y — the paint's foot → crown ramp and the
   * contact AO start there (default −0.3 · r · squash) */
  ground?: number;
  /** added to the icosphere detail of every piece (−1: a lighter rock for a dense scatter) */
  detail?: number;
}

export interface RockPalette {
  /** the stone ramp: the wet foot → the shade → the body → the sunlit crown */
  foot: string; dark: string; mid: string; light: string;
  /** the worn convex edges */
  edge: string;
  /** broad warm / cool drifts across a rock */
  warm: string; cool: string;
  /** the tint that creases, cracks and AO fall toward */
  crease: string;
  moss: string; mossLight: string; mossDark: string;
  /** the wet line at the foot */
  wet: string;
}

const FACET_HINT = 0.3;
function facetHint(g: THREE.BufferGeometry, f: number): void {
  const pos = g.getAttribute('position'), nrm = g.getAttribute('normal');
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), fn = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i + 2 < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    fn.subVectors(c, b).cross(a.sub(b)).normalize();
    for (let j = 0; j < 3; j++) { n.fromBufferAttribute(nrm, i + j).multiplyScalar(1 - f).addScaledVector(fn, f).normalize(); nrm.setXYZ(i + j, n.x, n.y, n.z); }
  }
}

/** the welded, painted pieces → the finished rock: smooth normals per piece, unwelded, the facet hint */
export function finishRock(welded: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', welded.getAttribute('position'));
  g.setIndex(welded.getIndex());
  g.computeVertexNormals();
  g.setAttribute('color', welded.getAttribute('color'));
  const ni = g.toNonIndexed();
  g.dispose(); welded.dispose();
  facetHint(ni, FACET_HINT);
  return ni;
}

