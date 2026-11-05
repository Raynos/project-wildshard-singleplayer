// P1-E5.3 I6 (J126), J130: Settings ▸ Developer ▸ Worker client runs the real Game and Player against the real server in its
// worker: the Player predicts and reconciles, and every creature is an interpolated row drawn by the real views. The flip commit
// deletes the row and keeps this path. The page's other systems still run, on nothing: no blow goes to the server yet, and
// movers, weapons, fights and riding wait for their own rows.
import type { Scope } from '@wildshard/engine/app/scope';
import type { LiveGridWire } from '../grid/liveSession';
import type { SystemSpec } from '@wildshard/engine/app/systems';
import type { Player } from '@wildshard/engine/player/Player';
import { diagnosticNow } from '@wildshard/engine/core/clock';
import type { NetClient } from '@wildshard/engine/net/client';
import { NetPlayer, type NetWeapons } from '@wildshard/engine/net/netPlayer';
import type { PredictedRow } from '@wildshard/engine/net/predictionWorld';
import { ANIMAL_CLASS } from '@wildshard/engine/net/netSchemas';
import type { Physics } from '@wildshard/engine/physics/Physics';
import type { SaveStorage } from '@wildshard/engine/saves/store';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { Animal } from '@wildshard/engine/entities/AnimalView';
import { ANIMAL_STATES } from '@wildshard/engine/entities/animalStates';
import { creatureBodyShape } from '@wildshard/engine/sim/bands';
import { hudSlots } from '@wildshard/engine/ui/hudSlots';

type Creatures = Pick<AnimalManager, 'animals' | 'spawn' | 'retire'>;
/** What a grid page lends: its crossing follows the server, and its creatures are the entered cell's. */
export interface WorkerClientGrid {
  readonly cells: readonly { readonly instance: string }[];
  readonly bindWire: (wire: LiveGridWire) => void;
  readonly frame: () => string | null;
  readonly animals: () => Creatures | null;
}
/** The part of an item row that says where the server holds it. */
export interface WorkerItemRow { readonly id: string; readonly ranged?: { readonly slot: number } | undefined }
/** What the page hands the proof. */
export interface WorkerClientPorts {
  readonly slug: string;
  readonly player: Player; readonly physics: Physics;
  /** The page's creature manager: its views draw rows, and its own population is retired. */
  readonly animals: Creatures;
  readonly grid: WorkerClientGrid | null;
  /** The real weapons: they send their presses and take the server's word. */
  readonly weapons: NetWeapons;
  /** The shard's item rows: a ranged row names the server's slot for it. */
  readonly items: readonly WorkerItemRow[];
  readonly scope: Scope;
  readonly system: (system: SystemSpec) => void;
}
interface Saves { readonly storage: SaveStorage; readonly write: (key: string, value: string | null) => Promise<boolean> }
interface ShellModule { readonly openIndexedSaves: (name: string) => Promise<Saves>; readonly startStandalone: (config: { slug: string; base: string; build: string; savePrefix: string } & Saves) => Shell }
interface Shell { readonly client: NetClient; readonly booted: Promise<{ readonly restored: boolean }>; ready: () => void; save: () => Promise<{ readonly tick: number; readonly ok: boolean }>; probe: () => Promise<{ readonly tickMs: number }>; dispose: () => void }

/** The row's saves stand apart, so playing it never touches a real one. */
const PROOF_SAVES = 'wildshard.worker.', PROOF_DATABASE = 'wildshard-worker-saves', SAVE_EVERY_MS = 30_000;
const column = (name: string): number => ANIMAL_CLASS.row.findIndex(entry => entry.name === name);
const X = column('x'), Y = column('y'), Z = column('z'), YAW = column('yaw'), STATE = column('state'), ATTACK = column('attackT'), FLINCH = column('flinch'), HP = column('hp'), ALIVE = column('alive');

/** What the page measures, as I6 lists it. */
export interface WorkerClientReport {
  frames: number; framesPerSecond: number; ticksPerSecond: number; correctionsPerMinute: number; corrections: number; worstOffset: number; queue: number; replaysPerFrame: number;
  delayMs: number; jitterMs: number; mainMsP95: number; workerTickMs: number; rows: number; attacks: number; hits: number; kills: number; refused: number; held: number; dropped: number; closed: string | null; x: number; z: number; cell: number; serverX: number; serverZ: number; restored: boolean; savedTick: number; savedOk: boolean;
}
declare global { interface Window { __workerClient?: () => WorkerClientReport; __workerClientSave?: () => Promise<void> } }

