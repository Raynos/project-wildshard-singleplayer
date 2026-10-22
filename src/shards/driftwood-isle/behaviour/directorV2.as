// H13 shadow port. The hash-pinned director.as keeps shipping until cutover.
// Immutable declaration parameters are samples, not an env.query import.
import { Inputs, Clock, Params, Do, State } from './generated/driftwoodDirector';

export function onTick(): void {
  const nowAltar = Inputs.altar === 1, nowDead = Inputs.dead === 1, seen = Inputs.seen === 1;
  if (!State.initialized) {
    State.initialized = true; State.altar = nowAltar; State.dead = nowDead;
    if (nowAltar && !nowDead) Do.event(9001);
    if (Clock.tick === 0) return;
  } else {
    if (nowAltar && !State.altar) Do.event(9002);
    if (nowDead && !State.dead) Do.event(9003);
    State.altar = nowAltar; State.dead = nowDead;
  }
  if (Clock.dt === 0) return;
  const dx = Inputs.playerX-Inputs.rewardX, dz = Inputs.playerZ-Inputs.rewardZ;
  if (State.reward === -1 && nowDead && !seen && sqrt(dx*dx+dz*dz) < Params.radius) { State.reward = 0; Do.event(9004); }
  if (State.reward >= 0) {
    State.reward += Clock.dt;
    if (State.reward > Params.delay) { State.reward = -2; Do.event(9005); }
  }
}
