/** The walk-in portal ride's page and host bindings (G478 'walk-in-portal-ride'). A shard declares its portal-link
 * entryways, the ride's director and these rows: the walk-in trigger, the fade, the veil panel and the facts a landing
 * reports. The renderer-free ride (walkInPortalRide.ts) runs after the player on the page's update and on the host's
 * fixed step with exact continuation; the page draws only the veil. No shard identifier or callback enters here. */
import * as v from 'valibot';
import type { PanelNode } from '@wildshard/engine/ui/panel';
import type { PortalLinkEntry, portalLinkRules } from '@wildshard/format/portalLinkAssets';
import { createPortalRide, PortalRideStateSchema, type PortalRideState, type PortalRideLane, type RideRings } from './walkInPortalRide';
import { createPortalTraversal, type PortalTransfer, type PortalTraversalPorts } from './portalTraversal';
import type { ShardContext } from '../plugin/context';
import { bindRuntimeLedger, projectRuntimeFacts } from '../plugin/headless';

/** the ride's rows: its director (a `directors` id), walk-in volume, fade, veil and the facts a landing reports */
export interface PortalRideRows {
  readonly director: string;
  readonly trigger: RideRings['trigger'];
  readonly fade: RideRings['fade'];
  readonly veil: PanelNode;
  readonly landings: readonly { readonly node: string; readonly fact: string }[];
}
/** where a landing's fact goes: the page's bound ledger or the host's effect buffer */
export type PortalFacts = (name: string, entity: string) => void;
/** a shardfile's portal entries and the rules' inputs (its props and collision) */
export type PortalSource = Parameters<typeof portalLinkRules>[1] & {
  readonly entryways: readonly { readonly edge: PortalLinkEntry['edge']; readonly portal?: PortalLinkEntry['portal'] }[];
  readonly directors?: readonly { readonly id: string }[] | null;
};
/** the player as the ride moves it: feet, motor, board, the hold and the resets */
export interface PortalPlayer {
  readonly position: PortalTraversalPorts['feet'];
  readonly motor: PortalTraversalPorts['motor'];
  hover: boolean;
  carried: boolean;
  setHover: (on: boolean) => void;
  spawn: (x: number, z: number, yaw: number, y?: number) => void;
}
/** the portals while they run (captures and tests read them) */
export interface PortalRide {
  readonly entered: () => PortalLinkEntry['edge'] | null;
  readonly busy: () => boolean;
  readonly rides: () => readonly PortalTransfer[];
  readonly refused: () => readonly string[];
  step: (dt: number) => void;
  snapshot: () => PortalRideState;
  restore: (state: PortalRideState) => void;
}

/** the declared links with a portal; missing links never become portals */
export function declaredPortals(source: PortalSource): PortalLinkEntry[] {
  return source.entryways.flatMap(row => row.portal === undefined ? [] : [{ edge: row.edge, portal: row.portal }]);
}

/** the player's side of a ride: the hold, the checked transfer from a declared node, the resets facing the new heading */
export interface PortalRider {
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  hold: (on: boolean) => void;
  teleport: (from: string) => PortalTransfer;
  settle: (yaw: number) => void;
}

/** The player as a rider: a grid frame rebinds its physics and motor, so they are read again per transfer. */
export function portalRider(player: PortalPlayer, physics: () => PortalTraversalPorts['physics'], source: PortalSource): PortalRider {
  const ports = { physics: physics(), motor: player.motor, feet: player.position }, traversal = createPortalTraversal(declaredPortals(source), source, ports), spawn = player.spawn.bind(player);
  return { position: player.position,
    hold: on => { if (on && player.hover) player.setHover(false); player.carried = on; },
    teleport: from => { ports.physics = physics(); ports.motor = player.motor; return traversal.teleport(from); },
    settle: yaw => { const p = player.position; spawn(p.x, p.z, yaw, p.y); } };
}

/** the ride's rings from its rows and the shardfile's links and director */
export function portalRings(source: PortalSource, rows: Pick<PortalRideRows, 'director' | 'trigger' | 'fade'>): RideRings {
  const stages = source.directors?.find(row => row.id === rows.director);
  if (stages === undefined) throw new Error(`Missing portal director ${rows.director}`);
  return { entries: declaredPortals(source), trigger: rows.trigger, fade: rows.fade, stages };
}

