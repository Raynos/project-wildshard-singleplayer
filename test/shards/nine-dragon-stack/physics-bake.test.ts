import { expect, it } from 'vitest';
import baked from '../../../src/shards/nine-dragon-stack/data/physics.generated.json';
import { ninePhysics } from '../../../src/shards/nine-dragon-stack/generators/physics';
import { NINE_HOOKS, NINE_PIECES } from '../../../src/shards/nine-dragon-stack/runtime/headless';
import { RIM_Z } from '../../../src/shards/nine-dragon-stack/runtime/grapple';
import { RIM } from '../../../src/shards/nine-dragon-stack/world/wellBounds';
import { portalFloorRows } from '../../../src/shards/nine-dragon-stack/world/floorRows';

it('is the fresh product of the authored rows (G350-ND: generators/physics.ts, no runtime run)', () => {
  expect(JSON.stringify(ninePhysics())).toBe(JSON.stringify(baked));
  expect(baked.version).toBe(1);
  expect(baked.notice).toContain('DO NOT EDIT');
});

it('captures the fragment\'s floors, fronts, crossings and safety cap, and every placed model\'s colliders', () => {
  const ids = NINE_PIECES.map(piece => piece.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ['nds-floors', 'nds-fronts', 'nds-crossings', 'nds-grapple-guard']) expect(NINE_PIECES.find(piece => piece.id === id)?.colliders.length).toBeGreaterThan(0);
  // the Well's safety cap stands at load (NdRuntime.guardOpen is false until the Fei Zhua opens it)
  expect(NINE_PIECES.find(piece => piece.id === 'nds-grapple-guard')?.active).toBe(true);
  // the placed models register their own colliders (engine/models/place.ts), beyond the world's five named pieces
  expect(NINE_PIECES.length).toBeGreaterThan(10);
});

it('bakes the five declared portal floors as the very boxes the shardfile declares, each answering to its declared id', () => {
  for (const row of portalFloorRows()) {
    const piece = NINE_PIECES.find(entry => entry.colliderOwner === row.id);
    expect(piece?.id).toBe(`nds-${row.id}`);
    expect(piece?.colliders).toEqual(row.shapes);
  }
});

it('bakes the Fei Zhua\'s dragon hooks, and the headless grapple\'s Well rim is the world plan\'s', () => {
  // the hooks the page's course bites (nd.grapple), one per placed dragon ring, all within the stack (the Well's shaft below the square's +125 m, the towers above)
  expect(NINE_HOOKS.length).toBe(31);
  expect(baked.hooks).toHaveLength(NINE_HOOKS.length);
  for (const hook of NINE_HOOKS) { expect(hook.y).toBeGreaterThan(50); expect(hook.y).toBeLessThan(170); }
  // runtime/grapple.ts keeps its own copy of the south rim line (world/well-plan.ts is renderer-bound)
  expect(RIM_Z).toBe(RIM.z0);
});
