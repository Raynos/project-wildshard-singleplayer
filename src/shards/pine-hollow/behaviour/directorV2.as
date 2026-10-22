// H13 shadow port. The hash-pinned director.as remains the shipping v0 module.
// Immutable declared parameters arrive as samples; world queries, if needed,
// belong to H5's request ring, never a function import.
import { Inputs, Clock, Incoming, Params, Do, State } from './generated/pineDirector';

export function onTick(): void {
  let nightRequest = Inputs.nightRequest === 1, dawnRequest = Inputs.dawnRequest === 1;
  for (let i = 0; i < Incoming.count; i++) {
    const kind = Incoming.type(i);
    if (kind === 9181) nightRequest = true;
    else if (kind === 9182) dawnRequest = true;
  }
  if (nightRequest) { Do.event(9161); if (Inputs.night < 0.5 && Inputs.hasClock === 1) Do.event(9162, Params.nightValue); }
  if (dawnRequest && State.dawn < 0 && Inputs.seen === 0) { State.dawn = 0; Do.event(9163); }
  if (Clock.tick === 0 || State.dawn < 0) return;
  const was = State.dawn; State.dawn += Clock.dt;
  if (was < Params.sunriseAt && State.dawn >= Params.sunriseAt && Inputs.hasClock === 1) Do.event(9164, Params.sunriseValue);
  if (was < Params.lanternsAt && State.dawn >= Params.lanternsAt) Do.event(9165);
  if (was < Params.captionAt && State.dawn >= Params.captionAt) Do.event(9166);
  if (was < Params.finishAt && State.dawn >= Params.finishAt) { Do.event(9167); State.dawn = -1; }
}