/** One ride: each frame's hold and checked transfer, the veil's amount, and a fact per declared landing. */
export function bindPortalRide(rider: PortalRider, veil: (amount: number) => void, rings: RideRings, landings: PortalRideRows['landings'] = [], facts: PortalFacts = () => undefined): PortalRide {
  return bindPortalLane(rider, veil, createPortalRide(rings), landings, facts);
}

function bindPortalLane(rider: PortalRider, veil: (amount: number) => void, lane: PortalRideLane, landings: PortalRideRows['landings'], facts: PortalFacts): PortalRide {
  return { entered: lane.entered, busy: lane.busy, rides: lane.rides, refused: lane.refused, snapshot: lane.snapshot, restore: lane.restore,
    step: dt => {
      const frame = lane.observe(dt, rider.position);
      for (const command of frame.commands.slice(0, 3)) {
        if (command.kind === 'hold') { rider.hold(command.on); continue; }
        try {
          const transfer = rider.teleport(command.from); rider.settle(transfer.yaw); lane.complete(transfer);
          for (const row of landings) if (row.node === transfer.to) facts(row.fact, row.node);
        } catch (error) { lane.refuse(error instanceof Error ? error.message : String(error)); }
      }
      veil(frame.veil);
    } };
}

/** Snapshot the entered owners before asynchronous preparation; admission never binds their replacements. */
function portalOwner(ctx: Pick<ShardContext, 'game' | 'scope'>, declared: ShardContext | null) {
  const scope = ctx.scope, game = ctx.game, runtime = game.runtime;
  if (runtime === undefined) throw new Error('The portal ride needs its entered world');
  const world = runtime.world;
  if (world === null) throw new Error('The portal ride needs its entered world');
  const app = declared?.app, product = declared?.product, source = product?.shardfile;
  const play = runtime.play, progress = play?.progress;
  const check = (): void => {
    if (ctx.scope !== scope || scope.disposed || scope.disposing) throw new Error('Portal ride owner has ended');
    if (ctx.game !== game || game.runtime !== runtime || runtime.world !== world) throw new Error('Portal ride world owner was replaced');
    if (declared !== null && (declared.app !== app || declared.product !== product || product.shardfile !== source
      || runtime.play !== play || play?.progress !== progress)) throw new Error('Portal ride declared owner was replaced');
  };
  check();
  return { world, check };
}

/** The page's ride: its veil panel in the HUD and its step after the player's, for the level's lifetime. */
export function installPortalRide(ctx: Pick<ShardContext, 'game' | 'system' | 'scope'>, source: PortalSource, rows: PortalRideRows, facts: PortalFacts): Promise<PortalRide> {
  return installPageRide(ctx, source, rows, facts);
}

/** Enter one admitted fixed portal declaration using the runtime's original ledger and progress owner. */
export async function installDeclaredPortalRide(ctx: ShardContext, file: string): Promise<PortalRide> {
  const owner = portalOwner(ctx, ctx), product = ctx.product, source = product.shardfile;
  if (!product.hasFile(file)) throw new Error('Portal ride requires its admitted data file');
  const { portalRide } = await product.json<{ readonly portalRide: PortalRideRows }>(file);
  owner.check();
  return installPageRide(ctx, source, portalRide, ctx);
}

