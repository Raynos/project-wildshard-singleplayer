import * as THREE from 'three';

/**
 * A moored hull's lines (SHARD-PLATFORM M3): a baked world-space template (Driftwood's generators/mooringLines.ts) drawn
 * as ONE static mesh beside the hull, so the post ends never bob. Each vertex's `aMoor` says how far it rises with the
 * bow cleat and with the stern cleat (1 at its cleat, 0 at its post), so `lift` raises each cleat end with the hull's
 * heave and pitch while the post end stays tied.
 *
 *   const lines = new MooringLines(mesh, [bowZ, sternZ]);
 *   scene.add(lines.mesh);
 *   lines.lift(hull.position.y - waterY, Math.sin(hull.rotation.x));   // after the hull rides the swell
 */

// The shipped boat has two 8-segment, 4-sided lines: 384 non-indexed vertices.
const TOTAL_VERTICES = 384;

/** A hull's mooring lines (one draw). */
export class MooringLines {
  /** the lines: add it to the scene beside the hull */
  readonly mesh: THREE.Mesh;
  private readonly rest: Float32Array;
  private readonly moor: Float32Array;
  private readonly cleatZ: readonly [number, number];

  /** `cleatZ` is the bow and stern cleats' hull-local z (pitch lifts each by −z · sin). */
  constructor(mesh: THREE.Mesh, cleatZ: readonly [number, number]) {
    const pos = mesh.geometry.getAttribute('position'), moor = mesh.geometry.getAttribute('aMoor');
    if (!(pos instanceof THREE.BufferAttribute) || !(pos.array instanceof Float32Array) || !(moor instanceof THREE.BufferAttribute) || !(moor.array instanceof Float32Array)
      || moor.itemSize !== 2 || pos.count > TOTAL_VERTICES) throw new Error('MooringLines: the baked lines lack their aMoor weights');
    this.rest = pos.array.slice();
    this.moor = moor.array;
    this.cleatZ = cleatZ;
    this.mesh = mesh;
  }

  /** Lift each line's cleat end by the hull's heave (m over the still water) less its cleat's z times sin(pitch). */
  lift(heave: number, sinPitch: number): void {
    const pos = this.mesh.geometry.getAttribute('position');
    if (!(pos instanceof THREE.BufferAttribute) || !(pos.array instanceof Float32Array)) return;
    const arr = pos.array, rest = this.rest, moor = this.moor, bow = heave - this.cleatZ[0] * sinPitch, stern = heave - this.cleatZ[1] * sinPitch;
    for (let k = 0; k < TOTAL_VERTICES; k++) arr[k * 3 + 1] = (rest[k * 3 + 1] ?? 0) + bow * (moor[k * 2] ?? 0) + stern * (moor[k * 2 + 1] ?? 0);
    pos.needsUpdate = true;
  }
}
