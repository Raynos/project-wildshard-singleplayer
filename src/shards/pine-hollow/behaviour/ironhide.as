// SF27 Old Ironhide's fight (data/eliteBrains.ts IRONHIDE_BRAIN; compiled behind elitePrelude.as by
// scripts/bake/species-scripts.mjs in a clean export). He trots round you at ~13 m (the tangent, bent in or out to hold the
// radius), then GORE CHARGE down a lane through you; phase 2 tells quicker, runs faster and often charges again at once.
// Modes: 0 idle, 1 home, 2 circle, 3 charge. Slot 0: again (a second charge is owed). Voices: 0 squeal, 1 grunt.
const CIRCLE: f64 = 2, CHARGE: f64 = 3;
export function on_tick(): void {
  begin(0);
  let again = input(21);
  const dt = input(1), mode = input(4), p2 = input(6) !== 0, d = input(7), yaw = input(8);
  let modeT = input(5);
  look(1, 0);
  if (mode === CHARGE) {
    // the lane stepped before the call (the row's lanes)
    if (input(16) === 2 && input(17) < dt * 1.5) voice(0);
    if (input(18) === 0) {
      if (again !== 0) { again = 0; lane(0, 0.55, 1.1); field(1, again); return; }
      setMode(CIRCLE);
    }
    field(1, again); return;
  }
  const want: f64 = 13, side: f64 = sin(input(13) * 31) > 0 ? 1 : -1;
  const tangent = yaw + side * Math.PI / 2, bend = Math.max(-1, Math.min(1, (d - want) / 8)) * 0.9 * side;
  steer(tangent - bend, 4.2, 2.8);
  if (mode === 0 || mode === 1) { setMode(CIRCLE); modeT = 0; }
  if (modeT > (p2 ? 1.4 : 2.6) && d < 30) {
    lane(0, p2 ? 0.62 : 0.9, p2 ? 1.12 : 1);
    again = p2 && random() < 0.55 ? 1 : 0;
    voice(1);
    setMode(CHARGE); signature();
  }
  field(1, again);
}
