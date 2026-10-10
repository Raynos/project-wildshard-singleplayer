// @vitest-environment happy-dom
import * as THREE from 'three';
import ts from '@typescript/typescript6';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/engine/app/runtime';
import { App } from '../../src/engine/app/app';
import { Scope } from '../../src/engine/app/scope';
import { withOwner } from '../../src/engine/app/ownership';
import { Weapon } from '../../src/engine/combat/Weapon';
import type { SwordArms } from '../../src/engine/combat/view/melee';
import type { Actor } from '../../src/engine/combat/pipeline';
import { ordinaryShardManifests, primaryShardManifest } from '../../src/game/shard/legacy';
import { shards } from '../../src/game/shard/list';
import { toLevelSpec } from '../../src/game/shard/spec';
import { installDeclaredItems } from '../../src/game/shardfile/items';
import { declaredKitItemFamilies } from '../../src/game/systems/items/declared';
import { Sword } from '../../src/game/weapons/Sword';
import { EmptyEquipment } from '../../src/game/shardfile/emptyEquipment';
import { SWORD_WOOD, SWORD_IRON } from '../../src/game/weapons/starterMeleeProfile';
import { swordRig } from '../../src/shards/driftwood-isle/weapons/swordView';
import { WarFan } from '../../src/shards/far-reach/weapons/WarFan';
import { buildNalatiLoadout } from '../../src/shards/nalati-grasslands/weapons/loadout';
import { JIAN_ROW } from '../../src/shards/nine-dragon-stack/vm/jianRow';
import { swordSupport, buildSword as buildSupportSword, swordMaterial } from '../../src/shards/nine-dragon-stack/vm/swordSupport';
import { Crossbow } from '../../src/shards/pine-hollow/runtime/weapons/crossbow/Crossbow';
import { CROSSBOW } from '../../src/shards/pine-hollow/weapons/equipment';
import { Bullwhip } from '../../src/shards/sunscar-dunes/weapons/Bullwhip';
import { ITEMS } from '../../src/shards/_template/data/items';
import { ITEMS as PASTEL_ITEMS } from '../../src/shards/pastel-plain/data/items';
import { fakeWorld } from '../fake/world';
import { legacyDouble } from '../fake/FakeGame';
import { buildSword as buildOriginalSword } from '../../src/game/systems/items/declaredSword';
import { descendants, executeLegacy, legacySource } from '../fake/legacySource';

/** Execute the actual caller's constructor expression, including its options/spreads. Unrelated world/audio stages
 * stay outside this constructor test; no equipment constructor or model builder is stubbed. */
function callerWeapons(file: string, name: string, globals: Record<string, unknown>): Weapon[] {
  const source = legacySource(file);
  const calls = descendants(source, (node) => ts.isNewExpression(node) && node.expression.getText(source) === name);
  expect(calls.length).toBeGreaterThan(0);
  return calls.map((call) => {
    const weapon = executeLegacy(call.getText(source), globals);
    if (!(weapon instanceof Weapon)) throw new Error(`${file}: ${name} did not construct equipment`);
    return weapon;
  });
}
interface Fixture { scope: Scope; services: App; world: ReturnType<typeof fakeWorld> }
const emptyTargets = { raycast: () => null };
const constructors: Record<string, (fixture: Fixture) => readonly Weapon[]> = {
  'blender-template': () => [new EmptyEquipment()],
  'driftwood-isle': ({ world: f }) => callerWeapons('src/shards/driftwood-isle/runtime/loadout.ts', 'Sword', {
    Sword, world: { ...f, game: f.game.asGame() }, targets: emptyTargets, nolock: true,
    wood: SWORD_WOOD, iron: SWORD_IRON, swordRig, woodArms: {}, ironArms: undefined,
  }),
  'far-reach': ({ services }) => callerWeapons('src/shards/far-reach/runtime/index.ts', 'WarFan', {
    WarFan, ctx: { app: services }, targets: () => [],
  }),
  'nalati-grasslands': ({ world: f }) => {
    const kit = buildNalatiLoadout({ ...f, game: f.game.asGame() }, emptyTargets, true);
    return [kit.base, ...kit.extras];
  },
  'nine-dragon-stack': ({ world: f }) => {
    // Nine's successful GLB arm loader returns only arms. This is the production path that lost its default rig.
    const arms: SwordArms = { root: new THREE.Group(), engineTrail: false, play: () => undefined,
      update: () => undefined, blade: (base, tip) => { base.set(0, -0.2, -0.5); tip.set(0, 0.5, -1); } };
    return callerWeapons('src/shards/nine-dragon-stack/plugin.ts', 'Sword', {
      Sword, world: { ...f, game: f.game.asGame() }, targets: emptyTargets, JIAN_ROW, nolock: true,
      ownSword: { arms }, swordSupport,
    });
  },
  'pine-hollow': ({ world: f }) => callerWeapons('src/shards/pine-hollow/runtime/index.ts', 'Crossbow', {
    Crossbow, world: { ...f, game: f.game.asGame() }, targets: emptyTargets, CROSSBOW, nolock: true,
  }),
  'sunscar-dunes': ({ services }) => callerWeapons('src/shards/sunscar-dunes/plugin.ts', 'Bullwhip', {
    Bullwhip, ctx: { app: services }, targets: emptyTargets,
  }),
  '_template': (fixture) => declaredPrimary(ITEMS, fixture),
  // SF59's pastel fixture is a template copy: the same declared whip and lantern rows under its own ids
  'pastel-plain': (fixture) => declaredPrimary(PASTEL_ITEMS, fixture),
};
/** a template-style shard's primary and secondary, installed from its declared item rows */
function declaredPrimary(items: typeof ITEMS | typeof PASTEL_ITEMS, { services, scope }: Fixture): readonly Weapon[] {
  const actor: Actor = { id: 'actor.player', tags: ['actor.player'], state: [], attributes: { health: 100, maxHealth: 100 },
    alive: true, applyDamage: () => false };
  services.input.register({ id: 'weapon.melee', actions: ['attack', 'heavy', 'lock'], keys: { attack: ['Mouse0'], heavy: ['Mouse2'] } }, scope);
  const equipment = installDeclaredItems(items, { scope, actorId: actor.id, input: services.input,
    aim: () => ({ origin: { x: 0, y: 1.6, z: 0 }, direction: { x: 0, y: 0, z: -1 } }),
    families: declaredKitItemFamilies(), icon: (id) => { if (id === 'sword' || id === 'glyph') return id; throw new Error(`Unknown icon ${id}`); },
    runtime: () => ({ actor, combat: services.combat, targets: () => [], hook: (input) => input.action, effect: () => undefined }) });
  if (equipment.primary === null) throw new Error('Template primary missing');
  return [equipment.primary, ...(equipment.secondary === null ? [] : [equipment.secondary])];
}

