// Shard IV — Nine Dragon Stack, the 15 s COMING SOON teaser (E169 F3). The in-engine PARTIAL shard: Lantern Square at
// +125 m on the rim of the Yamen Well, the Well's galleries / crossings / gondola dissolving into silk mist, the
// stair-street east. Every frame stays inside the built volume (the mist and tight framing hide the fragment's edges).
//
// Coordinates are layout.ts's (x east, z SOUTH, y altitude; the square's datum Y0 = 125), absolute (no `rel`: the shard's
// heightfield is a flat datum 125 m under the build). Rig shots park the player at the spawn under a free camera
// (bootstrap `freeCamera`: no player update, the world culls / streams around the camera). Gameplay shots put the
// player on the stone and drive the engine's own sword (the rigged Neon Jian + Fei Zhua arms).
// Player yaw: forward = (−sin yaw, −cos yaw), so east (+x) is −π/2 and north (−z) is 0.
import { at, js } from './lib.mjs';

const URL = 'chunk=nine-dragon-stack';
const D = Math.PI / 180;
/** in-page: a free camera with the player parked at the spawn (no fall, no respawn, no footsteps) */
const FREE = `(() => { const w = window.__world; w.freeCamera = true; w.weapons.visible = false; const p = w.player; p.position.set(0.95, 125, 7.5); if (p.velocity) p.velocity.set(0, 0, 0); p.keys?.clear(); })();`;
/** in-page: the player standing on the stone at (x, y, z), facing yaw / pitch (radians), the jian in hand */
const stand = (x, y, z, yaw, pitch) => `(() => { const w = window.__world; w.freeCamera = false; w.weapons.visible = true; const p = w.player; p.position.set(${x}, ${y}, ${z}); p.yaw = ${yaw}; p.pitch = ${pitch}; if (p.velocity) p.velocity.set(0, 0, 0); p.keys?.clear(); })();`;
/**
 * in-page: the world clock (the movers: the gondola runs x = −23 … −5 on its cable at z −12, +109 m; the train, the
 * drones) set so a shot finds them where it wants them. Forward only: the gondola's period is 2π / 0.12 = 52.36 s.
 */
const clockAt = (t) => `(() => { const g = window.__world.game; let T = ${t}; while (T < g.clock.elapsedTime) T += 2 * Math.PI / 0.12; g.clock.elapsedTime = T; })();`;
/** the gondola crosses the shaft's axis (x −14) going east at world time 5.167 (+ k · 52.36 s) */
const GONDOLA_MID = 5.167;
/**
 * in-page per tick: the weapon manager's stow blend eased 1 → 0 between t0 and t1 (the jian drawn up into the frame;
 * Weapons.update copies `stowT` onto the held weapon's `holster` every frame, so that is the knob, not `holster`)
 */
const draw = (t, t0, t1) => {
  const k = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
  const h = t < t0 ? 1 : 1 - (1 - (1 - k) ** 3);
  return `window.__world.weapons.stowT = ${h.toFixed(4)};`;
};
/** in-page per tick: the player's look eased between two poses (yaw / pitch in degrees, player convention) */
const lookLerp = (t, t0, t1, a, b) => {
  const k = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
  const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
  return `window.__world.player.yaw = ${((a[0] + (b[0] - a[0]) * e) * D).toFixed(5)}; window.__world.player.pitch = ${((a[1] + (b[1] - a[1]) * e) * D).toFixed(5)};`;
};

