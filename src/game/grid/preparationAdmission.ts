import type { LiveGridAdmission } from './live';

/** Cached admission keeps metadata only; every world, including re-entry, borrows verified preparation inputs anew. */
export async function preparationAdmission(prepare: (metadata: boolean) => Promise<LiveGridAdmission>): Promise<LiveGridAdmission> {
  const first = await prepare(true);
  first.cancel?.();
  let generation = 0;
  return {
    bytes: first.bytes,
    ...(first.exclusiveRuntime === undefined ? {} : { exclusiveRuntime: first.exclusiveRuntime }),
    ...(first.reloadsCheckpoint === undefined ? {} : { reloadsCheckpoint: first.reloadsCheckpoint }),
    ...(first.prepareRuntime === undefined ? {} : { prepareRuntime: first.prepareRuntime }),
    cancel: () => { generation++; },
    create: async (saved, claim, signal) => {
      const current = generation;
      const cancelled = (): boolean => current !== generation || signal?.aborted === true;
      if (cancelled()) throw new Error('Regional preparation cancelled');
      const admission = await prepare(false);
      try {
        if (cancelled()) throw new Error('Regional preparation cancelled');
        const region = await admission.create(saved, claim, signal);
        if (cancelled()) {
          region.dispose(); throw new Error('Regional preparation cancelled');
        }
        return region;
      } catch (error) { admission.cancel?.(); throw error; }
    },
  };
}
