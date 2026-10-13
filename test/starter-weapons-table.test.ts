// oxlint-disable-next-line import/no-nodejs-modules -- Check emitted data and the missing-file build path.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Own an isolated generator fixture.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Name the exact owned fixture output.
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { BOW } from '../src/game/weapons/starterBowProfile';
import { wind } from '../src/engine/world/steppeWind';
import { genStarterWeapons, starterWeaponsTableSource } from '../scripts/gen-starter-weapons.mjs';
import bow from '../src/game/weapons/starterBow.json' with { type: 'json' };

// Independent pre-pack recipe, retaining the exact arithmetic and field order.
const original = {
  family: 'bow', quiver: 24, swayMax: 1.5 * (Math.PI / 180), speedBase: 30, speedDraw: 28, damageScale: 1.2,
  aimZoom: 2, aimVmZoom: 0.85, aimSway: 0.5, aimSpread: 0.5, aimIn: 10,
  arcFrom: 0.25, arcColour: 0x8fe3ff, arcMode: 'setting', zoomLook: true,
  inspectZ: -0.5, inspectHidesArms: false, transparentParts: false, vmScale: 0.72,
};

it('emits byte-identical starter parameters without copying the owning mutable wind field', () => {
  expect(JSON.stringify(bow)).toBe(JSON.stringify(original));
  const { wind: runtimeWind, ...parameters } = BOW;
  expect(JSON.stringify(parameters)).toBe(JSON.stringify(original));
  expect(runtimeWind).toBe(wind);
  expect(readFileSync('src/game/weapons/starter.generated.ts', 'utf8')).toBe(starterWeaponsTableSource());
});

it('repairs missing and stale build tables with import-free data', () => {
  const root = mkdtempSync(join(tmpdir(), 'starter-weapon-data-'));
  try {
    const file = join(root, 'src/game/weapons/starter.generated.ts');
    genStarterWeapons(root);
    const source = readFileSync(file, 'utf8');
    expect(source).toBe(starterWeaponsTableSource());
    expect(source).not.toMatch(/\bimport\b/u);
    writeFileSync(file, 'stale');
    genStarterWeapons(root);
    expect(readFileSync(file, 'utf8')).toBe(source);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
