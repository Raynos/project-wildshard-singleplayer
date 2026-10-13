import type { CordStyle } from '../../data/whip';
import { BufferAttribute, type BufferGeometry, type Mesh, type MeshStandardMaterial, Vector3 } from 'three';

/**
 * The lash item's view (SHARD-PLATFORM SF72, a declared item view beside `./lash`, the item's runtime): a braided cord
 * that unrolls along a moving curve. The cord's rings and braid, every coil's tube and the plait tile a held coil wears
 * are baked offline (`generators/lash.ts`); a shard declares the look as rows (`CordStyle`, `PlaitStyle`).
 */

/** The original cord loop is private shard law, not a shared-platform cut. */
interface TubeProfile {
 readonly segments: number; readonly radial: number;
 readonly bend: readonly [number, number]; readonly ripple: readonly [number, number, number]; readonly drop: readonly [number, number];
 readonly radius: readonly [number, number, number, number, number];
}
interface TubeFrame { readonly fromX: number; readonly fromY: number; readonly fromZ: number; readonly toX: number; readonly toY: number; readonly toZ: number; readonly extent: number; readonly wave: number }

/** The thrown cord: one braided tube whose rings are rewritten along a moving curve (no per-frame allocation). */
export class LashCord {
  readonly mesh: Mesh<BufferGeometry, MeshStandardMaterial>;
  /** `geometry`: the cord's baked rings and braid (`generators/lash.ts` cordGeometry), its own copy; null (its bake did not load): an undrawn cord. */
  constructor(style: CordStyle, mesh: Mesh<BufferGeometry, MeshStandardMaterial>) {
    const geometry = mesh.geometry, position = geometry.getAttribute('position');
    const positions = position instanceof BufferAttribute && position.array instanceof Float32Array ? position.array : null;
    if (Object.keys(geometry.attributes).length > 0 && positions?.length !== (style.segments + 1) * style.radial * 3) throw new Error('lash cord: baked rings do not match its style');
    this.mesh = mesh;
  }
  /** Bind original ring arithmetic to admitted scalar/coefficient rows; all backing stays on this owned mesh. */
  bindCurve(row: TubeProfile, object: unknown): (frame: TubeFrame, time: number) => void {
  if (object !== this.mesh) throw new Error('Tube target must be its owned private mesh');
  const geometry = this.mesh.geometry;
  const position: unknown = geometry.getAttribute('position');
  const attributes: unknown = geometry.attributes;
  if (attributes === null || typeof attributes !== 'object') throw new Error('Missing geometry attributes');
  if (position === undefined && Object.keys(attributes).length === 0 && geometry.index === null) return () => undefined; // the original undrawn missing-bake model
  if (!(position instanceof BufferAttribute) || !(position.array instanceof Float32Array)
    || position.itemSize !== 3 || position.count !== (row.segments + 1) * row.radial) throw new Error('Tube geometry layout differs from declared rows');
  const positions = position.array, from = new Vector3(), to = new Vector3(), point = new Vector3(), next = new Vector3();
  const tangent = new Vector3(), side = new Vector3(), up = new Vector3();
  const { segments, radial } = row, [bendPhase, extentLoss] = row.bend, [ripplePhase, speed, gain] = row.ripple;
  const [dropPhase, dropGain] = row.drop, [taper, exponent, base, tipAt, tipGain] = row.radius;
  // Only frame-invariant original operations are cached; animated arithmetic keeps its order.
  const rings = Array.from({ length: segments + 1 }, (_, s) => {
    const u = s / segments;
    return { u, bend: Math.sin(u * bendPhase), ripple: u * ripplePhase, drop: -Math.sin(u * dropPhase),
      radius: taper * (1 - u) ** exponent + base + (u > tipAt ? tipGain : 0) };
  });
  const radialRows = Array.from({ length: radial }, (_, r) => {
    const angle = (r / radial) * Math.PI * 2; return { cosine: Math.cos(angle), sine: Math.sin(angle) };
  });
  return (frame, time) => {
    const ext = frame.extent, wave = frame.wave;
    if (ext < 0 || ext > 1 || Math.abs(wave) > 1000) throw new Error('Tube deformation inputs exceed bounds');
    from.set(frame.fromX, frame.fromY, frame.fromZ); to.set(frame.toX, frame.toY, frame.toZ);
    const length = from.distanceTo(to);
    tangent.subVectors(to, from).normalize(); side.set(1, 0, 0).cross(tangent).normalize(); up.crossVectors(tangent, side).normalize();
    for (let s = 0; s <= 1024; s++) {
      if (s > segments) break;
      const ring = rings[s]; if (ring === undefined) throw new Error('Missing admitted ring');
      const { u, radius } = ring, along = u * length * ext;
      const lift = ring.bend * wave * (1 - ext * extentLoss) + Math.sin(ring.ripple - time * speed) * wave * gain * u;
      point.copy(from).addScaledVector(tangent, along).addScaledVector(side, lift).addScaledVector(up, ring.drop * dropGain * length * (1 - ext));
      for (let r = 0; r < 64; r++) {
        if (r >= radial) break;
        const radialRow = radialRows[r]; if (radialRow === undefined) throw new Error('Missing admitted radial row');
        next.copy(point).addScaledVector(side, radialRow.cosine * radius).addScaledVector(up, radialRow.sine * radius);
        const at = (s * radial + r) * 3; positions[at] = next.x; positions[at + 1] = next.y; positions[at + 2] = next.z;
      }
    }
    position.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  };
}
}
