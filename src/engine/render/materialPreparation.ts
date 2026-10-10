import type { Material } from 'three';

const pending = new WeakMap<Material, Set<Promise<void>>>();

/** Hold shader preparation until an existing asynchronous material resource has been published.
 * The loader owns cancellation and fallback; rejected work refuses preparation. Settled work is not retained. */
export function registerMaterialPreparation(material: Material, work: Promise<void>): void {
  let entries = pending.get(material);
  if (entries === undefined) { entries = new Set(); pending.set(material, entries); }
  entries.add(work);
  const held = entries;
  const release = (): void => { held.delete(work); if (held.size === 0) pending.delete(material); };
  void work.then(release, release);
}

/** Await pending resources on the borrowed materials, including work registered while awaiting an earlier batch.
 * The current-owner fence is checked before and after every wait; this never starts a loader or allocates a texture. */
export async function waitMaterialPreparations(materials: readonly Material[], current: () => boolean): Promise<void> {
  for (;;) {
    if (!current()) throw new Error('Shader warm-up owner left');
    const work = new Set(materials.flatMap(material => [...(pending.get(material) ?? [])]));
    if (work.size === 0) return;
    await Promise.all(work);
  }
}
