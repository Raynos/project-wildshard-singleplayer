// @vitest-environment happy-dom
// oxlint-disable-next-line import/no-nodejs-modules -- The room runs the shipped product bytes and physics module.
import { readFileSync } from 'node:fs';
import { Group } from 'three';
import { beforeAll, expect, test } from 'vitest';
import type { NetCommand } from '@wildshard/format/netCommand';
import { EquipmentService } from '../src/engine/client/combat/EquipmentService';
import { NetClient } from '../src/engine/client/net/client';
import { NetPlayer } from '../src/engine/client/net/netPlayer';
import { NetRoom, type NetTickInput } from '../src/engine/server/net/room';
import { SimNetWorld } from '../src/engine/server/net/simWorld';
import type { EquipmentPickup } from '../src/engine/server/combat/EquipmentPickup';
import { Scope } from '../src/engine/shared/app/scope';
import type { EquipmentRow } from '../src/engine/shared/combat/Equipment';
import { Weapon, type OwnHit, type WeaponWire } from '../src/engine/shared/combat/Weapon';
import { FIXED_STEP } from '../src/engine/shared/core/fixedStep';
import { loadRapier, type Rapier } from '../src/engine/shared/physics/rapier';
import { actRoutes } from '../src/engine/shared/sim/actRoutes';
import { leadPlayer } from '../src/engine/shared/sim/leadPlayer';
import { legacyDouble } from '../src/engine/test/FakeGame';
import { directLoopback } from '../src/engine/test/netLoopback';
import { outputDescriptor } from '../src/game/shared/shardfile/outputDescriptor';
import { readNativeRangedItem } from '../src/game/server/plugin/nativeItems';
import { SWORD_WOOD } from '../src/game/shared/weapons/starterMeleeProfile';
import { loadHeadlessProduct } from '../src/sdk/headlessProduct';
import { createTrustedHeadlessResident, type TrustedHeadlessResident } from '../src/sdk/headlessRuntime';
import { netTickCommands } from '../src/sdk/standalone/netInput';
import { tickCommands } from '../src/sdk/tickProtocol';
import { pineSpots } from '../src/shards/pine-hollow/generators/questPrompts';
import { builtProduct } from './fixtures/builtProduct';
import { loadCourseRapier, PageSide, type MotionScenario } from './fixtures/motion-trace/parity';

// P1-E6 COMBAT: what a page holds reaches the server through its real acts, and the server's word comes back. The rifle's only
// way into a server's hands is its own pickup, by name, in reach: a page that unlocks one by itself holds nothing.
let R: Rapier, serverR: Rapier;
beforeAll(async () => { R = await loadCourseRapier(); serverR = await loadRapier(readFileSync('public/assets/physics/rapier.wasm')); });
class HeldRow extends Weapon {
  readonly model = new Group(); readonly state = { ammo: 1, magazine: 1, reserve: 0, loaded: true, reloading: false, reloadProgress: 0, ads: false };
  adsHeld = false; aimInfo = null; enabled = true; holster = 0;
  tryFire(): void { /* Held only. */ }
  update(): void { /* Held only. */ }
}
const SLOTS = new Map([['weapon.crossbow', 0], ['weapon.lever', 1], ['weapon.longbow', 2]]);
const scenario: MotionScenario = { id: 'net-held', start: { x: -10, z: 0, yaw: 0 }, ticks: 0, intent: () => ({}), bodyAt: { x: -5, z: 30 } };