/** A creature on screen, and the world's manager that holds it: a crossing leaves it behind. */
interface RowBody { readonly body: Animal; readonly manager: Creatures }
/** Every creature on this page is a row: a new one spawns through the real manager, one the server dropped retires. */
function syncCreatures(client: NetClient, animals: Creatures | null, bodies: Map<number, RowBody>): void {
  for (const [handle, { body, manager }] of bodies) if (!client.entities.has(handle)) { manager.retire(body); bodies.delete(handle); }
  if (animals === null) return;
  for (const [handle, info] of client.entities) {
    if (info.cls.cls !== ANIMAL_CLASS.cls || bodies.has(handle)) continue; // the shell's bundle has its own copy of the class
    const { x = 0, y = 0, z = 0, yaw = 0 } = client.interpolator.fields(handle, Number.MAX_SAFE_INTEGER) ?? {};
    if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number' || typeof yaw !== 'number') continue;
    const body = animals.spawn(String(info.initial['kind']), x, z, yaw, String(info.initial['variant']), { y });
    body.rowDriven = true;
    bodies.set(handle, { body, manager: animals });
  }
  for (const body of animals.animals.filter(entry => !entry.rowDriven)) animals.retire(body); // what the page's own population made
}

/** Rows onto the bodies, and the near ones into the predicted world as capsules. */
function showRows(client: NetClient, net: NetPlayer, ports: WorkerClientPorts, bodies: ReadonlyMap<number, RowBody>, renderTick: number, dt: number, row: Float64Array, near: PredictedRow[]): number {
  const { interpolator } = client;
  let shown = 0;
  near.length = 0;
  for (const [handle, { body }] of bodies) {
    if (!interpolator.sample(handle, renderTick, row)) continue;
    body.showRow({ x: row[X] ?? 0, y: row[Y] ?? 0, z: row[Z] ?? 0, yaw: row[YAW] ?? 0, state: ANIMAL_STATES[row[STATE] ?? 0] ?? 'idle', attack: row[ATTACK] ?? 0, flinch: row[FLINCH] ?? 0, hp: row[HP] ?? 0, alive: row[ALIVE] === 1 }, dt);
    shown++;
    const { radius, height } = creatureBodyShape(body.dims, body.scale);
    near.push({ handle, x: row[X] ?? 0, y: row[Y] ?? 0, z: row[Z] ?? 0, alive: row[ALIVE] === 1, driven: false, radius, height });
  }
  net.world.syncRows(near, ports.player.position);
  return shown;
}

function overlay({ scope }: Pick<WorkerClientPorts, 'scope'>): (text: string) => void {
  const line = document.createElement('pre');
  line.style.cssText = 'position:fixed;left:8px;top:150px;margin:0;padding:4px 6px;pointer-events:none;font:11px/1.3 ui-monospace,monospace;color:#fff;background:#0009;white-space:pre';
  hudSlots.widget('band.3', line, 90, scope);
  return text => { line.textContent = text; };
}

async function readWorker(shell: Shell, report: WorkerClientReport): Promise<void> { report.workerTickMs = (await shell.probe()).tickMs; }

