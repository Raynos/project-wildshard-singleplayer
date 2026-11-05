/** A room fight from its product rows (P1-E3.4): the page's `combat/room-entry.json` on a SimHost. `installArenaRoom` is the
 *  fight; this lends it the shard's bodies, door collider and reward. Only a net room installs it: a tape's or a page's
 *  host has no such fight, so a one-player save keeps its adapters. */
import * as v from 'valibot';
import type { BossSaved } from '@wildshard/engine/ai/BossBrain';
import type { AnimalSimSpec } from '@wildshard/engine/entities/AnimalSim';
import { isArenaSeal } from '../../shared/boss/arenaCollision';
import type { SimHost, SimSpawn } from '@wildshard/engine/sim';
import type { SimSnapshot } from '@wildshard/engine/sim/snapshot';
import { ArenaFightPageSchema } from './arenaRoomFight';
import { installArenaRoom, type ArenaRoomBody } from './arenaRoomNative';
import { ArenaRoomSchema } from '../../shared/boss/arenaRoomRows';
import { ReturnProgram } from '../../shared/population/returnProgram';

const Entry = v.object({ room: v.unknown(), encounter: v.object({ definition: v.record(v.string(), v.unknown()), page: v.unknown(), portal: v.unknown(), program: v.unknown() }) });
/** The body's and add's memory slots: bounded, so a save can name them. */
const ADDS = 32;
const entered = new WeakMap<SimHost, ReturnType<typeof installArenaRoom<ArenaRoomBody>>>();
/** The row that places this fight. */
export interface ArenaEntryRow { readonly id: string; readonly body: { readonly kind: string; readonly variant: string }; readonly reward: string; readonly entrance: readonly [number, number, number, number] }
/** What a shard lends. */
export interface ArenaEntryPorts {
  readonly spec: (kind: string, variant: string) => AnimalSimSpec;
  readonly grantItem: (player: string, item: string, count: number) => void;
  /** The restored save, whose dynamic actors go back before its adapters do. */
  readonly snapshot?: Readonly<SimSnapshot> | undefined;
}

const Species = v.object({ species: v.array(v.object({ kind: v.string(), aggressive: v.boolean(), lockable: v.optional(v.boolean()), dims: v.record(v.string(), v.unknown()),
  variants: v.array(v.object({ id: v.string(), label: v.string(), rarity: v.string(), hp: v.number(), mods: v.optional(v.record(v.string(), v.unknown())) })) })) });
/** A room's bodies by kind and variant, from the server's own species rows. */
export function arenaSpecies(input: unknown): ArenaEntryPorts['spec'] {
  const { species } = v.parse(Species, input);
  return (kind, variant) => {
    const row = species.find(entry => entry.kind === kind), selected = row?.variants.find(entry => entry.id === variant);
    if (row === undefined || selected === undefined) throw new Error(`Arena body ${kind}.${variant} has no species row`);
    const spec: unknown = { kind, label: selected.label, variant, rarity: selected.rarity, hp: selected.hp, aggressive: row.aggressive, dims: row.dims, mods: { speed: 1, chargeDist: 1, damageTaken: 1, chargeDamage: 1, relentless: false, ...selected.mods }, ...(row.lockable === undefined ? {} : { lockable: row.lockable }) };
    return spec as AnimalSimSpec;
  };
}

/** Install one arena room. Its record lives in plain flags, as a boss row's does. */
export function installArenaEntry(host: SimHost, input: unknown, row: ArenaEntryRow, ports: ArenaEntryPorts): ReturnType<typeof installArenaRoom<ArenaRoomBody>> {
  const data = v.parse(Entry, input), room = v.parse(ArenaRoomSchema, data.room), page = v.parse(ArenaFightPageSchema, data.encounter.page), { add } = page;
  for (const saved of ports.snapshot?.adapters ?? []) {
    if (!saved.id.startsWith(`runtime.actor.${row.id}.`) || typeof saved.state !== 'string') continue;
    const recipe: unknown = JSON.parse(saved.state);
    host.spawn(recipe as SimSpawn);
  }
  const flag = (name: string): string => `boss.${row.id}.${name}`, saved: BossSaved = { defeated: host.flags.has(flag('defeated')), rewardTaken: host.flags.has(flag('paid')), kills: 0 };
  const body = (id: string): ArenaRoomBody | null => { const actor = host.entities.get(id); return actor === undefined ? null : Object.assign(actor, { hidden: false }); };
  const spawn = (id: string, kind: string, variant: string, x: number, z: number, yaw: number): ArenaRoomBody => {
    const held = body(id); if (held !== null) { held.place(x, z, yaw); return held; }
    return Object.assign(host.spawn({ id, spec: ports.spec(kind, variant), seed: host.level.seed, scale: 1, at: { x, y: room.origin.y, z }, yaw }), { hidden: false });
  };
  let adds = 0, door: (() => void) | null = null;
  const seal = (on: boolean): void => {
    door ??= (): void => undefined;
    for (const collider of host.physics.world.colliders.getAll()) if (isArenaSeal(collider, room)) collider.setEnabled(on);
  };
  const [x, , z, facing] = row.entrance, { encounter } = data;
  const fight = installArenaRoom<ArenaRoomBody>(host, { step: row.id, room, definition: { ...encounter.definition, reward: {} } as Parameters<typeof installArenaRoom>[1]['definition'], fight: page,
    portal: { rows: v.parse(v.looseObject({}), encounter.portal) as NonNullable<Parameters<typeof installArenaRoom>[1]['portal']>['rows'], program: ReturnProgram.native(host, encounter.program),
      entrance: { x, y: host.groundHeightAt(x, z) + 0.1, z, facing } } }, {
    spawnBody: () => spawn(`${row.id}.body`, row.body.kind, row.body.variant, room.origin.x, room.origin.z, 0),
    spawnAdd: (_index, ax, az, yaw) => spawn(`${row.id}.add.${String(adds++ % ADDS)}`, add.kind, add.variant, ax, az, yaw),
    retire: actor => { actor.hidden = true; }, find: id => body(id), seal, saved,
    persist: value => { if (value.defeated) host.flags.set(flag('defeated')); if (value.rewardTaken) host.flags.set(flag('paid')); },
    // a lone player earned it alone; a room's earners come from the book at the killing blow
    spawnReward: () => { if (!fight.bounty.room) fight.bounty.award([...host.players.keys()]); } });
  // J105: each earner's own, through the ledger. The blow and the win land in either order, so this reads them after both.
  host.onStep(`${row.id}.reward`, () => {
    if (fight.boss.state === 'victory') for (const player of fight.bounty.owed) if (fight.bounty.take(player)) ports.grantItem(player, row.reward, 1);
  });
  entered.set(host, fight);
  return fight;
}
/** This host's room fight, once installed. */
export function arenaEntryOf(host: SimHost): ReturnType<typeof installArenaRoom<ArenaRoomBody>> | undefined { return entered.get(host); }
