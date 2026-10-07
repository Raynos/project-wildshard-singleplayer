// SF51-p (G184): riding the lantern lifts. The platform installs the lifts' declared mover rows (data/movers.ts, run by
// behaviour/lift.as in the fixed step); this adds the three prompts a lift needs and draws each cage at its row's pose:
// - in the resting cage: "Ride the lift up / down" (action 1, to the other end);
// - on the deck before the door while the cage is up: "Call the lift" (action 2);
// - in the street before the door while the cage is down: "Call the lift" (action 3).
// A lift's four rows (cage, gates, deck door, street door) always get the same command, so they move as one.
import { Vector3 } from 'three';
import type { World } from '@wildshard/engine/core/bootstrap';
import type { Interactable } from '@wildshard/engine/world/interact/types';
import { installDeclaredMovers, type MoverRuntime } from '@wildshard/game/shardfile/moverRuntime';
import type { ShardContext } from '@wildshard/game/shard/context';
import { liftMoverViews } from '../runtime/movers';
import type { NineDragonWorld } from './build';
import { STRINGS } from '../strings';
import { ALONG, CAGE, LIFTS, frameXZ, liftBottom, liftTop } from './liftPlan';

/** a prompt's reach (m), from the eye */
const REACH = 2.6, CALL_REACH = 3.2;
/** the four rows a lift's command goes to */
const rows = (id: string): string[] => [id, `${id}.gates`, `${id}.deck-door`, `${id}.street-door`];

/** a lift's published state: the cage's progress 0..1 and whether it is moving */
export interface LiftState { readonly s: number; readonly moving: boolean; readonly at: { x: number; y: number; z: number } }

/** the lifts while they ride (captures and tests: `state`, `ride`) */
export interface Lifts { readonly movers: MoverRuntime; state: (id: string) => LiftState; command: (id: string, action: 1 | 2 | 3) => void }

/** install the lifts' movers, prompts and cage poses for this session (only with Debug ▸ Nine Dragon entries on) */
export async function installLifts(ctx: ShardContext, world: World, interactables: Interactable[], built: NonNullable<NineDragonWorld['lifts']>): Promise<Lifts> {
  const cages = built.cages;
  let alive = true;
  const prompts: Interactable[] = [];
  // the platform disposes the movers with the session's scope; the prompts leave the session's list with them
  const movers = await installDeclaredMovers(ctx, world, liftMoverViews(() => {
    alive = false; built.view = null;
    for (const p of prompts) { const i = interactables.indexOf(p); if (i !== -1) interactables.splice(i, 1); }
  }));
  const command = (id: string, action: 1 | 2 | 3): void => { if (alive) for (const row of rows(id)) movers.command(row, action); };
  const state = (id: string): LiftState => {
    const pose = movers.pose(id);
    return { s: liftProgress(pose.position.y, id), moving: movingOf(movers, id), at: pose.position };
  };
  const views = LIFTS.flatMap((l) => {
    const cage = cages.get(l.id); if (cage === undefined) return [];
    const [dx, dz] = frameXZ(l, ALONG - CAGE - 2.4, l.across), [sx, sz] = frameXZ(l, ALONG + CAGE + 1.8, l.across);
    const ride: Interactable = { label: STRINGS['lift.up'], position: new Vector3(), radius: 0, onInteract: () => { command(l.id, 1); } };
    const callDown: Interactable = { label: STRINGS['lift.call'], position: new Vector3(dx, liftBottom(l).y + 1.4, dz), radius: 0, onInteract: () => { command(l.id, 2); } };
    const callUp: Interactable = { label: STRINGS['lift.call'], position: new Vector3(sx, liftTop(l).y + 1.4, sz), radius: 0, onInteract: () => { command(l.id, 3); } };
    prompts.push(ride, callDown, callUp);
    return [{ id: l.id, cage, ride, callDown, callUp }];
  });
  interactables.push(...prompts);
  // the world's own per-frame update runs the view (world/build.ts `update`)
  built.view = () => {
    if (!alive) return;
    for (const v of views) {
      const p = movers.pose(v.id).position, st = state(v.id), up = !st.moving && st.s >= 1, down = !st.moving && st.s <= 0;
      v.cage.position.set(p.x, p.y, p.z);
      v.ride.position.set(p.x, p.y + 1.3, p.z); v.ride.radius = st.moving ? 0 : REACH; v.ride.label = up ? STRINGS['lift.down'] : STRINGS['lift.up'];
      v.callDown.radius = up ? CALL_REACH : 0; v.callUp.radius = down ? CALL_REACH : 0;
    }
  };
  return { movers, state, command };
}

/** the cage's progress from its height (0 at the deck, 1 at the winch house) */
function liftProgress(y: number, id: string): number {
  const l = LIFTS.find((row) => row.id === id); if (l === undefined) return 0;
  return Math.min(1, Math.max(0, (y - liftBottom(l).y) / (liftTop(l).y - liftBottom(l).y)));
}

/** whether a lift's gates are closed: they collide exactly while the cage moves */
function movingOf(movers: MoverRuntime, id: string): boolean { return movers.pose(`${id}.gates`).enabled; }