async function resident(shard = 'pine-hollow'): Promise<TrustedHeadlessResident> {
  const directory = builtProduct(shard), product = await loadHeadlessProduct(directory), descriptor = outputDescriptor(product.shardfile);
  if (descriptor === undefined) throw new Error('Missing output');
  const assets = new Map(descriptor.index.files.map(file => [file.commons === true ? `commons:${file.hash}` : file.hash, Uint8Array.from(readFileSync(`${directory}/${file.path}`))]));
  return createTrustedHeadlessResident({ shard: product.shardfile, assets, rapier: serverR, product });
}
interface Rig { readonly net: NetPlayer; readonly client: NetClient; readonly live: TrustedHeadlessResident; readonly followed: string[]; readonly hits: OwnHit[]; readonly refusals: number[]; run: (ticks: number) => void; held: () => unknown; done: () => void }
async function rig(): Promise<Rig> {
  const live = await resident(), { host } = live, lead = leadPlayer(host).id, world = new SimNetWorld(host), page = new PageSide(R, scenario), { player } = page, link = directLoopback(), client = new NetClient(link.client);
  const room = new NetRoom({ world, step: (inputs: readonly NetTickInput[]) => {
    const own = inputs.find(row => row.player === lead), others = new Map<string, NetCommand>();
    live.step(tickCommands([{ source: 'net', commands: netTickCommands(own?.command ?? null, own?.acts ?? [], actRoutes(host)) }], 8), others, new Map(inputs.map(row => [row.player, row.acts])));
  } });
  room.join(link.server, world.playerOf(lead)); client.hello(); link.pump(); room.open(); link.pump();
  const net = new NetPlayer(client, player, page.physics), followed: string[] = [], hits: OwnHit[] = [], refusals: number[] = [];
  net.bindWeapons({ bindWire: () => undefined, serverHit: hit => { hits.push(hit); }, mirrorArrows: () => undefined, attackRefused: () => { refusals.push(1); }, heldByServer: row => { followed.push(row); } }, SLOTS);
  for (let at = 0; at < 4; at++) { room.tick(); link.pump(); }
  player.link = net; player.locked = true;
  const run = (ticks: number): void => {
    for (let tick = 0; tick < ticks; tick++) {
      net.reconcile(); page.stepWorld(); player.setBodyEnabled(true); player.stepDevice(FIXED_STEP); net.present(FIXED_STEP); link.pump(); room.tick(); link.pump();
    }
  };
  return { net, client, live, followed, hits, refusals, run, held: () => client.latest === null ? null : client.owner(client.latest)['held'],
    done: () => { net.dispose(); room.dispose(); page.dispose(); live.dispose(); } };
}
const standAtRifle = ({ live }: Rig): void => {
  const { rifle } = pineSpots(), player = leadPlayer(live.host);
  player.position.set(rifle.x, rifle.y, rifle.z); player.motor.resetAt(player.position);
};

test('a rifle the page unlocked by itself is no rifle: the server stays shut and the page takes its word', async () => {
  const held = await rig();
  try {
    held.run(10);
    held.net.wire.equip('weapon.lever'); held.run(30 * 11);
    expect(held.held()).toBe(0);
    expect(held.followed).toEqual(['weapon.crossbow']);
  } finally { held.done(); }
}, 120_000);

test('its pickup, in reach, is what puts it in the server\'s hands, and a shot from it lands on the server\'s word', async () => {
  const held = await rig();
  try {
    held.run(10); standAtRifle(held); held.run(3);
    held.net.wire.interact('quest.pickup'); held.net.wire.equip('weapon.lever');
    held.run(60);
    expect(held.live.host.flags.has('owned:lever-rifle')).toBe(true);
    expect(held.held()).toBe(1);
    expect(held.followed).toEqual([]);
    const { item, kind } = readNativeRangedItem(held.live.host, 1);
    if (kind !== 'cycle') throw new Error('Not the rifle');
    expect(item.act.chambered).toBe(true);
    held.net.wire.press(true); held.run(4);
    expect(item.act.chambered).toBe(false);
    expect(held.net.attacks.pending).toBe(0);
    expect(held.refusals).toEqual([]);
  } finally { held.done(); }
}, 120_000);

test('a server that moves the slot itself moves the page', async () => {
  const held = await rig();
  try {
    held.run(10); held.live.host.flags.set('owned:lever-rifle'); held.net.wire.equip('weapon.lever'); held.run(45);
    expect(held.held()).toBe(1);
    held.client.act({ kind: 'equip', seq: 1, slot: 0 }); held.run(45);
    expect(held.held()).toBe(0);
    expect(held.followed).toEqual(['weapon.crossbow']);
  } finally { held.done(); }
}, 120_000);

