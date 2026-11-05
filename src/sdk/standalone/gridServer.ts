// P1-E3.9, E5.2b: the grid in the server worker. One world steps at a time and each keeps its own clock and room, as the MMO's
// will; a crossing hands the client over with `travel`. It reads `simulation.ts`, `room.ts` and `roomNet.ts`, never
// `LiveGridHost`, whose ports are the page's.
//
// The boot decision: a grid session starts with its owner on the road, because `GridSimulation` is built around a highway host
// whose lead holds a motor, and `enter` then moves that lead into the home cell before the first tick. So a fresh boot, a
// restored cell and a save made on the road all take one path. The road is a flat deck at road level, which is what the page's
// own road queries say it is (`HIGHWAY_QUERIES`); its walls and seam strips reach the server with C2's packs.
import { withOwner } from '@wildshard/engine/app/ownership';
import { CHUNK_HALF } from '@wildshard/engine/core/config';
import type { LedgerBook } from '@wildshard/engine/net/ledgerBook';
import type { ChatReports } from '@wildshard/engine/net/chat';
import type { NetTickInput } from '@wildshard/engine/net/room';
import { groups } from '@wildshard/engine/physics/groups';
import { NearColliders } from '@wildshard/engine/physics/nearColliders';
import type { Rapier } from '@wildshard/engine/physics/rapier';
import { createSimHost, SIM_API_VERSION, type SimHost, type SimLevel } from '@wildshard/engine/sim';
import { actRoutes } from '@wildshard/engine/sim/actRoutes';
import type { PlayerSim } from '@wildshard/engine/sim/playerSim';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHostBytes, type SimSnapshot } from '@wildshard/engine/sim/snapshot';
import type { ForwardedStorage } from '@wildshard/engine/saves/forwardedStorage';
import type { SaveStore } from '@wildshard/engine/saves/store';
import type { Transport } from '@wildshard/engine/net/transport';
import { GridAssembly, type GridCell, type GridPoint } from '@wildshard/game/grid/assembly';
import { GridRoom } from '@wildshard/game/grid/room';
import { commandsOf, GridNetRooms } from '@wildshard/game/grid/roomNet';
import { GridSimulation, type GridResident } from '@wildshard/game/grid/simulation';
import { bindShardfileSim, createShardfileSim, HOST_PROBE, type ShardfileSimPorts, type ShardfileSimulation } from '@wildshard/game/plugin/simulation';
import { hasNativeAssembly } from '@wildshard/game/shardfile/nativeAssembly';
import { createQuestLedger } from '@wildshard/game/quest/ledger';
import { createTrustedHeadlessResident, type HeadlessRuntimeInput } from '../headlessRuntime';
import { tickCommands, type HeadlessEffect } from '../tickProtocol';
import { cellDocuments, CONTINUATION, ContinuationSlots, SITE, siteDocuments, type SavedContinuation, type SavedSite } from './continuation';
import { ledgerFilings } from './ledgerFilings';
import { netTickCommands } from './netInput';

/** The tick allowance one player's input may use. */
const COMMANDS_PER_TICK = 8;
/** Worlds the worker holds beside the road, and so what a crossroads costs a phone (E5.2b, J68): the one its player stands in. */
export const STANDALONE_RESIDENTS = 1;
/** A deck that covers the whole grid, and a player's pace on it. */
const ROAD_HALF_SIZE = 2000, ROAD_SPEED = 8;
/** How far past a cell's edge the deck runs in that cell's own world: past the 10 m leave band, with room to stop. */
const RIM = 16;
/** A cell wall's thickness and half its height. */
const WALL = 0.5, WALL_HEIGHT = 30;
/** How far out from a cell's edge its wall stands. */
const WALL_OFF = 2;
const ROAD: SimLevel = { version: SIM_API_VERSION, id: 'grid-road', seed: 1, ground: { size: ROAD_HALF_SIZE * 2, height: 0 }, player: { at: { x: 0, y: 0, z: 0 }, yaw: 0, speed: ROAD_SPEED }, entities: [], quests: [], weapon: HOST_PROBE };

