// SF27 Old Blackpaw's fight (data/eliteBrains.ts BLACKPAW_BRAIN; compiled behind elitePrelude.as). AMBUSH out of the den,
// ROAR-STUN (a ring swells round him for 1.1 s, the roar roots anyone inside), then a charge lane or a swipe up close;
// phase 2 roars twice as often and the ring is 11 m, not 8.
// Modes: 0 idle, 1 home, 2 lurk, 3 roar, 4 charge, 5 swipe, 6 stalk. Slots: 0 roarCd, 1 swipeT. Voices: 0 growl, 1 roar.
// Contacts: 0 roar, 1 phase-2 roar, 2 swipe. Actions: 0 burstOut, 1 roarFx.
const LURK: f64 = 2, ROAR: f64 = 3, CHARGE: f64 = 4, SWIPE: f64 = 5, STALK: f64 = 6;
let roarCd: f64 = 0, swipeT: f64 = 0;
function save(): void { field(1, roarCd); field(2, swipeT); }
export function on_tick(): void {
  begin(0);
  roarCd = input(21); swipeT = input(22);
  const dt = input(1), t = input(2), mode = input(4), p2 = input(6) !== 0, d = input(7), yaw = input(8);
  let modeT = input(5);
  roarCd -= dt;
  // (the ring tell's clock moved before the call)
  look(1, 0);
  if (mode === LURK) { action(0); setMode(ROAR); attack(1.1); voice(0); save(); return; }
  if (mode === ROAR) {
    steer(yaw, 0, 3);
    const k = Math.min(1, modeT / 1.1), ringR: f64 = p2 ? 11 : 8;
    ring(ringR * (0.7 + 0.3 * k), 0.35 + 0.6 * k * (0.7 + 0.3 * sin(t * 20)));
    if (modeT >= 1.1) {
      ringHide();
      voice(1);
      action(1);
      trauma(0.3);
      if (input(15) === 0) contact(p2 ? 1 : 0);
      roarCd = p2 ? 5.5 : 10;
      if (d > 5) { lane(0, p2 ? 0.6 : 0.75, p2 ? 1.12 : 1); setMode(CHARGE); } else setMode(STALK);
    }
    save(); return;
  }
  if (mode === CHARGE) {
    // the lane stepped before the call (the row's lanes)
    if (input(18) === 0) setMode(STALK);
    save(); return;
  }
  if (mode === SWIPE) {
    steer(yaw, 0, 2.5);
    if (swipeT >= 0) { swipeT -= dt; if (swipeT < 0) { voice(0); contact(2); } }
    if (modeT > 1.2) setMode(STALK);
    save(); return;
  }
  // stalk: walk you down, then pick a move
  if (mode !== STALK) { setMode(STALK); modeT = 0; }
  steer(yaw, d > 3 ? (p2 ? 4 : 3.2) : 0, 2.2);
  if (roarCd <= 0 && d < 12) { setMode(ROAR); attack(1.1); voice(0); }
  else if (d < 3.6) { setMode(SWIPE); swipeT = 0.55; attack(0.55); }
  else if (d > 7 && d < 22 && modeT > 2.2) { lane(0, p2 ? 0.6 : 0.75, p2 ? 1.12 : 1); setMode(CHARGE); }
  save();
}
