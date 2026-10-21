import { expect, test } from 'vitest';
import { NATIVE_VIEW } from '../src/shards/driftwood-isle/generators/nativeView';
import { ISLAND_KNOBS } from '../src/shards/driftwood-isle/generators/tiers';
import { driftwoodRows } from '../src/shards/driftwood-isle/runtime/boot/rows';
import { driftwoodWorldEntry } from '../src/shards/driftwood-isle/generators/worldEntry';
import { admitDriftwoodFixtureRows } from './fixtures/driftwoodRows';
import { FIXED_MODEL_FILES } from '../src/shards/driftwood-isle/generators/modelFiles';
import { DRIFTWOOD_ASSET_NAMES, DRIFTWOOD_OUTPUT, DRIFTWOOD_FIXED_SOURCES as NAMED_MODELS } from '../src/shards/driftwood-isle/generators/assets';
import { namedModelProduct } from './fixtures/namedModelProduct';
import { prepareToonLook } from '../src/game/looks/toonLook';
import { TOON_LOOK } from '../src/shards/driftwood-isle/generators/toonPresentation';
import { SECTIONS } from '../src/shards/driftwood-isle/generators/sections';
import { authoredRockGeometry } from '../src/shards/driftwood-isle/generators/rocks';
import { Rng } from '../src/engine/core/rng';
import { SHORE_ROCK } from '../src/shards/driftwood-isle/generators/rockProfiles';

test('native view rows are admitted from canonical authored data', () => {
  admitDriftwoodFixtureRows();
  expect(driftwoodRows('custom/fixedLayouts').nativeView).toEqual(NATIVE_VIEW);
});

test('render setup retains the live uniforms used by parked views', () => {
  const state = prepareToonLook(TOON_LOOK);
  state.dayLight.uCloudTime.value = 42;
  expect(prepareToonLook(TOON_LOOK)).toBe(state);
  expect(state.dayLight.uCloudTime.value).toBe(42);
});

test('canonical palette key order retains authored rock geometry', () => {
  const wire = namedModelProduct(new Map(), false).section('custom/fixedLayouts', SECTIONS).nativeView.SHORE_ROCK;
  // Parsing may restore declaration order; explicitly exercise a different order too.
  const reversed = {
    wet: wire.wet, mossDark: wire.mossDark, mossLight: wire.mossLight, moss: wire.moss,
    crease: wire.crease, cool: wire.cool, warm: wire.warm, edge: wire.edge,
    light: wire.light, mid: wire.mid, dark: wire.dark, foot: wire.foot,
  };
  expect(Object.keys(reversed)).not.toEqual(Object.keys(SHORE_ROCK));
  const build = (palette: typeof SHORE_ROCK) => {
    const rng = new Rng(0x5ea1 ^ 0x70c5), moss = rng.range(0.25, 0.85);
    return authoredRockGeometry(1.8, rng, { moss, squash: 0.72, palette, ground: -0.35 * 1.8 * 0.72 });
  };
  {
    const original = build(SHORE_ROCK), admitted = build(wire), reordered = build(reversed);
    try {
      for (const name of ['position', 'normal', 'color']) expect(admitted.getAttribute(name).array).toEqual(original.getAttribute(name).array);
      expect(admitted.index?.array).toEqual(original.index?.array);
      for (const name of ['position', 'normal', 'color']) expect(reordered.getAttribute(name).array).toEqual(original.getAttribute(name).array);
      expect(reordered.index?.array).toEqual(original.index?.array);
    } finally { original.dispose(); admitted.dispose(); reordered.dispose(); }
  }
});

test('admitted shadow tiers retain both original view choices', () => {
  admitDriftwoodFixtureRows();
  const rows = driftwoodRows('custom/fixedLayouts').shadowTiers, bushes = driftwoodWorldEntry().blocks['bushes'] ?? [];
  for (const tier of ['phone','desktop'] as const) {
    expect(rows[tier]).toEqual({bush:ISLAND_KNOBS[tier].bushShadows,boulder:ISLAND_KNOBS[tier].boulderShadows});
    // the world entry's hibiscus draw casts its shadow as the tier's knob says
    const draw = bushes.find(row => row.kind === 'attach' && row.when?.tier === tier);
    expect(draw?.kind === 'attach' ? draw.castShadow : undefined).toBe(ISLAND_KNOBS[tier].bushShadows);
  }
});

test('all named fixed draws retain the assembler identities and admitted blobs', () => {
  const source: Readonly<Record<string, string>> = FIXED_MODEL_FILES;
  const names = new Set(DRIFTWOOD_OUTPUT.blobs.map(row => row.name));
  expect(Object.keys(NAMED_MODELS)).toEqual(Object.keys(FIXED_MODEL_FILES));
  for (const [key, name] of Object.entries(NAMED_MODELS)) {
    const url = source[key];
    if (url === undefined) throw new Error('Missing authored source draw');
    expect(name).toBe(DRIFTWOOD_ASSET_NAMES[url]);
    expect(names.has(name)).toBe(true);
    expect(name.slice(name.lastIndexOf('/') + 1, -4)).toBe(url.slice(url.lastIndexOf('/') + 1, -4));
  }
});
