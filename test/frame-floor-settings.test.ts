import { expect, test } from 'vitest';
// oxlint-disable-next-line import/no-nodejs-modules -- execute the serialized Safari init in isolated storage contexts
import { runInNewContext } from 'node:vm';
import { frameFloorSettingsCode, resetFrameFloorDebug } from '../scripts/frame-floor-settings.mjs';

function storage(): Pick<Storage, 'getItem' | 'setItem'> {
  const data = new Map<string, string>();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); } };
}
function read(saved: Pick<Storage, 'getItem'>, scope: string): unknown {
  return JSON.parse(saved.getItem(`wildshard.save.v2.${scope}`) ?? '{}') as unknown;
}

test('isolates successive Safari picks and clears omitted core and shard Debug rows', () => {
  const localStorage = storage(), sessionStorage = storage();
  localStorage.setItem('wildshard.save.v2.global', JSON.stringify({ reset: 2, keys: {
    settings: { v: 1, data: { graphMaterials: 'on', weather: 'rain' } }, hints: { v: 1, data: ['keep'] },
  } }));
  localStorage.setItem('wildshard.save.v2.device', JSON.stringify({ keys: {
    'debug.gridBootPrograms': { v: 1, data: 'pine-hollow' },
    'debug.plugin.pine-hollow.ring': { v: 1, data: 'on' }, devMode: { v: 1, data: true },
  } }));
  sessionStorage.setItem('wildshard.save.v2.session', JSON.stringify({ keys: {
    'debug.future': { v: 1, data: 'on' }, continuation: { v: 1, data: { score: 42 } },
  } }));
  const context = { localStorage, sessionStorage };
  runInNewContext(frameFloorSettingsCode({ graphMaterials: 'on', tier: 'phone', fps: 'auto' }), context);
  runInNewContext(frameFloorSettingsCode({ fixedShadowSamples: 'off', tier: 'phone', fps: 'auto' }), context);
  expect(read(localStorage, 'global')).toEqual({ reset: 2, keys: {
    settings: { v: 1, data: { fixedShadowSamples: 'off', tier: 'phone', fps: 'auto' } }, hints: { v: 1, data: ['keep'] },
  } });
  expect(read(localStorage, 'device')).toEqual({ keys: { devMode: { v: 1, data: true } } });
  expect(read(sessionStorage, 'session')).toEqual({ keys: { continuation: { v: 1, data: { score: 42 } } } });
});

test('refuses a reset when Safari storage cannot be written', () => {
  const localStorage = { getItem: () => null, setItem: () => { throw new Error('blocked'); } };
  expect(() => { runInNewContext(`(${resetFrameFloorDebug.toString()})()`, { localStorage }); }).toThrow('blocked');
});
