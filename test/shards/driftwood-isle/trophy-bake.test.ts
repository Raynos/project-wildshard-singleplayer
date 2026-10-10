// oxlint-disable-next-line import/no-nodejs-modules -- Explicit admission of the shipped immutable geometry templates.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it } from 'vitest';
import { MeshBasicMaterial, Vector3, type Material } from 'three';
import { SlotGeometry } from '../../../src/engine/models/slots';
import { modelContext } from '../../../src/engine/models/model';
import type { SkyRig } from '../../../src/engine/world/skyRig';
import { loadFixedGeometry } from '../../../src/shards/driftwood-isle/boot/fixedGeometry';
import { FIXED_MODEL_FILES } from '../../../src/shards/driftwood-isle/data/modelFiles';
import slots from '../../../src/shards/driftwood-isle/data/trophySlots.json' with { type: 'json' };
import { plaquesGeometry } from '../../../src/shards/driftwood-isle/generators/trophyPlaques';
import { TROPHY_LAYOUT } from '../../../src/shards/driftwood-isle/data/trophyLayout';
import { PLAQUE_GAP, TROPHIES, TrophyPlaques, buildTrophy } from '../../../src/shards/driftwood-isle/models/trophyPlaques';

beforeAll(async () => {
  await loadFixedGeometry(new Map(Object.values(FIXED_MODEL_FILES).map(url => [url, new Uint8Array(readFileSync(`public${url}`))])));
});

it('retains exact shipped vertices and original visible slots through every win, empty state and loose drop', () => {
  const material = new MeshBasicMaterial();
  for (const gap of [PLAQUE_GAP, 0]) {
    const source = plaquesGeometry(gap), original = new SlotGeometry(source.geometry, source.ranges);
    expect(slots).toEqual({ ranges: source.ranges, boards: source.boards, empty: source.empty, full: source.full });
    const baked = new TrophyPlaques(gap, material, {});
    expect([baked.castShadow, baked.receiveShadow, baked.name]).toEqual([true, true, 'trophy-plaques']);
    for (const key of Object.keys(source.geometry.attributes)) expect(baked.geometry.getAttribute(key).array, key).toEqual(source.geometry.getAttribute(key).array);
    for (const [bear, boar] of [[false, false], [true, false], [true, true], [false, true], [false, false]] as const) {
      for (const [id, filled] of [['bear', bear], ['boar', boar]] as const) {
        original.set(source.full[id], filled); original.set(source.empty[id], !filled);
        baked.setFilled(id, filled); expect(baked.filled(id)).toBe(filled);
      }
      expect(baked.geometry.drawRange).toEqual(original.geometry.drawRange);
      expect(baked.geometry.getIndex()?.array).toEqual(original.geometry.getIndex()?.array);
    }
    for (const id of TROPHIES) {
      original.set(0, false);
      for (const other of TROPHIES) { original.set(source.empty[other], false); original.set(source.full[other], other === id); }
      baked.trophyOnly(id);
      expect(baked.geometry.drawRange).toEqual(original.geometry.drawRange);
      expect(baked.geometry.getIndex()?.array).toEqual(original.geometry.getIndex()?.array);
    }
    baked.geometry.dispose(); source.geometry.dispose();
  }
  material.dispose();
});

it('moves every vertex of the adjustable Explorer spacing together without changing colours or another copy', () => {
  const material = new MeshBasicMaterial(), base = new TrophyPlaques(PLAQUE_GAP, material, {});
  for (const gap of [0.4, 1.1, 1.6]) {
    const source = plaquesGeometry(gap), baked = new TrophyPlaques(gap, material, {});
    const original = source.geometry.getAttribute('position'), position = baked.geometry.getAttribute('position');
    expect(position.count).toBe(original.count);
    let maxError = 0;
    for (let v = 0; v < position.count; v++) {
      maxError = Math.max(maxError, Math.abs(position.getX(v) - original.getX(v)));
      expect(position.getY(v)).toBe(original.getY(v)); expect(position.getZ(v)).toBe(original.getZ(v));
    }
    // Moving a baked Float32 vertex incurs one rounding instead of the builder's intermediate Float32 translations.
    expect(maxError).toBeLessThan(0.000001);
    expect(baked.geometry.getAttribute('color').array).toEqual(source.geometry.getAttribute('color').array);
    expect(baked.geometry.getAttribute('normal').array).toEqual(base.geometry.getAttribute('normal').array);
    baked.geometry.dispose(); source.geometry.dispose();
  }
  const source = plaquesGeometry(PLAQUE_GAP);
  expect(base.geometry.getAttribute('position').array).toEqual(source.geometry.getAttribute('position').array);
  source.geometry.dispose();
  base.geometry.dispose(); material.dispose();
});

it('keeps each actual loose drop centred at the original shared mounting point', () => {
  const sky = { setupMaterial(_material: Material): void { /* Renderer-free material setup. */ }, csm: { lightDirection: new Vector3(0, -1, 0) } } as SkyRig;
  for (const id of TROPHIES) {
    const group = buildTrophy(modelContext(sky), id), mesh = group.children[0];
    expect(group.name).toBe(`trophy-${id}`);
    expect(mesh).toBeInstanceOf(TrophyPlaques);
    if (!(mesh instanceof TrophyPlaques)) throw new Error('Actual trophy drop mesh missing');
    expect(mesh.position.toArray()).toEqual([0, -(TROPHY_LAYOUT.mountY + (id === 'boar' ? 0.13 : 0.01)), -(TROPHY_LAYOUT.thickness + TROPHY_LAYOUT.panelOffset) - 0.04]);
    expect(mesh.filled(id)).toBe(true);
    expect(mesh.filled(id === 'bear' ? 'boar' : 'bear')).toBe(false);
    expect(mesh.geometry.drawRange.count).toBe(slots.ranges[slots.full[id]]?.count);
    mesh.geometry.dispose(); mesh.material.dispose();
  }
});