/** One world the worker has open: its host, and how it takes a tick and reports what the tick granted. */
interface CellWorld extends GridResident {
  readonly effects: () => readonly HeadlessEffect[];
  readonly step: (inputs: readonly NetTickInput[]) => void;
  readonly fact: (name: string, entity: string) => { readonly id: string; readonly status: 'granted' | 'duplicate' | 'pending' } | null;
}
/** What the grid needs of its host. */
export interface GridServerOptions {
  readonly slug: string; readonly build: string; readonly book: LedgerBook; readonly saves: SaveStore; readonly storage: ForwardedStorage; readonly savePrefix: string;
  /** A cell's server inputs, read when it is admitted and dropped once its world is built. */
  readonly load: (slug: string) => Promise<HeadlessRuntimeInput>;
  /** A save read back but would not restore, and boot moved to the one before it. */
  readonly refused?: (error: unknown) => void;
  readonly reports?: ChatReports;
  /** A world's tick finished, in how many milliseconds. */
  readonly stepped: (host: SimHost, ms: number) => void;
  readonly now: () => number;
  /** A proof's way in: start on the road at this world point, as no player can, rather than in the home cell. */
  readonly arrival?: Readonly<GridPoint>;
  /** A proof's override of `STANDALONE_RESIDENTS`. */
  readonly residents?: number;
}

/** What boot hands the session it built. */
interface GridParts {
  readonly options: GridServerOptions;
  readonly worlds: Map<string, CellWorld>;
  readonly slots: (instance: string) => ContinuationSlots<SavedContinuation>;
  readonly sites: ContinuationSlots<SavedSite>;
  /** Saves this session has made. */
  readonly saved: number;
}

/** One slab of deck at road level, made as a level's flat ground is, so a capsule crossing from the road's own ground meets no lip. A capsule that starts a skin inside a solid box stays stuck in it. */
function addDeck(host: SimHost, x: number, z: number, hx: number, hz: number): void {
  const { R, world } = host.physics;
  withOwner(host.scope, () => { world.createCollider(R.ColliderDesc.heightfield(1, 1, new Float32Array(4), { x: hx * 2, y: 1, z: hz * 2 }).setTranslation(x, 0, z).setCollisionGroups(groups('WORLD'))); });
}
/**
 * A wall around every cell in the road's own world, as the page's readiness walls are while a cell loads. A player stops just short of
 * a cell until its world is ready and the crossing takes them in, 6 m out at most; the road's flat deck never runs on under a cell's own
 * hills, where a late hand-off would set them down inside one. A cell's terrain can end in a bank above road level at its very edge,
 * and a capsule set down touching that bank stays stuck in it, so the wall stands clear of it.
 */
function addCellWalls(road: SimHost, cells: readonly GridCell[]): void {
  const { R, world } = road.physics, reach = CHUNK_HALF + WALL_OFF + WALL / 2, long = reach + WALL / 2;
  withOwner(road.scope, () => {
    for (const { origin } of cells) for (const [x, z, hx, hz] of [[reach, 0, WALL / 2, long], [-reach, 0, WALL / 2, long], [0, reach, long, WALL / 2], [0, -reach, long, WALL / 2]] as const)
      world.createCollider(R.ColliderDesc.cuboid(hx, WALL_HEIGHT, hz).setTranslation(origin.x + x, WALL_HEIGHT, origin.z + z).setCollisionGroups(groups('WORLD')));
  });
}
/** The four slabs around a cell, in its own coordinates. A restored world has them already: its save holds its colliders. */
function addRim(host: SimHost): void {
  const reach = CHUNK_HALF + RIM / 2, long = CHUNK_HALF + RIM;
  for (const [x, z, hx, hz] of [[reach, 0, RIM / 2, long], [-reach, 0, RIM / 2, long], [0, reach, long, RIM / 2], [0, -reach, long, RIM / 2]] as const) addDeck(host, x, z, hx, hz);
}

