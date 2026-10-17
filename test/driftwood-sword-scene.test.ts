import { expect, test } from 'vitest';
import * as v from 'valibot';
import { BoxGeometry, MeshBasicMaterial } from 'three';
import { isMesh } from '@wildshard/engine/combat/view/ranged';
import { parsePrivateScene } from '@wildshard/format/clientChannels';
import recipe from '../src/shards/driftwood-isle/data/ironSwordScene.json' with { type: 'json' };
import { SECTIONS } from '../src/shards/driftwood-isle/runtime/sections';
import { driftwoodRows } from '../src/shards/driftwood-isle/runtime/boot/rows';
import { fixedDraw } from '../src/shards/driftwood-isle/runtime/boot/modelGeometry';
import { buildIronSwordDisplay } from '../src/shards/driftwood-isle/runtime/fpArms';
import { FP_ARMS_MATERIALS } from '../src/shards/driftwood-isle/runtime/const';
import { admitDriftwoodFixtureRows } from './fixtures/driftwoodRows';

test('the admitted iron sword keeps its authored scene, material loans and owned buffers', async () => {
  admitDriftwoodFixtureRows();
  const rows = driftwoodRows('custom/fixedLayouts');
  expect(rows.ironSword).toEqual(parsePrivateScene(recipe));
  expect(() => v.parse(SECTIONS['custom/fixedLayouts'], { ...rows, ironSword: undefined })).toThrow();
  const geometry = new BoxGeometry(0.1, 0.7, 0.1), blade = new MeshBasicMaterial(), fittings = new MeshBasicMaterial();
  await Promise.all([fixedDraw('ironSwordBlade').load(geometry), fixedDraw('ironSwordFittings').load(geometry)]);
  const materials = new Map([[FP_ARMS_MATERIALS.pickupBlade, blade], [FP_ARMS_MATERIALS.pickupFittings, fittings]]);
  const first = buildIronSwordDisplay(materials), second = buildIronSwordDisplay(materials);
  expect(first.children).toHaveLength(2);
  for (const [i, child] of first.children.entries()) {
    const copy = second.children[i];
    if (!isMesh(child) || copy === undefined || !isMesh(copy)) throw new Error('Sword parts must be meshes');
    expect(child.position.toArray()).toEqual([0, -0.36, 0]);
    expect(child.castShadow && child.receiveShadow).toBe(true);
    expect(child.material).toBe(i === 0 ? blade : fittings);
    expect(child.geometry.getAttribute('position').array).toEqual(copy.geometry.getAttribute('position').array);
    expect(child.geometry.getAttribute('position').array.buffer).not.toBe(copy.geometry.getAttribute('position').array.buffer);
    child.geometry.dispose(); copy.geometry.dispose();
  }
  expect(() => buildIronSwordDisplay(new Map())).toThrow('requires its graph materials');
  geometry.dispose(); blade.dispose(); fittings.dispose();
});