async function installPageRide(ctx: Pick<ShardContext, 'game' | 'system' | 'scope'>, source: PortalSource, rows: PortalRideRows, facts: PortalFacts | ShardContext): Promise<PortalRide> {
  const declared = typeof facts === 'function' ? null : facts, original = portalOwner(ctx, declared), world = original.world;
  const [{ declarePanel }, { mountUi, uiScope }] = await Promise.all([import('@wildshard/engine/ui/panel'), import('@wildshard/engine/ui/ownership')]);
  original.check();
  // Validate the director, traversal and detached panel before a ledger, mounted veil or system can be allocated.
  const lane = createPortalRide(portalRings(source, rows)), rider = portalRider(world.player, () => world.physics, source);
  const panel = declarePanel(rows.veil);
  const emit = typeof facts === 'function' ? facts : projectRuntimeFacts(bindRuntimeLedger(facts, facts.product.shardfile, facts.product.slug), facts.game.runtime?.play?.progress);
  original.check();
  // O18: the veil belongs to this entered scope, even after the asynchronous module read.
  const owner = uiScope('PortalVeil', ctx.scope);
  mountUi(panel.root, owner);
  const ride = bindPortalLane(rider, k => { panel.style('', 'opacity', k.toFixed(3)); panel.style('', 'display', k > 0 ? 'block' : 'none'); }, lane, rows.landings, emit);
  let live = true;
  owner.onDispose(() => { if (ride.busy()) rider.hold(false); live = false; });
  ctx.system({ id: 'game.portal-ride', phase: 'update', after: ['engine.player.update'], run: dt => { if (live) ride.step(dt); } });
  return ride;
}

/** What the ride uses of the renderer-free host: its player, the player's fall, impulse, knockback, dash and board, its
 *  physics, and a fixed-step system with continuation. */
export interface RideHost<Physics> {
  readonly player: { readonly position: PortalPlayer['position'] & { set: (x: number, y: number, z: number) => unknown }; yaw: number; readonly motor: PortalPlayer['motor'] };
  readonly physics: Physics;
  readonly playerFall: { vy: number; grounded: boolean };
  readonly playerImpulse: { set: (x: number, y: number, z: number) => unknown };
  readonly playerShove: { t: number };
  readonly playerDash: { t: number };
  readonly playerBoard: { readonly on: boolean };
  setBoard: (on: boolean) => void;
  onStep: (id: string, run: (dt: number) => void, adapter: { snapshot: () => string; restore: (value: unknown) => void }) => unknown;
}

const finite = v.pipe(v.number(), v.finite());
const Saved = v.strictObject({ held: v.nullable(v.strictObject({ x: finite, y: finite, z: finite })), ride: PortalRideStateSchema });
interface Point { x: number; y: number; z: number }

/** The host's ride on its fixed step under `id`: `carried` holds the feet still while the fade runs, `spawn` releases the
 *  motor and clears every velocity; the hold and the ride are exact continuation. */
export function installHostPortalRide(host: RideHost<PortalTraversalPorts['physics']>, id: string, source: PortalSource, rows: PortalRideRows, facts: PortalFacts): PortalRide {
  const player = host.player, holdPoint = { x: 0, y: 0, z: 0 }, spawnPoint = { x: 0, y: 0, z: 0 };
  let held: Point | null = null;
  const keep = (at: Point): void => {
    player.position.set(at.x, at.y, at.z); player.motor.resetAt(at);
    host.playerFall.vy = 0; host.playerFall.grounded = false; host.playerImpulse.set(0, 0, 0); host.playerShove.t = 0;
  };
  const body: PortalPlayer = {
    // the motor is read each time: a restore rebuilds the player's motor on the restored physics after install
    position: player.position, get motor() { return player.motor; },
    get hover() { return host.playerBoard.on; },
    get carried() { return held !== null; },
    set carried(on) {
      holdPoint.x = player.position.x; holdPoint.y = player.position.y; holdPoint.z = player.position.z;
      held = on ? holdPoint : null;
      if (held !== null) keep(held);
    },
    setHover: (on) => { host.setBoard(on); },
    spawn: (x, z, yaw, y) => { player.yaw = yaw; player.motor.release(); host.playerDash.t = 0; spawnPoint.x = x; spawnPoint.y = y ?? player.position.y; spawnPoint.z = z; keep(spawnPoint); },
  };
  const ride = bindPortalRide(portalRider(body, () => host.physics, source), () => undefined, portalRings(source, rows), rows.landings, facts);
  host.onStep(id, (dt) => { if (held !== null) keep(held); ride.step(dt); }, { snapshot: () => JSON.stringify({ held, ride: ride.snapshot() }), restore: (value) => {
    if (typeof value !== 'string') throw new Error(`Invalid portal continuation (${id})`);
    const saved = v.parse(Saved, JSON.parse(value));
    ride.restore(saved.ride); held = saved.held;
  } });
  return ride;
}
