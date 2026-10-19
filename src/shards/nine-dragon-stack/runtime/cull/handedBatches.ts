// handedBatches — the instanced batches `place` handed a shard's own culler, set up on the instance culler once the world
// is whole (SHARD-PLATFORM M3, ex Nine Dragon's world/build.ts). A batch whose bounding sphere is wider than the radius,
// or that has a distance LOD, is culled per instance (the culler deals its instances out to the LOD copies); one without,
// within the radius, is left to three's whole-object frustum test. A batch not frustum-culled is left alone.
//
//   const handed: HandedBatch[] = [];
//   place(model, copies, { …, culler: { take: (b) => { handed.push(b); } } });
//   cullHandedBatches(culler, handed, 40);
import type { HandedBatch } from '@wildshard/engine/models/place';
import type { InstanceCuller, InstanceLevel } from './instanceCuller';

/** Hand every batch `place` gave the caller to the instance culler: per instance past `radius` (m) or with a distance LOD. */
export function cullHandedBatches(culler: InstanceCuller, handed: readonly HandedBatch[], radius: number): void {
  for (const b of handed) {
    const base = b.levels[0]?.mesh ?? null;
    if (base === null || !base.frustumCulled) continue;
    // (a sculpt's LOD without the simplifier is its full geometry: left out)
    const lods: InstanceLevel[] = b.levels.slice(1).flatMap((l) => (l.mesh !== null && l.mesh.geometry !== base.geometry ? [{ mesh: l.mesh, from: l.from }] : []));
    if (base.boundingSphere === null) base.computeBoundingSphere();
    if ((base.boundingSphere?.radius ?? 0) < radius && lods.length === 0) continue;
    culler.add(base, b.cull.far ?? Number.POSITIVE_INFINITY, lods);
  }
}
