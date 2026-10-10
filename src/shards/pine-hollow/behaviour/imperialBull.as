// SF27 the Imperial Bull's fight (data/eliteBrains.ts IMPERIAL_BULL_BRAIN; compiled behind elitePrelude.as). He postures
// 18–26 m off, side-on, and charges down lanes; at dusk and by night he BUGLES once a phase and two rival bulls come in
// (the host's rivals run before the call).
// Modes: 0 idle, 1 home, 2 bugle, 3 charge, 4 posture. Slot 0: bugledPhase. Voices: 0 bugle, 1 deer call.
// Host values: 0 live rivals, 1 the bugle hour (dusk or night). Actions: 0 callRivals.
const BUGLE: f64 = 2, CHARGE: f64 = 3, POSTURE: f64 = 4;
export function on_tick(): void {
  begin(0);
  let bugled = input(21);
  const dt = input(1), t = input(2), mode = input(4), p2 = input(6) !== 0, d = input(7), yaw = input(8);
  let modeT = input(5);
  look(1, 0);
  const phase: f64 = p2 ? 1 : 0;
  if (mode === BUGLE) {
    // head up, the long call; the rivals answer out of the trees
    steer(yaw, 0, 2); look(1, 12);
    if (modeT > 0.2 && modeT - dt <= 0.2) voice(0);
    if (modeT >= 1.8) { action(0); setMode(POSTURE); }
    field(1, bugled); return;
  }
  if (mode === CHARGE) {
    // the lane stepped before the call (the row's lanes)
    if (input(18) === 0) setMode(POSTURE);
    field(1, bugled); return;
  }
  if (mode !== POSTURE) { setMode(POSTURE); modeT = 0; }
  if (bugled < phase && input(19) === 0 && input(20) !== 0) {
    bugled = phase; setMode(BUGLE); signature(); field(1, bugled); return;
  }
  // posture: hold 18–26 m off, side-on steps, facing you
  const back: f64 = d < 18 ? -1 : d > 26 ? 1 : 0;
  const side: f64 = sin(t * 0.7 + input(13) * 9) > 0 ? 1 : -1;
  steer(back === 0 ? yaw + side * 1.2 : back > 0 ? yaw : yaw + Math.PI, back === 0 ? 1.2 : 3.5, 2.2);
  if (modeT > (p2 ? 2 : 3.2)) { lane(0, p2 ? 0.75 : 1.0, p2 ? 1.12 : 1); voice(1); setMode(CHARGE); }
  field(1, bugled);
}
