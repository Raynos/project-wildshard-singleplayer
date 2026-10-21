import { MountedArsenal } from '../src/game/loadout/mounted';
import loadout from '../src/shards/nalati-grasslands/boot/mountedLoadout.generated.json' with { type: 'json' };
import ARM_STYLE from '../src/shards/nalati-grasslands/data/armsStyle.json' with {type:'json'};
import heldWeapons from '../src/shards/nalati-grasslands/data/heldWeapons.generated.json' with {type:'json'};
// oxlint-disable-next-line import/no-nodejs-modules -- Compare the production GLB with retained source geometry.
import { readFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- The runtime URL must name its exact content-addressed bytes.
import { createHash } from 'node:crypto';
import { expect, test, vi } from 'vitest';
import { Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { gloveFist, riderArm } from '../src/engine/player/firstPersonArms';
import { installPortableMath } from './fake/portableMath';
import { merge } from '../src/shards/nalati-grasslands/generators/meleeGeo';
import { emptyShardfile } from '../src/sdk/author';
import { parseItems } from '../src/format/items';
import items from '../src/shards/nalati-grasslands/data/items.json' with { type: 'json' };
import rows from '../src/shards/nalati-grasslands/data/spear.generated.json' with { type: 'json' };

installPortableMath();
const { buildSpear: authorSpear, buildJavelin: authorJavelin, SPEAR_VIEW, SPEAR_PROFILE } = await import('../src/shards/nalati-grasslands/generators/spear');

const { polearm } = new MountedArsenal(loadout);

test('baked spear retains all geometry channels, poses, coefficients and independent copies', async () => {
  const bytes = readFileSync(`public${rows.pool.url}`);
  expect(rows.pool.url).toBe(`/assets/nalati/baked/${createHash('sha256').update(bytes).digest('hex')}.glb`);
  const gltf = await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '');
  const load = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(gltf);
  try {
    await polearm.prepare({ shardfile: { ...emptyShardfile({ slug: 'spear-test', name: 'Spear', author: 'Wildshard', revision: 1, seed: 1 }), items: parseItems(items) }, file: () => Promise.resolve(new TextEncoder().encode(JSON.stringify({...rows,program:heldWeapons.programs.polearm,presentation:heldWeapons.polearm}))) });
    expect(polearm.profile()).toEqual(SPEAR_PROFILE);
    const spear = authorSpear(), javelin = authorJavelin(), { hands, leftHandY } = SPEAR_VIEW;
    const fist = (direction: readonly [number, number, number], mirror: boolean) => {
      const d = new Vector3(...direction).normalize().applyQuaternion(SPEAR_VIEW.poses.rest.q.clone().invert());
      return gloveFist(ARM_STYLE, { R: hands.radius, mirror, yaw: Math.atan2(d.x, d.z) - Math.atan2(mirror ? -hands.splay : hands.splay, 1) });
    };
    const left = fist(hands.left, true), right = fist(hands.right, false);
    const expected = { 'spear-paint': spear.paint, 'spear-metal': spear.metal, 'javelin-paint': javelin.paint, 'javelin-metal': javelin.metal,
      'held-spear': merge([spear.paint.clone(), left.geometry.clone().translate(0, leftHandY, 0)]), 'right-fist': right.geometry,
      'left-arm': riderArm(ARM_STYLE, hands.sleeve, 2), 'right-arm': riderArm(ARM_STYLE, hands.sleeve, 1), 'world-javelin': merge([javelin.paint.clone(), javelin.metal.clone().deleteAttribute('uv')]) };
    for (const [name, original] of Object.entries(expected)) {
      const part = polearm.geometry(name), second = polearm.geometry(name);
      expect(Object.keys(part.attributes).sort()).toEqual(Object.keys(original.attributes).sort());
      for (const attribute of Object.keys(original.attributes)) expect(part.getAttribute(attribute).array).toEqual(original.getAttribute(attribute).array);
      expect(part.index?.array).toEqual(original.index?.array); expect(part.groups).toEqual(original.groups);
      expect(second).not.toBe(part); expect(second.getAttribute('color').array).not.toBe(part.getAttribute('color').array);
      part.dispose(); second.dispose(); original.dispose();
    }
    left.geometry.dispose();
    for (const [name, pose] of Object.entries(SPEAR_VIEW.poses)) expect(rows.view.poses[name as keyof typeof rows.view.poses]).toEqual({ pos: pose.pos.toArray(), q: pose.q.toArray() });
    expect(rows.view.wrists).toEqual({ left: left.wrist.clone().setY(left.wrist.y + leftHandY).toArray(), right: right.wrist.toArray() });
    const display = polearm.display('spear-paint', 'spear-metal'), projectile = polearm.display('javelin-paint', 'javelin-metal');
    for (const geometry of [display.paint, display.metal, projectile.paint, projectile.metal]) geometry.dispose();
  } finally { load.mockRestore(); }
});