/** Boot the server in its worker and put this page on it. */
async function startWorkerClient(ports: WorkerClientPorts): Promise<void> {
  const { slug, player, physics, scope, system } = ports, build = (globalThis as { __WS_BUILD_ID__?: string }).__WS_BUILD_ID__ ?? '', root = `/b/${build}/standalone`;
  await import(/* @vite-ignore */ `${root}/identity.js`);
  const environment = await import(/* @vite-ignore */ `${root}/storage.js`) as { installBrowserSaveEnvironment: () => void };
  environment.installBrowserSaveEnvironment();
  const { openIndexedSaves, startStandalone } = await import(/* @vite-ignore */ `${root}/shell.js`) as ShellModule;
  const shell = startStandalone({ slug, base: `/shardfiles/${slug}/`, build, savePrefix: PROOF_SAVES, ...await openIndexedSaves(PROOF_DATABASE) }), { client } = shell;
  scope.onDispose(() => { shell.dispose(); });
  const net = new NetPlayer(client, player, physics), show = overlay(ports), row = new Float64Array(ANIMAL_CLASS.row.length), near: PredictedRow[] = [], costs = new Float64Array(240), bodies = new Map<number, RowBody>();
  player.link = net; net.bindWeapons(ports.weapons, new Map(ports.items.flatMap(item => item.ranged === undefined ? [] : [[item.id, item.ranged.slot] as const])));
  // A frame names its world. A grid page crosses when one says so; a one-shard page has only the world it opened in, and waits there.
  const { grid } = ports, siteOf = (cell: number): string | null | undefined => cell === 0 ? null : grid?.cells[cell - 1]?.instance;
  let opened: number | undefined;
  if (grid === null) net.inCell = cell => (opened ??= cell) === cell;
  else {
    grid.bindWire({ site: () => { const cell = client.latest?.cell; return cell === undefined ? undefined : siteOf(cell); }, rebound: next => { net.world.rebind(next); } });
    net.inCell = cell => siteOf(cell) === grid.frame();
  }
  scope.onDispose(() => { player.link = null; ports.weapons.bindWire(null); net.dispose(); });
  const { restored } = await shell.booted;
  shell.ready();
  const started = diagnosticNow(), report: WorkerClientReport = { frames: 0, framesPerSecond: 0, ticksPerSecond: 0, correctionsPerMinute: 0, corrections: 0, worstOffset: 0, queue: 0, replaysPerFrame: 0, delayMs: 0, jitterMs: 0, mainMsP95: 0, workerTickMs: 0, rows: 0, attacks: 0, hits: 0, kills: 0, refused: 0, held: 0, dropped: 0, closed: null, x: 0, z: 0, cell: 0, serverX: 0, serverZ: 0, restored, savedTick: -1, savedOk: false };
  scope.onDispose(client.onCombat(event => { if (event.kind === 'hit' && event.confirmFor !== 0) { report.hits++; if (event.killed) report.kills++; } }));
  // The server keeps the session's saves, and only a page knows when to ask: on a timer and as a phone hides it.
  const save = async (): Promise<void> => { const { tick, ok } = await shell.save(); report.savedTick = tick; report.savedOk = ok; };
  scope.interval(SAVE_EVERY_MS, () => { void save(); });
  scope.listen(document, 'visibilitychange', () => { if (document.visibilityState === 'hidden') void save(); });
  let firstTick = -1, ticksFrom = started, cost = 0, sampleAt = 0, framesAt = 0, sampledAt = started;
  scope.onDispose(client.onTravel(() => { firstTick = -1; ticksFrom = diagnosticNow(); }));
  system({ id: 'proof.worker.reconcile', phase: 'input', run: () => { const at = diagnosticNow(); net.reconcile(); cost = diagnosticNow() - at; } });
  system({ id: 'proof.worker.present', phase: 'update', run: dt => {
    const at = diagnosticNow(), renderTick = client.present();
    syncCreatures(client, grid === null ? ports.animals : grid.animals(), bodies);
    report.rows = showRows(client, net, ports, bodies, renderTick, dt, row, near);
    net.present(dt);
    const now = diagnosticNow(), { predictor } = net, seconds = (now - started) / 1000, tick = client.latest?.tick ?? 0;
    costs[report.frames % costs.length] = cost + now - at;
    report.frames++;
    if (firstTick === -1 && tick > 0) firstTick = tick;
    report.ticksPerSecond = firstTick === -1 ? 0 : (tick - firstTick) / ((now - ticksFrom) / 1000); // each world keeps its own clock
    report.corrections = predictor.corrections; report.correctionsPerMinute = predictor.corrections / seconds * 60; report.worstOffset = net.worstOffset; report.queue = predictor.pending;
    report.replaysPerFrame = predictor.replays / report.frames; report.delayMs = client.clock.delayMs; report.jitterMs = client.clock.jitterMs;
    report.refused = net.attacks.refused; report.attacks = net.attacks.pending; report.held = net.heldSlot;
    report.dropped = client.dropped; report.closed = client.closed; report.x = player.position.x; report.z = player.position.z;
    const { latest } = client;
    if (latest !== null) { const { px, pz } = client.owner(latest); report.cell = latest.cell; report.serverX = Number(px); report.serverZ = Number(pz); }
    if (now - sampledAt < 1000) return;
    report.framesPerSecond = (report.frames - framesAt) / (now - sampledAt) * 1000; framesAt = report.frames; sampledAt = now;
    report.mainMsP95 = [...costs].sort((a, b) => a - b)[Math.floor(Math.min(report.frames, costs.length) * 0.95) + Math.max(0, costs.length - report.frames)] ?? 0;
    if (now - sampleAt > 2000) { sampleAt = now; void readWorker(shell, report); }
    show(`worker client ${report.closed ?? 'open'}\n${report.framesPerSecond.toFixed(1)} fps  ${report.ticksPerSecond.toFixed(1)} ticks/s\ndelay ${report.delayMs.toFixed(0)} ms  jitter ${report.jitterMs.toFixed(1)} ms\ncorrections ${report.corrections} (${report.correctionsPerMinute.toFixed(1)}/min)  worst ${report.worstOffset.toFixed(2)} m\nqueue ${report.queue}  replays/frame ${report.replaysPerFrame.toFixed(2)}\nmain ${report.mainMsP95.toFixed(2)} ms  worker ${report.workerTickMs.toFixed(1)} ms  rows ${report.rows}\nhits ${report.hits}  kills ${report.kills}  refused ${report.refused}  waiting ${report.attacks}  held ${report.held}`);
  } });
  window.__workerClient = () => ({ ...report });
  window.__workerClientSave = save;
}

async function guarded(ports: WorkerClientPorts): Promise<void> {
  try { await startWorkerClient(ports); }
  catch (error) { console.error('[worker client]', error); overlay(ports)(`worker client failed\n${String(error)}`); }
}

/** Start the proof; a failure says so, because a phone has no console. */
export function launchWorkerClient(ports: WorkerClientPorts): void { void guarded(ports); }