test('a bow held to full and let go looses on the server, on the command that let go', async () => {
  const held = await rig();
  try {
    held.run(10); held.live.host.flags.set('paid:king'); held.net.wire.equip('weapon.longbow'); held.run(45);
    expect(held.held()).toBe(2);
    held.net.wire.hold(true); held.run(150);
    const let_go = held.net.wire.nextSeq();
    held.net.wire.hold(false); held.net.wire.shot(let_go); held.run(6);
    const { item, kind } = readNativeRangedItem(held.live.host, 2);
    if (kind !== 'bow') throw new Error('Not the bow');
    expect(item.flying()).toBe(1);
    expect(held.net.attacks.pending).toBe(0);
    expect(held.refusals).toEqual([]);
  } finally { held.done(); }
}, 120_000);

test('a pickup the page places tells the server its name, and Driftwood\'s sword has a route of that name', async () => {
  const live = await resident('driftwood-isle'), scope = new Scope('net-pickup'), wire: string[] = [];
  try {
    expect(actRoutes(live.host).interactions.has('iron-sword')).toBe(true);
    const row = (id: NonNullable<EquipmentRow['legacySlot']>, pickup?: EquipmentRow['pickup']): EquipmentRow => ({ ...SWORD_WOOD, id: `weapon.${id}`, legacySlot: id, ...(pickup === undefined ? {} : { pickup }) });
    let drop: EquipmentPickup | null = null;
    const made: EquipmentPickup = { interactable: legacyDouble<EquipmentPickup['interactable']>({}), update: () => undefined, dispose: () => undefined };
    const service = new EquipmentService(new HeldRow(row('sword')), { scope });
    service.add(new HeldRow(row('sword-iron', { owned: 'iron-sword', prompt: '', toast: '', create: () => { drop = made; return made; } })), { locked: true });
    service.bindWire(legacyDouble<WeaponWire>({ equip: () => undefined, interact: id => { wire.push(id); } }));
    service.placePickups({ pickups: [{ id: 'weapon.sword-iron', at: 'wreck.deck' }] }, { prompts: [], owned: { has: () => false, grant: () => undefined }, onNear: () => undefined, onPickup: () => undefined });
    if (drop === null) throw new Error('No drop');
    made.onPickup?.();
    expect(wire).toEqual(['iron-sword']);
  } finally { scope.dispose(); live.dispose(); }
}, 120_000);

test('the page\'s fire disc shoots what it holds: a pull on the raise of a swap lands, and a pull on the lower is the old weapon\'s', async () => {
  const held = await rig();
  try {
    held.run(10); held.live.host.flags.set('owned:lever-rifle');
    const { item, kind } = readNativeRangedItem(held.live.host, 1);
    if (kind !== 'cycle') throw new Error('Not the rifle');
    held.net.wire.equip('weapon.lever'); held.run(18);
    expect(held.held()).toBe(1);
    held.net.wire.press(true); held.run(1); held.net.wire.press(false); held.run(6);
    expect(item.act.chambered).toBe(false);
    expect(held.refusals).toEqual([]);
  } finally { held.done(); }
}, 120_000);

test('a reload the page starts reaches the server, on the rifle in hand', async () => {
  const held = await rig();
  try {
    held.run(10); held.live.host.flags.set('owned:lever-rifle'); held.net.wire.equip('weapon.lever'); held.run(45);
    const { item, kind } = readNativeRangedItem(held.live.host, 1);
    if (kind !== 'cycle') throw new Error('Not the rifle');
    held.net.wire.press(true); held.run(1); held.net.wire.press(false); held.run(90);
    const tube = item.act.tube;
    expect(tube).toBeLessThan(item.act.tubeMax);
    held.net.wire.reload(); held.run(2);
    expect(item.act.phase).toBe('reload');
  } finally { held.done(); }
}, 120_000);
