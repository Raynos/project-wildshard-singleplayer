// @vitest-environment happy-dom
import { Group, Vector3 } from 'three';
import { expect, test, vi } from 'vitest';
import { Scope } from '../src/engine/app/scope';
import { defineModel } from '../src/engine/models/model';
import { WorldRegistry } from '../src/engine/world/registry';
import { SkyRig } from '../src/engine/world/skyRig';
import { Flags } from '../src/engine/world/interact/flags';
import type { Interactable } from '../src/engine/world/interact/types';
import { installQuestTrader, type TraderShop } from '../src/game/quest/trader';
import { parseQuestPageInteractions } from '../src/format/questInteractions';
import driftwood from '../src/shards/driftwood-isle/data/traderStall.json';
import pine from '../src/shards/pine-hollow/data/traderStall.json';
import { TRADER_PAGE } from '../src/shards/driftwood-isle/generators/traderPage';

function panel(): TraderShop & { opens: number } {
  let open = false;
  return { get isOpen() { return open; }, opens: 0, open() { open = true; this.opens++; }, close() { open = false; } };
}

test('Maren keeps placement, readiness, facing, offer and walking-close pitch restoration', () => {
  const scope = new Scope('trader-entry'), registry = new WorldRegistry(), prompts: Interactable[] = [];
  const frames: ((dt: number, time: number) => void)[] = [], systems: string[] = [];
  const model = defineModel<object>({ id: 'shared/trader-fixture', name: 'Trader fixture', category: 'people', pipeline: 'code', file: 'test/quest-trader.test.ts', defaults: {}, build: () => new Group() });
  const offer = vi.fn(), update = vi.fn(), dispose = vi.fn(), companions: Group[] = [];
  const player = { position: new Vector3(10, 2, 20), yaw: 0.8, pitch: 0.4 };
  const stall = installQuestTrader(driftwood, { player, placed: { scope, sky: SkyRig.prototype, registry,
    owners: new Map<string, unknown>([['placement', { place: (at: { x: number; z: number; yaw: number }) => ({ x: 10 + at.x, y: 2, z: 20 + at.z, yaw: at.yaw }), floorAt: () => 2 }],
      ['game', { onUpdate: (run: (dt: number, time: number) => void, id: string) => { frames.push(run); systems.push(id); } }], ['hud', { toast: () => undefined }]]),
    models: new Map([['trader', { model, name: 'The trader' }], ['trade-counter', { model, name: "The trader's counter", solidFloor: false }]]),
    figures: new Map([['trader', (object) => ({ model: { position: object.position, companions, offer: () => { offer(); } }, update: (dt, t, pp) => { update(dt, t, pp); }, dispose: () => { dispose(); } })]]),
    page: { rows: parseQuestPageInteractions(TRADER_PAGE), flags: new Flags('trader-test', false), prompts },
  } });
  const figure = stall?.trader;
  if (stall === null || figure === null || figure === undefined || frames[0] === undefined || prompts[0] === undefined) throw new Error('Missing trader fixture');
  const step = frames[0], prompt = prompts[0], shop = panel(), feet = figure.position;
  expect(feet.toArray()).toEqual([6.7, 2, 12.2]);
  const yaw = Math.PI - 0.5;
  expect(companions[0]?.position.toArray()).toEqual([feet.x + Math.sin(yaw) * 0.72, 2, feet.z + Math.cos(yaw) * 0.72]);
  expect(stall.at.toArray()).toEqual([feet.x + Math.sin(yaw) * 1.9, 3.35, feet.z + Math.cos(yaw) * 1.9]);
  expect(systems).toEqual(['shard.driftwood-isle.installTrader']);
  expect(prompt.radius).toBe(0);
  prompt.onInteract(); expect(shop.opens).toBe(0);
  stall.shop = shop; player.position.copy(stall.at);
  expect(prompt.radius).toBe(2.8);
  prompt.onInteract();
  expect(player.yaw).toBe(Math.atan2(-(feet.x - player.position.x), -(feet.z - player.position.z)));
  expect(player.pitch).toBe(-0.32); expect(shop.opens).toBe(1); expect(offer).toHaveBeenCalledTimes(1);
  stall.open(); expect(shop.opens).toBe(1); expect(prompt.radius).toBe(0);
  player.position.x += 5.299; step(0.1, 1); expect(shop.isOpen).toBe(true);
  player.position.x += 0.002; step(0.1, 2);
  expect(shop.isOpen).toBe(false); expect(player.pitch).toBe(0.4); expect(update).toHaveBeenCalledTimes(2);
  player.pitch = -0.7; stall.open(); shop.close(); step(0.1, 3); expect(player.pitch).toBe(-0.7);
  scope.dispose(); expect(dispose).toHaveBeenCalledTimes(1);
});

test('Mott opens the existing lazy panel without a camera or walking-close owner', () => {
  const shop = panel(), getShop = vi.fn(() => shop), player = { position: new Vector3(), yaw: 0.7, pitch: -0.1 };
  const stall = installQuestTrader(pine, { player, shop: getShop });
  if (stall === null) throw new Error('Missing Pine trader');
  expect(getShop).not.toHaveBeenCalled();
  stall.open(); stall.open(); player.position.set(100, 100, 100);
  expect(shop.opens).toBe(2); expect(shop.isOpen).toBe(true);
  expect(player.yaw).toBe(0.7); expect(player.pitch).toBe(-0.1);
  expect(() => installQuestTrader({ ...pine, view: { pitch: 0, closeDistance: 5 } }, { player, shop: getShop })).toThrow('placement ports');
  expect(() => installQuestTrader({ ...pine, reopen: 'yes' }, { player, shop: getShop })).toThrow();
  expect(shop.opens).toBe(2);
});