/** A cell with no native plan: a data shard, which any host can run from its output. */
async function openDataCell(input: HeadlessRuntimeInput, snapshot: string | SimSnapshot | undefined, effects: HeadlessEffect[]): Promise<Pick<CellWorld, 'host' | 'dispose'> & { readonly sim: () => ShardfileSimulation | undefined }> {
  await Promise.resolve();
  const { shard, assets, rapier } = input;
  const ports: ShardfileSimPorts = { rapier,
    quest: { fact: (name, actorId) => { effects.push({ kind: 'fact', name, actorId }); }, coins: (amount, actorId) => { effects.push({ kind: 'coins', amount, actorId }); } } };
  const fresh = createShardfileSim(shard, assets, ports);
  if (snapshot === undefined) { addRim(fresh.host); return { host: fresh.host, sim: () => fresh, dispose: () => { fresh.dispose(); } }; }
  const { level } = fresh.host; fresh.dispose();
  const installed: { value?: ReturnType<typeof bindShardfileSim> } = {};
  const host = restoreSimHost(level, { rapier }, typeof snapshot === 'string' ? decodeSimSnapshot(snapshot) : snapshot, restored => { installed.value = bindShardfileSim(restored, shard, assets, { ...ports, restoring: true }); });
  return { host, sim: () => installed.value, dispose: () => { (installed.value ?? { dispose: () => { host.dispose(); } }).dispose(); } };
}

/** The one client this worker serves is on the wire as the host's own player. A room with more players keeps this seat. */
const SESSION_PLAYER = 'actor.player';
function sessionPlayer(host: SimHost): PlayerSim {
  const player = host.players.get(SESSION_PLAYER);
  if (player === undefined) throw new Error('The session player has no body in this host');
  return player;
}

/** A world's continuation. The solids held near its player are out of it while it is taken: they are in no save. */
function capture(host: SimHost): string {
  const { near } = host.physics, { position } = sessionPlayer(host);
  near?.suspend();
  try { return serializeSimSnapshot(snapshotSimHostBytes(host)); } finally { near?.resume(position.x, position.z); }
}

/** Whether this output runs on the trusted headless owner. */
const nativeCell = (input: HeadlessRuntimeInput): boolean => input.product !== undefined && (hasNativeAssembly(input.product) || input.product.has('sim/runtime-plan'));

/** The worker's grid: the road, whichever cell its player is in, and the room each is on the wire through. */
export class StandaloneGrid {
  readonly grid: GridSimulation;
  readonly assembly: GridAssembly;
  /** The save this boot resumed, if any. */
  readonly restored: SavedContinuation | SavedSite | undefined;
  private readonly options: GridServerOptions;
  private readonly worlds: Map<string, CellWorld>;
  private readonly slots: (instance: string) => ContinuationSlots<SavedContinuation>;
  private readonly sites: ContinuationSlots<SavedSite>;
  private readonly room: GridRoom;
  private readonly rooms: GridNetRooms;
  private settling: Promise<boolean> = Promise.resolve(true);
  private saved: number;
  private constructor(built: Pick<StandaloneGrid, 'grid' | 'assembly' | 'restored'> & GridParts) {
    this.grid = built.grid; this.assembly = built.assembly; this.restored = built.restored; this.saved = built.saved; this.options = built.options; this.worlds = built.worlds; this.slots = built.slots; this.sites = built.sites;
    const { book, build, reports } = built.options;
    this.room = new GridRoom(this.grid, this.assembly, { loadout: () => ({ checkpoint: () => true, stow: () => undefined, interior: () => undefined }) });
    this.rooms = new GridNetRooms(this.grid, this.room, this.assembly, { held: true, build, book, ...(reports === undefined ? {} : { reports }),
      step: (site, inputs) => this.step(site, inputs), filings: (site, first) => this.filings(site, first) });
  }

