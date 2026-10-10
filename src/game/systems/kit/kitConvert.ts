// kitConvert — a world's named kits into geometries (SHARD-PLATFORM M3, ex Nine Dragon's world/build.ts): one geometry per
// kit name, a solid kit and the swept kit of the same name merged, the alpha-cut kits apart. Each builder is released once
// built (its JS number arrays would otherwise sit beside the GPU copy through the uploads that follow) and dropped from its
// map, and the page gets a turn every `yieldMs` so the loading panel paints. `step(done, total, name)` runs before a kit
// (with its name) and after it (without).
//
//   const { solid, alpha, profile } = await convertKits({ solid: kits, swept: kitxs, alpha: alphaKits }, mergeKits, step, 30);
import type { BufferGeometry } from 'three';
import { resourceScope } from '@wildshard/engine/app/resources';
import { diagnosticNow } from '@wildshard/engine/core/clock';

/** A kit builder: its vertex count, its geometry, and dropping its JS arrays once built. */
export interface KitBuilder {
  readonly vertexCount: number;
  build: () => BufferGeometry;
  release: () => void;
}
/** The named kits: solid, swept (merged into the solid kit of the same name) and alpha-cut. */
export interface KitSets {
  readonly solid: Map<string, KitBuilder>;
  readonly swept: Map<string, KitBuilder>;
  readonly alpha: Map<string, KitBuilder>;
}
/** One kit's build time (ms) and vertex count, for the boot profile. */
export interface KitProfile { name: string; ms: number; vertices: number }
/** The built kits: [name, geometry] for the solid (with their swept parts) and the alpha-cut ones, and the profile. */
export interface KitGeometries {
  readonly solid: [string, BufferGeometry][];
  readonly alpha: [string, BufferGeometry][];
  readonly profile: KitProfile[];
}

/** Build every named kit (empty ones skipped), releasing and dropping each builder as it goes. */
export async function convertKits(sets: KitSets, merge: (parts: BufferGeometry[]) => BufferGeometry, step: (done: number, total: number, name?: string) => void, yieldMs: number): Promise<KitGeometries> {
  const solid: [string, BufferGeometry][] = [], alpha: [string, BufferGeometry][] = [], profile: KitProfile[] = [];
  const processed = new Set<string>();
  const total = sets.solid.size + sets.swept.size + sets.alpha.size;
  let done = 0;
  let lastYield = diagnosticNow();
  const converted = async (): Promise<void> => {
    done++;
    step(done, total);
    if (diagnosticNow() - lastYield < yieldMs) return;
    await new Promise<void>((resolve) => { resourceScope().timeout(0, resolve); });
    lastYield = diagnosticNow();
  };
  for (const [name, kit] of sets.solid) {
    step(done, total, name);
    const t = diagnosticNow();
    const kx = sets.swept.get(name);
    if (kx !== undefined && kx.vertexCount > 0) solid.push([name, kit.vertexCount > 0 ? merge([kit.build(), kx.build()]) : kx.build()]);
    else if (kit.vertexCount > 0) solid.push([name, kit.build()]);
    processed.add(name);
    profile.push({ name, ms: Math.round(diagnosticNow() - t), vertices: kit.vertexCount + (kx?.vertexCount ?? 0) });
    kit.release();
    kx?.release();
    sets.solid.delete(name);
    sets.swept.delete(name);
    await converted();
  }
  for (const [name, kx] of sets.swept) {
    step(done, total, name);
    const t = diagnosticNow();
    if (!processed.has(name) && kx.vertexCount > 0) solid.push([name, kx.build()]);
    profile.push({ name, ms: Math.round(diagnosticNow() - t), vertices: kx.vertexCount });
    kx.release();
    sets.swept.delete(name);
    await converted();
  }
  for (const [name, kit] of sets.alpha) {
    step(done, total, name);
    const t = diagnosticNow();
    if (kit.vertexCount > 0) alpha.push([name, kit.build()]);
    profile.push({ name, ms: Math.round(diagnosticNow() - t), vertices: kit.vertexCount });
    kit.release();
    sets.alpha.delete(name);
    await converted();
  }
  return { solid, alpha, profile };
}
