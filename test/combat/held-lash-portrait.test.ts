// @vitest-environment happy-dom
// oxlint-disable-next-line import/no-nodejs-modules -- Load the real shipping hero GLB and retained cord bake.
import { readFileSync } from 'node:fs';
import { beforeAll, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { App } from '../../src/engine/app/app';
import { Scope } from '../../src/engine/app/scope';
import type { EquipmentHost } from '../../src/engine/combat/view/EquipmentHost';
import type { Player } from '../../src/engine/player/Player';
import { Bullwhip } from '../../src/shards/sunscar-dunes/weapons/Bullwhip';
import { loadBakedWorld } from '../../src/shards/sunscar-dunes/world/baked';
import { duneHd, preloadDuneMeshes } from '../../src/shards/sunscar-dunes/world/meshes';
import { FakeGame, legacyDouble } from '../fake/FakeGame';
import { mockCanvas, portraitHeldFrame, portraitSequenceHash, digest } from '../fake/weaponParity';

beforeAll(async () => {
  const parser = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  vi.stubGlobal('fetch', (input: unknown) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.startsWith('blob:') || url.startsWith('data:')) return Promise.resolve(new Response(new Uint8Array(1)));
    return Promise.resolve(new Response(readFileSync(`public${new URL(url, 'http://localhost').pathname}`)));
  });
  vi.stubGlobal('createImageBitmap', () => Promise.resolve({ width: 1, height: 1, close: () => undefined }));
  const loaded = vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(url => {
    const bytes = readFileSync(`public${new URL(url, 'http://localhost').pathname}`);
    return parser.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  });
  try { await preloadDuneMeshes(); await loadBakedWorld(); }
  finally { loaded.mockRestore(); vi.unstubAllGlobals(); }
  if (duneHd('glove-hd4', { size: .14, by: 'span' }) === null) throw new Error('Portrait proof requires the loaded hero glove');
});

it('keeps every shipping glove, grip, cord and caught-wrap draw in the 390x844 portrait sequence', () => {
  mockCanvas();
  const app = new App(), scope = new Scope('held-portrait'), fake = new FakeGame(), game = fake.asGame();
  app.levelScope = scope; app.setState('play');
  const aim = { origin: { x: 0, y: 1.68, z: 0 }, direction: { x: 0, y: 0, z: -1 } };
  const host: EquipmentHost = { game, physics: legacyDouble({}), viewmodel: fake.viewmodel,
    player: legacyDouble<Player>({ sampleAimCommand: () => ({ origin: { ...aim.origin }, direction: { ...aim.direction } }) }),
    arms: null, lock: legacyDouble({}), toast: () => undefined, enabled: () => true };
  app.registerEquipmentHost(host, scope);
  const whip = new Bullwhip(app), frames: string[] = [], events: unknown[] = [];
  if (whip.parts.restCoil) throw new Error('Portrait proof must not use the hand-less fallback');
  whip.install({ scope });
  whip.onSwing = heavy => { events.push(['swing', heavy]); };
  whip.onFire = () => { events.push(['fire']); };
  whip.aimAt([{ at: new Vector3(0, 1.4, -5), radius: .8, crack: (heavy, second) => { events.push(['crack', heavy, second]); return true; } }]);
  try {
    for (let i = 0; i < 390; i++) {
      const dt = i % 23 === 0 ? .05 : i % 11 === 0 ? 1 / 30 : 1 / 60;
      if ([0, 60, 180, 280].includes(i)) app.input.press('attack');
      if ([30, 100, 220].includes(i)) app.input.press('heavy');
      whip.adsHeld = i >= 120 && i < 150;
      whip.holster = i >= 320 && i < 335 ? 1 : 0;
      if (i === 250) whip.enabled = false;
      if (i === 265) whip.enabled = true;
      const yaw = i < 200 ? 0 : Math.sin(i * .023) * .4;
      aim.direction = { x: -Math.sin(yaw), y: 0, z: -Math.cos(yaw) };
      whip.update(dt);
      frames.push(portraitHeldFrame([whip.model, ...game.scene.children.filter(child => child.type === 'Mesh')]));
    }
    expect(events.some(e => Array.isArray(e) && e[0] === 'crack' && e[1] === true)).toBe(true);
    const sequence = portraitSequenceHash(frames), outcomes = digest(JSON.stringify(events));
    expect(sequence).toBe('a487c11e88d45473b905e22ef8672b1ea42143afacc2954d7f2c4841ec9ef8dd'); expect(outcomes).toBe('92b01750');
  } finally { scope.dispose(); app.engineScope.dispose(); vi.restoreAllMocks(); }
});
