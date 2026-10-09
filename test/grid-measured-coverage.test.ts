import { describe, expect, it } from 'vitest';
import { CONTENT_CAPS } from '../src/engine/core/config';
import { Scope } from '../src/engine/app/scope';
import { ResidencyAllocator } from '../src/game/grid/allocator';
import { PageResidency, PHONE_COMPOSER_CALIBRATION } from '../src/game/grid/pageResidency';
import { regionalSimAccountedBytes } from '../src/game/grid/runtimeCost';
import { TEMPLATE } from '../src/shards/_template/manifest';

type ComposerObserver = (bytes: number) => void;
function composerHarness(): { game: { observeComposerAllocation: (observer: ComposerObserver) => () => void }; emit: (bytes: number) => void } {
  let current: ComposerObserver | undefined;
  return { game: { observeComposerAllocation: (observer) => { current = observer; return () => { current = undefined; }; } },
    emit: (bytes) => { current?.(bytes); } };
}

describe('SF57: a measured whole-page home covers the page composer', () => {
  it('charges a composer inside a measured home nothing and restores the full engine base', () => {
    const owner = new PageResidency(new ResidencyAllocator());
    owner.admitHome('driftwood-isle', 341_800_000, true);
    const { game, emit } = composerHarness(), renderer = new Scope('renderer');
    owner.bindComposer(game, renderer, 'phone');
    emit(42_800_000);
    const cost = owner.allocator.cost();
    expect(cost.accounted).toBe(341_800_000 + 36);
    expect(cost.input.engineBase).toBe(CONTENT_CAPS.engineBase - 36);
    expect(owner.allocator.entries().find(e => e.id === 'page:composer')).toMatchObject({ accountedBytes: 0, coveredBy: 'sim:driftwood-isle' });
    // a resize keeps the coverage
    emit(40_000_000);
    expect(owner.allocator.cost().accounted).toBe(341_800_000 + 36);
    renderer.dispose(); owner.dispose();
  });

  it('keeps charging the composer under a declared (estimated) home, and refuses page coverage by any unmeasured claim', () => {
    const owner = new PageResidency(new ResidencyAllocator());
    owner.admitHome('_template', 16_000_000);
    const { game, emit } = composerHarness(), renderer = new Scope('renderer');
    owner.bindComposer(game, renderer, 'phone');
    emit(42_800_000);
    expect(owner.allocator.cost().accounted).toBe(16_000_000 + 42_800_000 + 36);
    expect(owner.allocator.cost().input.engineBase).toBe(CONTENT_CAPS.engineBase - PHONE_COMPOSER_CALIBRATION - 36);
    renderer.dispose(); owner.dispose();

    const allocator = new ResidencyAllocator();
    allocator.reserve({ id: 'sim:estimated', category: 'sim', owner: 'x', bytes: 100_000_000, distance: 0, needed: true });
    expect(() => allocator.reservePageComponent('page:composer', 40_000_000, PHONE_COMPOSER_CALIBRATION, 'sim:estimated')).toThrow('measured whole-page');
    allocator.reserve({ id: 'library:x', category: 'library', owner: 'x', bytes: 1, distance: 0, needed: true });
    expect(() => allocator.markMeasuredPage('library:x')).toThrow('live sim claim');
    expect(() => allocator.markMeasuredPage('sim:missing')).toThrow('live sim claim');
  });

  it('charges the composer again once the measured home is gone', () => {
    const allocator = new ResidencyAllocator();
    const home = allocator.reserve({ id: 'sim:home', category: 'sim', owner: 'home', bytes: 300_000_000, distance: 0, needed: true });
    allocator.markMeasuredPage('sim:home');
    const composer = allocator.reservePageComponent('page:composer', 40_000_000, PHONE_COMPOSER_CALIBRATION, 'sim:home');
    expect(allocator.cost().accounted).toBe(300_000_000);
    home?.release();
    expect(allocator.cost().accounted).toBe(40_000_000);
    expect(allocator.cost().input.engineBase).toBe(CONTENT_CAPS.engineBase - PHONE_COMPOSER_CALIBRATION);
    // a re-admitted claim under the same id is not measured until marked again
    allocator.reserve({ id: 'sim:home', category: 'sim', owner: 'home', bytes: 300_000_000, distance: 0, needed: true });
    expect(() => allocator.reservePageComponent('page:composer', 40_000_000, PHONE_COMPOSER_CALIBRATION, 'sim:home')).toThrow('measured whole-page');
    composer?.release();
  });
});

describe('SF57: a regional shardfile sim charges its reviewed reading', () => {
  const row = { residentMB: 3.3, rev: 'abcdef123', device: 'test', evidence: 'progress/memory/sf57/x/summary.json' };
  it('charges the reading with the calibration undone once, plus platform extras, never above the ceiling', () => {
    expect(regionalSimAccountedBytes('_template', 16_532_100, 65_536, undefined)).toBe(16_532_100 + 65_536);
    expect(regionalSimAccountedBytes('_template', 16_532_100, 65_536, { slug: '_template', regionalSimCost: row })).toBe(Math.ceil(3_300_000 / CONTENT_CAPS.residentFactor) + 65_536);
    expect(regionalSimAccountedBytes('_template', 1_000_000, 65_536, { slug: '_template', regionalSimCost: row })).toBe(1_065_536);
    expect(() => regionalSimAccountedBytes('_template', 16_000_000, 0, { slug: 'driftwood-isle', regionalSimCost: row })).toThrow('differs');
    expect(() => regionalSimAccountedBytes('_template', 16_000_000, 0, { slug: '_template', regionalSimCost: { ...row, evidence: 'elsewhere.json' } })).toThrow();
  });
  it('the template carries a reviewed reading under its declared ceiling', () => {
    const cost = TEMPLATE.regionalSimCost;
    expect(cost).toBeDefined();
    expect((cost?.residentMB ?? Infinity) * 1_000_000).toBeLessThan(16_000_000);
  });
});
