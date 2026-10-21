import * as THREE from 'three';
import * as v from 'valibot';
import { expect, test } from 'vitest';
import { BossSocketRigSchema } from '../src/format/bossSocketRig';
import { RoamingCombatSchema } from '../src/format/roamingCombat';
import { BossSocketRig } from '../src/game/boss/socketRig';
import { SceneHandles } from '../src/game/shardfile/sceneHandles';
import { manager } from './fake/manager';
import { overrideTerrain } from './fake/terrain';
import collision from '../src/shards/pine-hollow/data/kingCollision.generated.json' with { type: 'json' };
import { ROAMING_COMBAT, ROAMING_COMBAT_BLOB } from '../src/shards/pine-hollow/generators/roamingCombat';

/** Independent orchard boss view: a fruit rack on the native head and a core
 * on a borrowed torso socket, with different opening and emission rows. */
function orchardRig() {
  return v.parse(BossSocketRigSchema, {
    id: 'orchard.rig', pool: { url: 'models/orchard.glb', parts: ['fruit'] }, collision: { joints: collision.joints, volumes: collision.volumes },
    materials: [{ id: 'glow', colour: [0, 0, 0], emissive: [1, .2, .1], gain: 3, roughness: .7, metalness: 0, lit: false, fog: false }],
    attachments: [{ id: 'fruit', name: 'fruit-rack', socket: 'head', at: [.5, .2, 0], meshes: [{ id: 'fruit.mesh', geometry: 'fruit', material: 'glow' }] },
      { id: 'heart', name: 'orchard-heart', socket: 'orchard.torso', at: [0, .4, 0], meshes: [{ id: 'heart.core', geometry: 'fruit', material: 'glow' }] }],
    hazards: ['fruit'], focus: 'heart', radius: .5, glow: [{ material: 'glow', gain: 3 }],
    opening: [{ part: 'heart.core', scale: [.2, .4, .6], breathe: [0, 0, 0], frequency: 0 }], emission: [{ material: 'glow', base: 2, open: 5 }],
  });
}

test('orchard sockets stay on the actual body and retire without disposing borrowed sources', () => {
  const restoreTerrain = overrideTerrain({ heightAt: () => 0, normalAt: () => [0, 1, 0], waterLevel: () => -100 });
  const f = manager(), actor = f.manager.spawn('boar', 2, 4, 0), torso = new THREE.Group(); torso.name = 'orchard.torso'; actor.mesh.add(torso);
  const source = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial(), resources = new SceneHandles(f.sky);
  resources.publish('fruit', source); resources.publish('glow', material);
  const previous: unknown = Reflect.get(actor, 'headWorld'), rig = new BossSocketRig(actor, orchardRig(), resources);
  try {
    const fruit = actor.mesh.getObjectByName('fruit-rack'), heart = actor.mesh.getObjectByName('orchard-heart');
    if (fruit === undefined || heart === undefined) throw new Error('Missing actual socket attachments');
    expect(fruit.parent?.name).toBe('head'); expect(heart.parent).toBe(torso);
    expect(rig.hazardWorld(0, new THREE.Vector3()).toArray()).toEqual(fruit.getWorldPosition(new THREE.Vector3()).toArray());
    const focus = rig.focusWorld(new THREE.Vector3()); expect([focus.x, focus.y, focus.z].every(Number.isFinite)).toBe(true);
    expect(rig.focusRadius).toBe(.5 * actor.scale);
    rig.setHazardsHung(false); expect(fruit.visible).toBe(false); rig.setHazardsHung(true); expect(fruit.visible).toBe(true);
    rig.setGlow(.5); expect(material.emissiveIntensity).toBe(1.5); rig.setOpen(1, 0);
    expect(heart.children[0]?.scale.toArray()).toEqual([1.2, 1.4, 1.6]); expect(material.emissiveIntensity).toBe(3.5);
    rig.dispose(); expect(Reflect.get(actor, 'headWorld')).toBe(previous); expect(actor.mesh.getObjectByName('fruit-rack')).toBeUndefined();
    expect(source.getAttribute('position').count).toBeGreaterThan(0);
  } finally { rig.dispose(); f.manager.retire(actor); source.dispose(); material.dispose(); restoreTerrain(); }
});

test('real roaming rows admit as named JSON and refuse callbacks or unknown sockets', () => {
  expect(ROAMING_COMBAT_BLOB.file.name).toBe('combat/roaming.json'); expect(ROAMING_COMBAT_BLOB.file.jsonSchema).toBeDefined();
  expect(v.parse(RoamingCombatSchema, JSON.parse(new TextDecoder().decode(ROAMING_COMBAT_BLOB.bytes)))).toEqual(ROAMING_COMBAT);
  expect(() => v.parse(RoamingCombatSchema, { ...ROAMING_COMBAT, reward: { ...ROAMING_COMBAT.reward, grant: () => undefined } })).toThrow('JSON');
  const restoreTerrain = overrideTerrain({ heightAt: () => 0, normalAt: () => [0, 1, 0], waterLevel: () => -100 });
  const f = manager(), actor = f.manager.spawn('boar', 0, 0, 0), resources = new SceneHandles(f.sky);
  try { expect(() => new BossSocketRig(actor, orchardRig(), resources)).toThrow('socket'); }
  finally { f.manager.retire(actor); restoreTerrain(); }
});