// happy-dom has no 2D raster backend. Keep its DOM and execute the real procedural texture generator against a
// pixel-buffer canvas port; stroke/fill presentation is outside this constructor/rig check, not a texture parity claim.
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
    let pixels: ImageData = { data: new Uint8ClampedArray(0), width: 0, height: 0, colorSpace: 'srgb' };
    const context: Partial<CanvasRenderingContext2D> = {
      createImageData: (input: number | ImageData, requestedHeight?: number) => {
        const width = typeof input === 'number' ? input : input.width;
        const height = typeof input === 'number' ? requestedHeight : input.height;
        if (height === undefined) throw new Error('Canvas height missing');
        return { data: new Uint8ClampedArray(width * height * 4), width, height, colorSpace: 'srgb' };
      },
      putImageData: (data) => { pixels = data; }, getImageData: () => pixels,
      strokeStyle: '', fillStyle: '', lineWidth: 1, beginPath: () => undefined, moveTo: () => undefined,
      lineTo: () => undefined, arc: () => undefined, stroke: () => undefined, fill: () => undefined,
    };
    return legacyDouble<CanvasRenderingContext2D>(context);
  });
});
afterEach(() => { vi.restoreAllMocks(); });

describe('every discovered shard primary equipment constructs', () => {
  it('keeps the original wood support vertices, blade landmarks and material', () => {
    const actual = buildSupportSword('wood'), original = buildOriginalSword('wood');
    try {
      expect(actual.tipY).toBe(original.tipY); expect(actual.baseY).toBe(original.baseY);
      for (const part of ['sword', 'arms'] as const) for (const attribute of ['position', 'normal', 'color']) {
        expect(actual[part].getAttribute(attribute).array).toEqual(original[part].getAttribute(attribute).array);
      }
      const material = swordMaterial(fakeWorld().sky, 'wood');
      try {
        expect({ name: material.name, flatShading: material.flatShading, vertexColors: material.vertexColors,
          roughness: material.roughness, metalness: material.metalness, envMapIntensity: material.envMapIntensity })
          .toEqual({ name: 'sword', flatShading: true, vertexColors: true, roughness: 0.82, metalness: 0, envMapIntensity: 0.6 });
      } finally { material.dispose(); }
    } finally { actual.sword.dispose(); actual.arms.dispose(); original.sword.dispose(); original.arms.dispose(); }
  });
  it('covers the unfiltered shard list, including hidden and DEVSERVER entries', () => {
    expect(Object.keys(constructors).sort()).toEqual(ordinaryShardManifests(shards()).map((manifest) => manifest.slug).sort());
  });
  it.each(shards())('$slug primary and local sword variants construct without a GPU', (manifest) => {
    const construct = constructors[primaryShardManifest(shards(), manifest).slug];
    if (construct === undefined) throw new Error(`Missing primary equipment fixture for ${manifest.slug}`);
    const scope = new Scope(`primary:${manifest.slug}`), services = new App(), world = fakeWorld(), rng = app.rng.snapshot();
    const game = world.game.asGame(); Reflect.set(game, 'level', toLevelSpec(manifest));
    // asGame creates fresh boundary objects; callers receive this same level-aware boundary.
    world.game.asGame = () => game;
    try {
      const weapons = withOwner(scope, () => construct({ scope, services, world }));
      expect(weapons.length).toBeGreaterThan(0);
      for (const weapon of weapons) {
        const model = weapon.model;
        if (!(model instanceof THREE.Group)) throw new Error('Primary model is not a group');
        if (weapon instanceof EmptyEquipment) { expect(model.children).toHaveLength(0); expect(weapon.enabled).toBe(false); }
        else expect(model.children.length).toBeGreaterThan(0);
        expect(weapon.row.id).toMatch(/^weapon\./u); weapon.install({ scope });
      }
      if (manifest.slug === 'nine-dragon-stack') {
        const primary = weapons[0]; if (primary === undefined) throw new Error('Jian missing');
        expect(primary.row.id).toBe(JIAN_ROW.id);
        expect(primary.reach).toBe(JIAN_ROW.reach);
        // The animated jian remains the visible view; its rigid support stays hidden exactly as before extraction.
        const model = primary.model;
        if (!(model instanceof THREE.Group)) throw new Error('Jian model is not a group');
        expect(model.children.filter((child) => child instanceof THREE.Group && !child.visible)).toHaveLength(2);
      }
    } finally { scope.dispose(); services.engineScope.dispose(); app.rng.restore(rng); }
  });
});
