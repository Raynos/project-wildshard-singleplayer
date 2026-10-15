import { expect, test } from 'vitest';
import { Bone, BufferGeometry, MeshStandardMaterial, SkinnedMesh, Vector3 } from 'three';
import { Animal } from '../src/engine/entities/AnimalView';
import { AnimalSim } from '../src/engine/entities/AnimalSim';
import type { AnimalModel } from '../src/engine/entities/AnimalFactory';
import { speciesWithLook, type SpeciesLook } from '../src/engine/entities/species/look';
import type { SpeciesRow } from '../src/engine/ai/species';
import type { ThinkCtx } from '../src/engine/entities/species/registry';
import { Rng } from '../src/engine/core/rng';
import { speciesBrains } from '../src/sdk/speciesBrains';
import { DRIFTWOOD_ENEMY_SPECIES } from '../src/shards/driftwood-isle/data/enemySpecies';
import { CRAB, CRAB_LOOK } from '../src/shards/driftwood-isle/species/crab';
import { SAILOR, SAILOR_LOOK } from '../src/shards/driftwood-isle/species/sailor';
import { MONKEY, MONKEY_LOOK } from '../src/shards/driftwood-isle/species/monkey';

function body(row: SpeciesRow, look: SpeciesLook): { actor: Animal; dispose: () => void } {
  const variant = row.variants[0];
  if (variant === undefined) throw new Error('Test body needs a variant');
  const geometry = new BufferGeometry(), material = new MeshStandardMaterial(), mesh = new SkinnedMesh(geometry, material);
  const root = new Bone(), head = new Bone(); root.add(head); mesh.add(root);
  const model: AnimalModel = {
    kind: row.kind, variant: variant.id, style: 'toon', species: speciesWithLook(row, look), variantDef: variant,
    render: { lowPoly: true, waitForModels: false, furRim: false, tintRange: 0, oneMaterial: true },
    geometry, bones: [], dims: { bodyY: 1, bodyHalfLen: .5, bodyRadius: .3, headRadius: .2, legLen: 1, feet: [], halfWidth: .3 },
    fur: material, hard: material, eye: material, shells: [],
  };
  const actor = new Animal({ mesh, bones: { body: root, head }, materials: [material] }, model, .5);
  actor.bindSimulation(new AnimalSim({ kind: row.kind, label: actor.label, variant: variant.id, rarity: variant.rarity,
    hp: actor.maxHp, aggressive: actor.aggressive, dims: model.dims, mods: actor.mods,
  }, .5, 1, actor.entityId, { heightAt: () => 0, random: () => .5 }));
  return { actor, dispose: () => { geometry.dispose(); material.dispose(); } };
}
function context(): ThinkCtx {
  return {
    dt: .1, t: 0, player: new Vector3(0, 0, 1), playerSpeed: 0, rng: new Rng(357), calm: false, herd: null, world: {},
    hurt: () => undefined, sound: () => undefined, heightAt: () => 0, waterLevel: () => 0,
    steer: (a, yaw, speed, turn) => { a.setMotion(yaw, speed, turn); },
    flight: { steer: (a, yaw, speed, altitude, turn) => { a.fly(yaw, speed, altitude, turn); } },
    pathYaw: (a, x, z) => Math.atan2(x - a.position.x, z - a.position.z),
    confine: () => undefined, reach: () => true, claim: () => true, mayAttack: () => true,
  };
}

test('the species host constructs once on the first act and keeps subsequent contexts live', () => {
  const made = body(CRAB, CRAB_LOOK), catalogue = speciesBrains(DRIFTWOOD_ENEMY_SPECIES, []);
  const first = context(), later = context(), constructions: ThinkCtx[] = [], calls: ThinkCtx[] = [];
  const bound = catalogue.bind('crab', (_actor, _decision, initial) => {
    if (initial === undefined) throw new Error('Missing first context');
    constructions.push(initial);
    return { think: ctx => { calls.push(ctx); }, act: ctx => { calls.push(ctx); } };
  });
  try {
    expect(constructions).toEqual([]); expect(catalogue.witness(made.actor)).toBeNull();
    bound.act(made.actor, first); bound.think(made.actor, later); bound.act(made.actor, later);
    expect(constructions).toEqual([first]); expect(calls).toEqual([first, later, later]);
    expect(catalogue.witness(made.actor)).toBe('skirmisher');
  } finally { made.dispose(); }
});

test('monkey first-act allocation draws no decisions and later decisions see the current perch world', () => {
  const made = body(MONKEY, MONKEY_LOOK), first = context();
  try {
    const before = first.rng.snapshot(); MONKEY.act?.(made.actor, first);
    expect(first.rng.snapshot()).toEqual(before); expect(made.actor.mem['init']).toBeUndefined();
    const later = { ...context(), player: new Vector3(50, 0, 0), world: { perches: [new Vector3(7, 5, 0)] } };
    MONKEY.think?.(made.actor, later);
    expect(made.actor.mem['px']).toBe(7);
    const saved = made.actor.snapshot(); made.actor.mem['init'] = 0;
    MONKEY.think?.(made.actor, { ...later, world: { perches: [new Vector3(9, 6, 0)] } });
    expect(made.actor.mem['px']).toBe(9);
    made.actor.restore(saved);
    expect(made.actor.mem['px']).toBe(7);
  } finally { made.dispose(); }
});

test('bound crab and sailor bodies keep once-only strikes and restored attack memory', () => {
  for (const [row, look] of [[CRAB, CRAB_LOOK], [SAILOR, SAILOR_LOOK]] as const) {
    const made = body(row, look), ctx = context(), hits: number[] = [];
    ctx.hurt = damage => { hits.push(damage); };
    try {
      made.actor.mem['st'] = 2; made.actor.mem['hit'] = 0; made.actor.startAttack(.9); made.actor.step(.7);
      const saved = made.actor.snapshot();
      row.act?.(made.actor, ctx); expect(hits.some(damage => damage > 0)).toBe(true);
      hits.length = 0; row.act?.(made.actor, ctx); expect(hits).toEqual([]);
      made.actor.restore(saved); row.act?.(made.actor, ctx);
      expect(hits.some(damage => damage > 0)).toBe(true);
    } finally { made.dispose(); }
  }
});
