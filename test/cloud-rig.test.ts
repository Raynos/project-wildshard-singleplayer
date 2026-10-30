// @vitest-environment happy-dom
import { expect, test } from 'vitest';
import { MeshBasicMaterial, PerspectiveCamera, Scene, Vector3 } from 'three';
import { installWorldFixture } from './fixtures/worldSetup';
import { lendNalatiPasture } from './fixtures/nalati-return-modules';
import { titanPrograms as programs } from './fixtures/titanInlineWitness';
import { CloudBody } from '../src/game/boss/encounterView';
import { HeadlessCloudBody } from '../src/game/boss/cloudRig';
import { Scope } from '../src/engine/app/scope';
import { lendLooks } from '../src/game/shardfile/lentLooks';
import { parseArenaScriptData } from '@wildshard/format/arenaScriptRows';
import { parsePrivateScene } from '@wildshard/format/clientChannels';
import fireView from '../src/shards/nalati-grasslands/data/arenaFire.json' with { type: 'json' };
import * as titan from '../src/shards/nalati-grasslands/generators/stormTitanFight';
import { titanGeometryRows } from '../src/shards/nalati-grasslands/generators/stormTitanGeometry';
import { mockCanvas } from '@wildshard/engine/test/weaponParity';

// CI12 (sp-x8's native Titan): the headless cloud body (cloudRig.ts) poses the same parts as the page's CloudBody from the
// same rows, pose and ports: every part's world matrix, the focus (the heart the fight targets) and the shown flags.
await installWorldFixture();

test('the headless cloud body poses and focuses exactly as the page body', () => {
  mockCanvas();
  const scope = new Scope('cloud-rig'), materials = new Map(['nalati-titan-cloud', 'nalati-titan-flame', 'nalati-titan-smoke', 'nalati-tell'].map(id => [id, new MeshBasicMaterial()]));
  lendLooks(scope, { materials, setParam: () => undefined, setTexture: () => undefined, bindMeshMap: () => { throw new Error('No mapped materials'); },
    instance: () => ({ material: new MeshBasicMaterial(), setParam: () => undefined }) });
  lendNalatiPasture(scope);
  try {
    const data = parseArenaScriptData({ arenaScript: titan.TITAN_HOST, arenaFire: fireView, programs: { attack: programs.attack, wind: programs.wind } }, titanGeometryRows());
    const g = data.geometry;
    for (const tier of ['phone', 'desktop'] as const) {
      const rows = { ...g.body, geometry: { ...g.body.geometry, eyes: g.eyes }, poses: g.poses, puffs: { ...g.body.puffs, rows: g[tier].puffs } };
      const ports = new Map([['place', { ...data.arena.body, ground: 3.25 }]]);
      const pagePose: Record<string, number> = { ...data.pose }, nativePose: Record<string, number> = { ...data.pose };
      const page = new CloudBody(new Scene(), rows, pagePose, ports), native = new HeadlessCloudBody(rows, nativePose, ports), camera = new PerspectiveCamera();
      let seed = 11;
      const rnd = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      const a = new Vector3(), b = new Vector3();
      for (let frame = 0, t = 0; frame < 400; frame++) {
        if (frame % 37 === 0) { const on = rnd() < .8; page.setVisible(on); native.setVisible(on); }
        for (const key of Object.keys(pagePose)) { const value = (rnd() - .3) * 2; pagePose[key] = value; nativePose[key] = value; }
        t += rnd() * .05;
        page.update(t, camera); native.update(t, camera);
        expect(native.focusWorld(b).toArray()).toEqual(page.focusWorld(a).toArray());
        expect(native.focusPoint.toArray()).toEqual(page.focusPoint.toArray());
        expect(native.visible).toBe(page.visible);
        // every part's world matrix but the ring's (the page moves it onto the focus and turns it to the camera: drawn only)
        for (const node of parsePrivateScene(rows.scene).nodes) {
          if (node.id !== g.body.focus.ring) expect([node.id, ...native.part(node.id).matrixWorld.toArray()]).toEqual([node.id, ...page.part(node.id).matrixWorld.toArray()]);
          expect([node.id, native.part(node.id).visible]).toEqual([node.id, page.part(node.id).visible]);
        }
      }
    }
  } finally { scope.dispose(); for (const material of materials.values()) material.dispose(); }
});
