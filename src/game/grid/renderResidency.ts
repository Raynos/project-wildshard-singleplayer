import type { Scope } from '@wildshard/engine/app/scope';
import type { ResidencyAllocator } from './allocator';

/**
 * The renderer's pure preflight result, in bytes. Count retained JS data (including CPU buffers/canvases) and all GPU
 * buffers/mip levels; dependencies shared by several parts belong to one plan. Transient construction uses the cost
 * model's existing overlap allowance. Triangle and draw counts are not resident costs.
 */
export interface PlatformRenderBytePlan {
  readonly id: string;
  readonly jsBytes: number;
  readonly gpuBytes: number;
}

/** The look executes its existing builder only after this admission; register its resources on the supplied scope. */
export interface PlatformRenderAdmission {
  allocate: <T>(plan: PlatformRenderBytePlan, build: (scope: Scope) => T) => T;
}

/** Required platform geometry cannot silently allocate outside the shared playing envelope. */
export class PlatformRenderAdmissionError extends Error {
  readonly plan: PlatformRenderBytePlan;
  constructor(plan: PlatformRenderBytePlan) {
    super(`Platform render admission deferred for ${plan.id}: ${plan.jsBytes} JS + ${plan.gpuBytes} GPU bytes`);
    this.name = 'PlatformRenderAdmissionError'; this.plan = Object.freeze({ ...plan });
  }
}

/**
 * G144: inject only with the page's opt-in shared residency owner. Each plan owns one allocation, not an independently
 * built duplicate under a refcounted id. Resource disposal precedes the claim release, both on normal session teardown
 * and on a partially failed build. This adapter changes no geometry, materials, culling or shaders.
 */
export class PlatformRenderResidency implements PlatformRenderAdmission {
  constructor(private readonly allocator: ResidencyAllocator, private readonly scope: Scope) {}

  private assertActive(): void { if (this.scope.disposed) throw new Error('Platform render session is disposed'); }

  allocate<T>(plan: PlatformRenderBytePlan, build: (scope: Scope) => T): T {
    this.assertActive();
    if (!/^[a-z][a-z0-9.-]{0,79}$/u.test(plan.id) || !Number.isSafeInteger(plan.jsBytes) || plan.jsBytes < 0
      || !Number.isSafeInteger(plan.gpuBytes) || plan.gpuBytes < 0 || !Number.isSafeInteger(plan.jsBytes + plan.gpuBytes)) {
      throw new RangeError('Invalid platform render byte plan');
    }
    const id = `platform:render:${plan.id}`;
    if (this.allocator.has(id)) throw new Error(`Platform render allocation ${plan.id} already exists`);
    const lease = this.allocator.reserve({ id, category: 'l0', owner: 'platform', bytes: plan.jsBytes + plan.gpuBytes,
      distance: 0, needed: true });
    if (lease === null) throw new PlatformRenderAdmissionError(plan);
    // Eviction callbacks can close a session while reserve prepares another claim.
    try { this.assertActive(); } catch (error) { lease.release(); throw error; }
    const owner = this.scope.child(`platform.render.${plan.id}`);
    owner.onDispose(() => { lease.release(); });
    try { return build(owner); }
    catch (error) {
      try { owner.dispose(); }
      catch (cleanup) { throw new AggregateError([error, cleanup], 'Platform render construction and cleanup failed', { cause: cleanup }); }
      throw error;
    }
  }
}

/** Admit before advancing a sliced builder; failure or cancellation disposes its resources before the claim. */
export function* allocateRenderSteps<T>(admission: PlatformRenderAdmission, plan: PlatformRenderBytePlan, build: (scope: Scope) => Generator<void, T | undefined>): Generator<void, T | undefined> {
  const admitted = admission.allocate(plan, owner => ({ owner, steps: build(owner) }));
  let completed = false;
  try {
    for (;;) {
      if (admitted.owner.disposed) throw new Error('Platform render session is disposed');
      const next = admitted.steps.next();
      if (next.done === true) { completed = true; return next.value; }
      yield;
    }
  } catch (error) {
    try { admitted.owner.dispose(); }
    catch (cleanup) { throw new AggregateError([error, cleanup], 'Platform render construction and cleanup failed', { cause: cleanup }); }
    throw error;
  } finally {
    if (!completed) { try { admitted.steps.return(undefined); } finally { admitted.owner.dispose(); } }
  }
}
