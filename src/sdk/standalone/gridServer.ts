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
import type { Rapier } from '@wildshard/engine/physics/rapier';
import { createSimHost, SIM_API_VERSION, type SimHost, type SimLevel } from '@wildshard/engine/sim';
import { actRoutes } from '@wildshard/engine/sim/actRoutes';
import { leadPlayer } from '@wildshard/engine/sim/leadPlayer';
import { decodeSimSnapshot, restoreSimHost, serializeSimSnapshot, snapshotSimHostBytes, type SimSnapshot } from '@wildshard/engine/sim/snapshot';
import type { ForwardedStorage } from '@wildshard/engine/saves/forwardedStorage';
import type { SaveStore } from '@wildshard/engine/saves/store';
import type { Transport } from '@wildshard/engine/net/transport';
import { GridAssembly, type GridCell, type GridPoint } from '@wildshard/game/grid/assembly';
import { GridRoom } from '@wildshard/game/grid/room';
import { commandsOf, GridNetRooms } from '@wildshard/game/grid/roomNet';
import { GridSimulation, type GridResident } from '@wildshard/game/grid/simulation';
import { bindShardfileSim, createShardfileSim, HOST_PROBE, type ShardfileSimPorts } from '@wildshard/game/plugin/simulation';
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

/** The four deck slabs around a cell, in its own coordinates. A restored world has them already: its save holds its colliders. */
function addRim(host: SimHost): void {
  const { R, world } = host.physics, reach = CHUNK_HALF + RIM / 2, long = CHUNK_HALF + RIM;
  withOwner(host.scope, () => {
    for (const [x, z, hx, hz] of [[reach, 0, RIM / 2, long], [-reach, 0, RIM / 2, long], [0, reach, long, RIM / 2], [0, -reach, long, RIM / 2]] as const)
      world.createCollider(R.ColliderDesc.cuboid(hx, 0.5, hz).setTranslation(x, -0.5, z).setCollisionGroups(groups('WORLD')));
  });
}

