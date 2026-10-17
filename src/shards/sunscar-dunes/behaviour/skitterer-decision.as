// One pack declaration; Clock.self selects this body's independent declared state.
// The engine owns 60 Hz ring motion, emergence, burial and strike contacts.
import { Clock, Move, Strike, Field, State, Params, Do, Read } from './generated/sunscarSkittererDecision';
function ringMove(): i32 {
  if (State.ring == 0) return Move.ring0;
  if (State.ring == 1) return Move.ring1;
  if (State.ring == 2) return Move.ring2;
  if (State.ring == 3) return Move.ring3;
  if (State.ring == 4) return Move.ring4;
  if (State.ring == 5) return Move.ring5;
  return Move.ring6;
}
function hunt(): void {
  const target = Read.nearestPlayer(Clock.self);
  State.step = 2;
  if (target != 0) Do.move(Clock.self, ringMove(), target);
}
export function onStart(): void { State.ring = i32(Read.random() * 7); }
export function onTick(dt: f64): void {
  if (State.step == 5) return;
  const actor = Clock.self, target = Read.nearestPlayer(actor);
  const distance = target == 0 ? Params.sleep + 1 : Read.distance(actor, target);
  if (State.step == 0) {
    if (target != 0 && distance < Params.wake) { State.step = 1; State.far = 0; Do.move(actor, Move.surface); }
    return;
  }
  if (State.step == 1) return;
  State.far = distance > Params.sleep ? State.far + dt : 0;
  if (State.far > Params.rebury) { State.step = 0; Do.stop(actor); Do.move(actor, Move.burrow); return; }
  const strike = Read.strikeState(actor);
  if (State.step == 4 && strike >= 3 && target != 0) { State.step = 3; Do.move(actor, Move.retreat, target); return; }
  if (State.step == 2 && strike == 0 && target != 0 && distance < Params.bite) {
    State.step = 4; Do.stop(actor); Do.strike(actor, Strike.bite, target);
  } else if (State.step == 2 && target != 0 && !Read.moving(actor)) {
    Do.move(actor, ringMove(), target);
  }
}
export function onMoveDone(move: i32, ok: bool): void {
  if ((move == Move.surface && State.step == 1) || (move == Move.retreat && State.step == 3)) hunt();
}
export function onStrikeDone(strike: i32, hit: bool): void {
  if (State.step == 4) hunt();
}
export function onDeath(by: i32): void {
  State.step = 5; Do.stop(Clock.self); Do.field(Clock.self, Field.burrow, 0);
}
export function onStop(): void { Do.stop(Clock.self); }
