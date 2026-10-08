import { describe, expect, it } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { CONTENT_CAPS } from '../src/engine/core/config';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { PHONE_COMPOSER_CALIBRATION, PageResidency, composerReservation, type ComposerTier } from '../src/game/grid/pageResidency';

/** The public desktop boot (2880×1800, the desktop look) allocates 587,522,748 bytes of composer targets (template-fps receipt). */
const DESKTOP_COMPOSER = 587_522_748;
/** A page already near the phone envelope, as the public grid sits at its home (~965 MB playing). */
const NEAR_CAP_HOME = 230_000_000;

function bind(tier: ComposerTier, bytes: number): { owner: PageResidency; scope: Scope } {
  const owner = new PageResidency(new ResidencyAllocator()), scope = new Scope('renderer');
  owner.admitHome('home', NEAR_CAP_HOME);
  owner.bindComposer({ observeComposerAllocation: (read) => { read(bytes); return () => undefined; } }, scope, tier);
  return { owner, scope };
}

describe('composer reservation per tier', () => {
  it('reserves a phone composer at its actual allocation and a desktop one at the phone calibration', () => {
    expect(composerReservation(9_000_000, 'phone')).toBe(9_000_000);
    expect(composerReservation(40_000_000, 'phone')).toBe(40_000_000);
    expect(composerReservation(DESKTOP_COMPOSER, 'desktop')).toBe(PHONE_COMPOSER_CALIBRATION);
    expect(composerReservation(5_000_000, 'desktop')).toBe(5_000_000);
    expect(() => composerReservation(-1, 'desktop')).toThrow(RangeError);
  });

  it('admits the public desktop boot under the unchanged 1.0 GB envelope', () => {
    const { owner, scope } = bind('desktop', DESKTOP_COMPOSER);
    const cost = owner.allocator.cost();
    expect(cost.playing).toBeLessThanOrEqual(CONTENT_CAPS.playing);
    expect(owner.allocator.entries().find((row) => row.id === 'page:composer')?.bytes).toBe(PHONE_COMPOSER_CALIBRATION);
    scope.dispose(); owner.dispose();
    expect(owner.allocator.entries()).toEqual([]);
  });

  it('still refuses a phone composer that would exceed the envelope', () => {
    expect(() => bind('phone', DESKTOP_COMPOSER)).toThrow('Composer admission deferred by the shared budget');
  });
});