  /** Open the session: at its save if it has one that restores, else in the home cell's spawn. */
  static async boot(options: GridServerOptions): Promise<StandaloneGrid> {
    const assembly = new GridAssembly({ developer: false, devserver: false }), home = new Map([...assembly.cells].reverse().map(cell => [cell.slug, cell])).get(options.slug);
    if (home === undefined) throw new Error(`Standalone needs a grid cell: ${options.slug}`);
    const { saves, storage, savePrefix } = options, worlds = new Map<string, CellWorld>(), cells = new Map<string, ContinuationSlots<SavedContinuation>>();
    let settle: (held: ContinuationSlots<SavedContinuation>) => void = () => undefined;
    const continuation = saves.define(CONTINUATION), sites = new ContinuationSlots(saves.define(SITE), siteDocuments(options.slug), storage, savePrefix);
    const slots = (instance: string): ContinuationSlots<SavedContinuation> => {
      const held = cells.get(instance) ?? new ContinuationSlots(continuation, cellDocuments(instance), storage, savePrefix);
      cells.set(instance, held);
      return held;
    };
    const candidate = sites.candidates().find(row => row.saved.site === null || assembly.cells.some(cell => cell.instance === row.saved.site));
    if (candidate !== undefined) sites.restored(candidate);
    const site = options.arrival !== undefined ? null : candidate === undefined ? home.instance : candidate.saved.site;
    const firstSlug = site === null ? home.slug : assembly.cell(site).slug, first = await options.load(firstSlug), { rapier } = first, lent = new Map([[firstSlug, first]]);
    let resumed: SavedContinuation | undefined;
    const input = (cell: GridCell): Promise<HeadlessRuntimeInput> => { const held = lent.get(cell.slug); lent.clear(); return held === undefined ? options.load(cell.slug) : Promise.resolve(held); };
    const open = async (cell: GridCell, cached: SimSnapshot | undefined): Promise<CellWorld> => {
      const source = await input(cell);
      if (cached !== undefined) return StandaloneGrid.world(cell, source, cached, options);
      const held = slots(cell.instance);
      for (const row of held.candidates()) {
        try { const world = await StandaloneGrid.world(cell, source, row.saved.snapshot, options); held.restored(row); resumed = row.saved; return world; }
        catch (error) { held.setAside(row); options.refused?.(error); }
      }
      return StandaloneGrid.world(cell, source, undefined, options);
    };
    const road = StandaloneGrid.road(rapier, assembly.cells, site === null ? candidate?.saved.road : undefined, options.arrival);
    const grid: GridSimulation = new GridSimulation(assembly, { highway: { host: road, dispose: () => { road.dispose(); } }, maxResidents: options.residents ?? STANDALONE_RESIDENTS,
      load: async (cell, cached) => { const world = await open(cell, cached); worlds.set(cell.instance, world); return { host: world.host, dispose: () => { worlds.delete(cell.instance); world.dispose(); } }; },
      durable: (instance, host) => {
        const held = slots(instance), wrote = held.write({ tick: host.state.tick, snapshot: capture(host), ledger: options.book.snapshot() });
        settle(held);
        return wrote;
      } });
    if (site !== null) await grid.enter(site);
    const restored = site === null ? candidate?.saved : resumed;
    const server = new StandaloneGrid({ grid, assembly, restored, options, worlds, slots, sites, saved: candidate?.saved.tick ?? 0 });
    settle = held => { void server.settle([held]); };
    return server;
  }

  private static road(rapier: Rapier, cells: readonly GridCell[], saved: string | undefined, arrival: Readonly<GridPoint> | undefined): SimHost {
    if (saved !== undefined) return restoreSimHost(ROAD, { rapier }, decodeSimSnapshot(saved));
    const road = createSimHost(ROAD, { rapier });
    addCellWalls(road, cells);
    if (arrival !== undefined) { const player = sessionPlayer(road); player.position.set(arrival.x, arrival.y, arrival.z); player.motor.resetAt(player.position); }
    return road;
  }