export const shots = [
  // 1 · RISE: up the Yamen Well's main shaft out of the silk mist, the crossings dropping past the lens (the timber bridge
  // at z 4 whips by 4 m in front), the red gondola on its cable mid-frame, lit galleries streaming down both sides.
  // On the shaft's axis (x −14), 2 m in front of the south galleries' fronts (z 10.2), looking north up the canyon.
  { name: 'nd-rise', shard: 'nine-dragon', url: URL, secs: 3.6, warm: 240,
    setup: FREE, afterWarm: clockAt(GONDOLA_MID - 2.4),
    // (no global ease: it accelerates out of the mist and is still climbing hard on the cut)
    rig: { carryPlayer: false, handheld: 0.2, keys: [
      { t: 0.0, p: [-14.2, 62, 8.0], l: [-13.8, 70, -30], fov: 54 },
      { t: 1.2, p: [-14.1, 70, 8.0], l: [-13.5, 79, -30], fov: 54 },
      { t: 2.4, p: [-14.0, 88, 7.9], l: [-13.1, 96, -30], fov: 54 },
      { t: 3.6, p: [-13.8, 116, 7.8], l: [-12.6, 120, -30], fov: 55 },
    ] },
    portrait: {
      rig: { carryPlayer: false, handheld: 0.2, keys: [
        { t: 0.0, p: [-14.2, 62, 8.0], l: [-13.8, 73, -30], fov: 80 },
        { t: 1.2, p: [-14.1, 70, 8.0], l: [-13.5, 82, -30], fov: 80 },
        { t: 2.4, p: [-14.0, 88, 7.9], l: [-13.1, 99, -30], fov: 80 },
        { t: 3.6, p: [-13.8, 116, 7.8], l: [-12.6, 122, -30], fov: 80 },
      ] },
    } },
  // 2 · BREACH: up the east wall's gallery tops and over the square's balustrade: Lantern Square opens in the rain, the
  // paifang (九龍, plaque at ~+135) ahead, the crowd under umbrellas, the neon masts on the lip to the left.
  { name: 'nd-breach', shard: 'nine-dragon', url: URL, secs: 3.4, warm: 240,
    setup: FREE, afterWarm: clockAt(40),
    // (no global ease: it comes in climbing, crests the rail and settles on the gate)
    rig: { carryPlayer: false, handheld: 0.3, keys: [
      { t: 0.0, p: [-9.6, 119.2, 5.4], l: [4, 127, -14], fov: 56 },
      { t: 0.8, p: [-6.2, 124.6, 4.5], l: [5, 130, -20], fov: 55 },
      { t: 1.8, p: [-1.8, 127.0, 3.0], l: [6, 132, -24.5], fov: 54 },
      { t: 3.4, p: [2.4, 127.3, 0.6], l: [6.05, 133, -24.5], fov: 52 },
    ] },
    portrait: {
      rig: { carryPlayer: false, handheld: 0.3, keys: [
        { t: 0.0, p: [-9.6, 119.2, 5.4], l: [4, 128, -14], fov: 80 },
        { t: 0.8, p: [-6.2, 124.6, 4.5], l: [5, 131, -20], fov: 79 },
        { t: 1.8, p: [-1.8, 127.0, 3.0], l: [6, 133, -24.5], fov: 78 },
        { t: 3.4, p: [2.4, 127.3, 0.6], l: [6.05, 134, -24.5], fov: 78 },
      ] },
    } },
  // 3 · JIAN: first person at the stair-street's foot, facing east up the flights and the sign column: the Neon Jian
  // drawn up into the frame, a slash and a backhand in the rain over the wet stone's neon streaks.
  { name: 'nd-jian', shard: 'nine-dragon', url: URL, secs: 3.0, warm: 180,
    setup: stand(17.2, 125, 6.2, -92 * D, 4 * D), afterWarm: clockAt(60),
    tick: (t, i, sb, step) => js(draw(t, 0.1, 0.45), lookLerp(t, 0, 3.0, [-92, 4], [-88, 9]),
      at(t, 0.62, step) || at(t, 1.29, step) ? 'window.__world.weapons.tryFire();' : '') },
  // 4 · STAIRS: gliding up the stair-street's first flight over the umbrellas (the crowd fills the flight: at eye height
  // the lens runs into them), the signs 麵 牙科 火鍋 旅館 either side and the stair paifang at the top (tread line
  // y ≈ 125 + 0.525 (x − 22); the camera ~3 m over it)
  { name: 'nd-stairs', shard: 'nine-dragon', url: URL, secs: 2.8, warm: 240,
    setup: FREE, afterWarm: clockAt(80),
    rig: { carryPlayer: false, ease: true, handheld: 0.35, keys: [
      { t: 0.0, p: [20.6, 128.0, 5.6], l: [56, 138.5, 6.2], fov: 56 },
      { t: 2.8, p: [29.5, 132.3, 6.1], l: [56, 140.5, 6.0], fov: 55 },
    ] },
    portrait: {
      rig: { carryPlayer: false, ease: true, handheld: 0.35, keys: [
        { t: 0.0, p: [20.6, 128.0, 5.6], l: [56, 140.5, 6.2], fov: 80 },
        { t: 2.8, p: [29.5, 132.3, 6.1], l: [56, 142.5, 6.0], fov: 80 },
      ] },
    } },
  // Preliminary fall cut, retained as capture history; the final portrait teaser uses the playable grapple below. Off the south
  // rim on the shaft's axis, the look tipping over into the drop, accelerating down past the galleries, the timber
  // crossing at z 4 whipping by 2.5 m off the lens, into the silk mist (the rise's clear column, x −14, z ≈ 7.6)
  { name: 'nd-fall', shard: 'nine-dragon', url: URL, secs: 2.8, warm: 240,
    setup: FREE, afterWarm: clockAt(GONDOLA_MID + 3),
    rig: { carryPlayer: false, handheld: 0.3, keys: [
      { t: 0.00, p: [-14.0, 127.6, 9.8], l: [-14, 124.5, -2], fov: 58, roll: 0 },
      { t: 0.40, p: [-14.0, 126.9, 8.6], l: [-14, 116, -4], fov: 60, roll: 0.01 },
      { t: 0.80, p: [-14.1, 123.2, 7.8], l: [-14, 104, -3], fov: 64, roll: 0.025 },
      { t: 1.28, p: [-14.2, 115.0, 7.6], l: [-14, 92, -1], fov: 68, roll: 0.04 },
      { t: 1.84, p: [-14.3, 101.5, 7.6], l: [-14, 76, 0], fov: 70, roll: 0.05 },
      { t: 2.40, p: [-14.4, 84.0, 7.6], l: [-14, 58, 1], fov: 72, roll: 0.06 },
      { t: 2.72, p: [-14.4, 72.0, 7.6], l: [-14, 46, 1.5], fov: 72, roll: 0.065 },
    ] },
    portrait: {
      rig: { carryPlayer: false, handheld: 0.3, keys: [
        { t: 0.00, p: [-14.0, 127.6, 9.8], l: [-14, 124.0, -2], fov: 80, roll: 0 },
        { t: 0.40, p: [-14.0, 126.9, 8.6], l: [-14, 115, -4], fov: 82, roll: 0.01 },
        { t: 0.80, p: [-14.1, 123.2, 7.8], l: [-14, 103, -3], fov: 86, roll: 0.025 },
        { t: 1.28, p: [-14.2, 115.0, 7.6], l: [-14, 91, -1], fov: 90, roll: 0.04 },
        { t: 1.84, p: [-14.3, 101.5, 7.6], l: [-14, 75, 0], fov: 92, roll: 0.05 },
        { t: 2.40, p: [-14.4, 84.0, 7.6], l: [-14, 57, 1], fov: 92, roll: 0.06 },
        { t: 2.72, p: [-14.4, 72.0, 7.6], l: [-14, 45, 1.5], fov: 92, roll: 0.065 },
      ] },
    } },
  // 5 · GRAPPLE: actual Fei Zhua gameplay from the Well rim. LOCK claims the visible gallery ring; a fresh JUMP fires
  // the claw and Rapier carries the player across the rail to the lower gallery. The camera and left-arm animation are
  // the game's own, with no rigged camera translation.
  { name: 'nd-grapple', shard: 'nine-dragon', url: URL, secs: 2.8, warm: 180,
    setup: stand(-19.5, 125, 12.25, -0.6, -0.35),
    afterWarm: js(stand(-19.5, 125, 12.25, -0.6, -0.35), 'window.__world.lockSys.toggle();'),
    tick: (t, i, sb, step) => js(
      at(t, 0.24, step) ? 'window.__world.player.touchJump = true;' : '',
      lookLerp(t, 1.25, 2.8, [-34.38, -20.05], [-10, -9]),
    ),
    probe: `(() => { const w = window.__world; return { position: w.player.position.toArray(), entered: w.hud.entered }; })()`,
  },
  // 6 · WIDE (the end card over it): the Well's edge, just out over the south rim (the balustrade out of frame), looking
  // north down the canyon's ladder of crossings to the far gate; a slow crane up
  { name: 'nd-wide', shard: 'nine-dragon', url: URL, secs: 3.6, warm: 240,
    setup: FREE, afterWarm: clockAt(GONDOLA_MID - 1),
    rig: { carryPlayer: false, ease: true, handheld: 0.15, keys: [
      { t: 0.0, p: [-19.5, 127.0, 9.8], l: [-19.5, 125.4, 0], fov: 61 },
      { t: 3.6, p: [-19.5, 128.6, 9.2], l: [-19.5, 127.2, -0.6], fov: 59 },
    ] },
    portrait: {
      rig: { carryPlayer: false, ease: true, handheld: 0.15, keys: [
        { t: 0.0, p: [-19.5, 127.0, 9.8], l: [-19.5, 125.0, 0], fov: 80 },
        { t: 3.6, p: [-19.5, 128.6, 9.2], l: [-19.5, 126.8, -0.6], fov: 78 },
      ] },
    } },
];
