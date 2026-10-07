import { ResidencyAllocator, type ResidencyLease } from './allocator';

/** An admitted home claim, shared by the early boot and the later live registry without charging it twice. */
export interface HomeResidencyClaim {
  readonly instance: string;
  readonly bytes: number;
  readonly allocator: ResidencyAllocator;
  /** Acquire the registry's own lifetime reference. Release it when that registry disposes. */
  readonly retain: () => ResidencyLease;
}

/**
 * SF18b / G144: construct before manifest hydration, then inject this allocator into the home loader and GridSession.
 * The composition root owns disposal, including failed or cancelled boots. Admission precedes world allocation; the
 * home remains needed for the page lifetime. Trusted runtime homes supply reviewed resident-cost metadata rather than
 * the empty transitional shardfile's budget. This owner installs no service by import and creates no world or timer.
 */
export class PageResidency {
  readonly allocator: ResidencyAllocator;
  private claim: HomeResidencyClaim | undefined;
  private bootLease: ResidencyLease | undefined;
  private closed = false;

  constructor(allocator = new ResidencyAllocator()) { this.allocator = allocator; }

  /** The same policy follows early admission, the grid and every warning surface; never a second allocator. */
  get memory(): ResidencyAllocator['memory'] { return this.allocator.memory; }

  /** Reserve the home before any bootstrap allocation. Identical repeated admission shares its immutable identity. */
  admitHome(instance: string, bytes: number): HomeResidencyClaim {
    if (this.closed) throw new Error('Page residency is disposed');
    if (instance.length === 0 || !Number.isSafeInteger(bytes) || bytes <= 0) throw new RangeError('Home residency requires a positive measured or declared resident cost');
    if (this.claim !== undefined) {
      if (this.claim.instance !== instance || this.claim.bytes !== bytes) throw new Error('Page home residency changed identity or cost');
      return this.claim;
    }
    const id = `sim:${instance}`;
    if (this.allocator.has(id)) throw new Error('Home residency must be admitted by the page owner');
    const reserve = (): ResidencyLease => {
      if (this.closed) throw new Error('Page residency is disposed');
      const lease = this.allocator.reserve({ id, category: 'sim', owner: instance, bytes, distance: 0, needed: true });
      if (lease === null) throw new Error('Home residency admission deferred by the shared budget');
      return lease;
    };
    this.bootLease = reserve();
    this.claim = Object.freeze({ instance, bytes, allocator: this.allocator, retain: reserve });
    return this.claim;
  }

  /** Read the already admitted claim; the live registry cannot create its first claim after the home allocated. */
  home(): HomeResidencyClaim {
    if (this.closed) throw new Error('Page residency is disposed');
    if (this.claim === undefined) throw new Error('Home residency has not been admitted');
    return this.claim;
  }

  /** Release the boot reference once. Existing registry references continue accounting until their own disposal. */
  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    this.bootLease?.release();
    this.bootLease = undefined;
  }
}