  private static async world(cell: GridCell, input: HeadlessRuntimeInput, snapshot: string | SimSnapshot | undefined, options: GridServerOptions): Promise<CellWorld> {
    const declared = new Set(input.shard.ledger.map(row => row.fact));
    const ledger = createQuestLedger(options.saves, input.shard, cell.instance), fact: CellWorld['fact'] = (name, entity) => declared.has(name) ? ledger(name, entity) : null;
    if (nativeCell(input)) {
      // J68: a native assembly keeps its ground whole and its solids as data. A saved world holds none of them, so a throwaway fresh one lists them.
      const near = input.product !== undefined && hasNativeAssembly(input.product) ? new NearColliders() : undefined, around = near === undefined ? { room: true } : { room: true, near };
      if (near !== undefined && snapshot !== undefined) (await createTrustedHeadlessResident(input, undefined, around)).dispose();
      const resident = await createTrustedHeadlessResident(input, snapshot, around), { host } = resident;
      if (snapshot === undefined) addRim(host);
      host.respawn.served = true;
      return { host, dispose: () => { resident.dispose(); }, fact, effects: () => resident.effects, step: inputs => {
        const player = sessionPlayer(host), own = inputs.find(row => row.player === player.id);
        near?.update(player.position.x, player.position.z);
        resident.step(tickCommands([{ source: 'net', commands: netTickCommands(own?.command ?? null, own?.acts ?? [], actRoutes(host)) }], COMMANDS_PER_TICK), undefined, new Map(inputs.map(row => [row.player, row.acts])));
      } };
    }
    const effects: HeadlessEffect[] = [], { host, dispose, sim } = await openDataCell(input, snapshot, effects);
    return { host, dispose, fact, effects: () => effects, step: inputs => {
      effects.length = 0;
      // A data shard's prompts answer whoever stands at them; an id they don't offer that player is dropped, since an input may not end the server.
      for (const { player, acts } of inputs) for (const act of acts) if (act.kind === 'interact' && sim()?.selectedInteraction(player) === act.id) sim()?.interact(act.id, player);
      host.step(commandsOf(inputs));
    } };
  }

  private step(site: string | null, inputs: readonly NetTickInput[]): boolean {
    const started = this.options.now(), world = site === null ? undefined : this.worlds.get(site);
    if (world === undefined) this.grid.stepSite(site, commandsOf(inputs)); else world.step(inputs);
    this.options.stepped(this.grid.hostOf(site), this.options.now() - started);
    return true;
  }
  private filings(site: string | null, first: string): ReturnType<typeof ledgerFilings> {
    const world = site === null ? undefined : this.worlds.get(site);
    return world === undefined ? [] : ledgerFilings(world.host, first, world.effects(), world.fact);
  }
  /** Worlds held beside the road. */
  get residents(): number { return this.worlds.size; }
  /** Solids kept as data by the world the player stands in, and those it holds now. */
  get near(): { readonly held: number; readonly live: number } { return this.host.physics.near?.counts ?? { held: 0, live: 0 }; }
  /** Characters of save documents this worker keeps a copy of. */
  get docsChars(): number {
    const { storage } = this.options;
    let total = 0;
    for (let index = 0; index < storage.length; index++) total += storage.getItem(storage.key(index) ?? '')?.length ?? 0;
    return total;
  }
  /** The host the session's player stands in. */
  get host(): SimHost { return this.grid.host(); }
  /** Connect the session's client; it waits for `open`. */
  connect(transport: Transport): void { this.rooms.connect(SESSION_PLAYER, transport); }
  open(): void { this.rooms.open(); }
  tick(): void { this.rooms.tick(); }
  /** Resolves true when every write so far reached the real storage, and tells `held` which of its saves that makes good. */
  private settle(held: readonly { settled: (durable: boolean) => void }[]): Promise<boolean> {
    this.settling = this.settling.then(() => this.options.storage.settled()).then(durable => { for (const slots of held) slots.settled(durable); return durable; });
    return this.settling;
  }
  /** Save where the session stands. The document for that place first, then the site that names it. */
  async save(): Promise<{ readonly tick: number; readonly durable: boolean }> {
    const site = this.grid.current(), { host } = this, { tick } = host.state, wire = capture(host), ledger = this.options.book.snapshot();
    const cell = site === null ? undefined : this.slots(site);
    const wrote = (cell?.write({ tick, snapshot: wire, ledger }) ?? true) && this.sites.write({ tick: ++this.saved, site, ...(site === null ? { road: wire, ledger } : {}) });
    return { tick, durable: await this.settle(cell === undefined ? [this.sites] : [cell, this.sites]) && wrote };
  }
  dispose(): void { this.rooms.dispose(); this.room.dispose(); this.grid.dispose(); }
}
