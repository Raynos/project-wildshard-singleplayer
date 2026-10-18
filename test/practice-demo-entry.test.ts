// @vitest-environment happy-dom
import { expect, test, vi } from 'vitest';
import { saveEnvironment } from '../src/engine/saves/environment';
import { replacePracticeCanvas } from '../src/practiceCanvas';
import { practiceAssetUrl } from '../src/practiceAssets';
import { practiceLevel } from '../src/practiceLevel';
import presentation from '../src/shards/driftwood-isle/data/practiceLooks.json';
import bodies from '../src/shards/driftwood-isle/data/creatureBodies.generated.json';

test('demo level has no world spawn, navigation, terrain or boot files', () => {
  const level = practiceLevel();
  expect(level.spawns).toEqual([]); expect(level.species).toEqual([]);
  expect(level.navigation).toBeUndefined(); expect(level.ground).toEqual({ structures: true });
  expect(level.boot.files).toEqual([]); expect(level.loadout.tools).toEqual([]);
  expect(level.creatureStyle).toBe('toon'); expect(level.creatures?.tintRange).toBe(0.3);
});

test('the explicit entry starts without graphics and installs memory-only saves', async () => {
  document.body.innerHTML = '<canvas id="game"></canvas><button id="practice-start"></button><select id="practice-opponent"></select><button id="practice-retry"></button><output id="practice-status"></output>';
  const graphics = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
  await import('../src/practice');
  expect(saveEnvironment().persistent()).toBe(false);
  expect(await saveEnvironment().persist()).toBe(false);
  expect(graphics).not.toHaveBeenCalled();
  graphics.mockRestore(); document.body.replaceChildren();
});


test('the demo presentation describes exactly five real packed creature rigs', () => {
  expect(presentation.looks.map(row => row.kind)).toEqual(['brine-puffer', 'conch-duelist', 'splinter-mantis', 'bellback', 'tideRootColossus']);
  for (const look of presentation.looks) {
    const body = bodies.bodies.find(row => row.kind === look.kind);
    expect(body).toBeDefined();
    for (const socket of look.rigContract.sockets) expect(body?.bones.some(bone => bone.name === socket)).toBe(true);
    expect(look.pose).toBe(`poses/${look.rigContract.skeleton.replace(/\.v1$/u, '')}.json`);
  }
});


test('demo assets stay within the page mount without intercepting global fetch', () => {
  expect(practiceAssetUrl('/assets/physics/rapier.wasm', 'https://example.test/practice/')).toBe('https://example.test/practice/assets/physics/rapier.wasm');
  expect(practiceAssetUrl('/assets/models/arms.glb', 'https://example.test/practice/index.html')).toBe('https://example.test/practice/assets/models/arms.glb');
  expect(practiceAssetUrl('/assets/body.bin', 'https://example.test/')).toBe('https://example.test/assets/body.bin');
  expect(() => practiceAssetUrl('https://other.test/file', 'https://example.test/practice/')).toThrow('Unexpected practice asset path');
});


test('failed boot replaces only its disposed canvas and preserves page controls', () => {
  const canvas = document.createElement('canvas'); canvas.id = 'game'; canvas.width = 804; canvas.height = 1748;
  const control = document.createElement('button'); document.body.append(canvas, control);
  const replacement = replacePracticeCanvas(canvas);
  expect(replacement).not.toBe(canvas); expect(canvas.isConnected).toBe(false);
  expect(replacement.id).toBe('game'); expect(replacement.width).toBe(804); expect(replacement.height).toBe(1748);
  expect(control.isConnected).toBe(true); expect(document.querySelectorAll('canvas')).toHaveLength(1);
  document.body.replaceChildren();
});