/** A cell with no native plan: a data shard, which any host can run from its output. */
async function openDataCell(input: HeadlessRuntimeInput, snapshot: string | SimSnapshot | undefined, effects: HeadlessEffect[]): Promise<Pick<CellWorld, 'host' | 'dispose'>> {
  await Promise.resolve();
  const { shard, assets, rapier } = input;
  const ports: ShardfileSimPorts = { rapier,
    quest: { fact: (name, actorId) => { effects.push({ kind: 'fact', name, actorId }); }, coins: (amount, actorId) => { effects.push({ kind: 'coins', amount, actorId }); } } };
  const fresh = createShardfileSim(shard, assets, ports);
  if (snapshot === undefined) { addRim(fresh.host); return { host: fresh.host, dispose: () => { fresh.dispose(); } }; }
  const { level } = fresh.host; fresh.dispose();
  const installed: { value?: ReturnType<typeof bindShardfileSim> } = {};
  const host = restoreSimHost(level, { rapier }, typeof snapshot === 'string' ? decodeSimSnapshot(snapshot) : snapshot, restored => { installed.value = bindShardfileSim(restored, shard, assets, { ...ports, restoring: true }); });
  return { host, dispose: () => { (installed.value ?? { dispose: () => { host.dispose(); } }).dispose(); } };
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
    const road = StandaloneGrid.road(rapier, site === null ? candidate?.saved.road : undefined, options.arrival);
    // `read` stands for the saves `open` walks itself: with it declared, a cell that unloads leaves nothing packed in memory.
    const grid = new GridSimulation(assembly, { highway: { host: road, dispose: () => { road.dispose(); } }, maxResidents: STANDALONE_RESIDENTS, read: () => undefined,
      load: async (cell, cached) => { const world = await open(cell, cached); worlds.set(cell.instance, world); return { host: world.host, dispose: () => { worlds.delete(cell.instance); world.dispose(); } }; },
      save: (instance, snapshot) => {
        const held = slots(instance), wrote = held.write({ tick: grid.hostOf(instance).state.tick, snapshot: serializeSimSnapshot(snapshot), ledger: options.book.snapshot() });
        settle(held);
        return wrote;
      } });
    if (site !== null) await grid.enter(site);
    const restored = site === null ? candidate?.saved : resumed;
    const server = new StandaloneGrid({ grid, assembly, restored, options, worlds, slots, sites, saved: candidate?.saved.tick ?? 0 });
    settle = held => { void server.settle([held]); };
    return server;
  }

  private static road(rapier: Rapier, saved: string | undefined, arrival: Readonly<GridPoint> | undefined): SimHost {
    if (saved !== undefined) return restoreSimHost(ROAD, { rapier }, decodeSimSnapshot(saved));
    const road = createSimHost(ROAD, { rapier });
    if (arrival !== undefined) { const lead = leadPlayer(road); lead.position.set(arrival.x, arrival.y, arrival.z); lead.motor.resetAt(lead.position); }
    return road;
  }

  private static async world(cell: GridCell, input: HeadlessRuntimeInput, snapshot: string | SimSnapshot | undefined, options: GridServerOptions): Promise<CellWorld> {
    const declared = new Set(input.shard.ledger.map(row => row.fact));
    const ledger = createQuestLedger(options.saves, input.shard, cell.instance), fact: CellWorld['fact'] = (name, entity) => declared.has(name) ? ledger(name, entity) : null;
    if (nativeCell(input)) {
      const resident = await createTrustedHeadlessResident(input, snapshot, { room: true }), { host } = resident;
      if (snapshot === undefined) addRim(host);
      host.respawn.served = true;
      return { host, dispose: () => { resident.dispose(); }, fact, effects: () => resident.effects, step: inputs => {
        const own = inputs.find(row => row.player === leadPlayer(host).id);
        resident.step(tickCommands([{ source: 'net', commands: netTickCommands(own?.command ?? null, own?.acts ?? [], actRoutes(host)) }], COMMANDS_PER_TICK), undefined, new Map(inputs.map(row => [row.player, row.acts])));
      } };
    }
    const effects: HeadlessEffect[] = [], { host, dispose } = await openDataCell(input, snapshot, effects);
    return { host, dispose, fact, effects: () => effects, step: inputs => { effects.length = 0; host.step(commandsOf(inputs)); } };
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
  /** The host the session's player stands in. */
  get host(): SimHost { return this.grid.host(); }
  /** Connect the session's client; it waits for `open`. */
  connect(transport: Transport): void { this.rooms.connect(leadPlayer(this.grid.hostOf(this.grid.current())).id, transport); }
  open(): void { this.rooms.open(); }
  tick(): void { this.rooms.tick(); }
  /** Resolves true when every write so far reached the real storage, and tells `held` which of its saves that makes good. */
  private settle(held: readonly { settled: (durable: boolean) => void }[]): Promise<boolean> {
    this.settling = this.settling.then(() => this.options.storage.settled()).then(durable => { for (const slots of held) slots.settled(durable); return durable; });
    return this.settling;
  }
  /** Save where the session stands. The document for that place first, then the site that names it. */
  async save(): Promise<{ readonly tick: number; readonly durable: boolean }> {
    const site = this.grid.current(), { host } = this, { tick } = host.state, wire = serializeSimSnapshot(snapshotSimHostBytes(host)), ledger = this.options.book.snapshot();
    const cell = site === null ? undefined : this.slots(site);
    const wrote = (cell?.write({ tick, snapshot: wire, ledger }) ?? true) && this.sites.write({ tick: ++this.saved, site, ...(site === null ? { road: wire, ledger } : {}) });
    return { tick, durable: await this.settle(cell === undefined ? [this.sites] : [cell, this.sites]) && wrote };
  }
  dispose(): void { this.rooms.dispose(); this.room.dispose(); this.grid.dispose(); }
}
