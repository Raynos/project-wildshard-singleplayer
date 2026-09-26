// Shot helpers. Yaw convention (Player.ts): forward = (−sin yaw, −cos yaw); π faces +Z (north).
export const yawTo = (fx, fz, tx, tz) => Math.atan2(-(tx - fx), -(tz - fz));
export const lerp = (a, b, k) => a + (b - a) * k;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const ease = (x) => { const k = clamp(x); return k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2; };
export const easeOut = (k) => 1 - (1 - clamp(k)) ** 3;
/** in-page: hide the weapon (rig shots) — Weapons.visible survives swaps */
export const NO_VIEWMODEL = `window.__world.weapons.visible = false;`;
export const VIEWMODEL = `window.__world.weapons.visible = true;`;
/** in-page: calm the fauna (no flee / aggro) */
export const CALM = `window.__world.animals.calm = true;`;
/** in-page: place the player (ground height) and face yaw/pitch */
export const tp = (x, z, yaw, pitch = 0, dy = 0) =>
  `(() => { const p = window.__world.player; p.position.set(${x}, window.__hf.heightAt(${x}, ${z}) + ${dy}, ${z}); p.yaw = ${yaw}; p.pitch = ${pitch}; if (p.velocity) p.velocity.set(0, 0, 0); })();`;
/** in-page: player look this frame */
export const look = (yaw, pitch) => `window.__world.player.yaw = ${yaw.toFixed(5)}; window.__world.player.pitch = ${pitch.toFixed(5)};`;
export const keyDown = (k) => `window.__world.player.keys.add('${k}');`;
export const keyUp = (k) => `window.__world.player.keys.delete('${k}');`;
/** tick(t, i, sb, step): true on the one step whose [t, t + step) holds the event time T */
export const at = (t, T, step) => T >= t - 1e-9 && T < t + step - 1e-9;
/** in-page expression: the nearest living animal whose kind matches `re` (a regex literal string) within `max` m, or null */
export const nearest = (re, max = 80) => `(() => { const w = window.__world, pp = w.player.position; return w.animals.animals.filter((a) => a.alive && !a.hidden && ${re}.test(a.kind) && a.position.distanceTo(pp) < ${max}).sort((a, b) => a.position.distanceTo(pp) - b.position.distanceTo(pp))[0] ?? null; })()`;
/** in-page: ease the player's look onto `v` (an expression for an animal) — yaw and pitch, gain k per step */
export const aimAt = (v, k = 0.12, dyAim = 0.8) => `(() => { const e = ${v}, p = window.__world.player; if (!e) return; const want = Math.atan2(-(e.position.x - p.position.x), -(e.position.z - p.position.z)); let d = want - p.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); p.yaw += d * ${k}; const dy = e.position.y + ${dyAim} - (p.position.y + 1.65), dh = Math.hypot(e.position.x - p.position.x, e.position.z - p.position.z); p.pitch += (Math.atan2(dy, dh) - p.pitch) * ${k}; })();`;
/** in-page expression describing the prey for meta.json */
export const PREY = `(() => { const e = window.__prey, p = window.__world.player.position; return e ? { kind: e.kind, d: +e.position.distanceTo(p).toFixed(1) } : { kinds: [...new Set(window.__world.animals.animals.filter((a) => a.alive && a.position.distanceTo(p) < 120).map((a) => a.kind))] }; })()`;
/** join in-page JS snippets (ticks assemble their events this way) */
export const js = (...parts) => parts.join('');
/**
 * Node side: a rig's pose at shot time t, the same sampling as capture.mjs's in-page tr.pose (Catmull-Rom through the
 * keys, the whole move eased in-out when `rig.ease`), without the hand-held breath. For titles that track the camera
 * (the Nine Dragon teaser's altimeter). Absolute rigs only (no `rel`).
 */
export const rigAt = (rig, t) => {
  const keys = rig.keys, n = keys.length, t0 = keys[0].t, t1 = keys[n - 1].t;
  const easeIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
  const T = rig.ease ? t0 + easeIO(clamp((t - t0) / (t1 - t0))) * (t1 - t0) : t;
  const cr = (p0, p1, p2, p3, u) => { const u2 = u * u, u3 = u2 * u; return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3); };
  const at = (field) => {
    if (T <= t0) return keys[0][field];
    if (T >= t1) return keys[n - 1][field];
    let i = 0; while (i < n - 2 && T > keys[i + 1].t) i++;
    const a = keys[Math.max(0, i - 1)], b = keys[i], c = keys[i + 1], d = keys[Math.min(n - 1, i + 2)];
    const u = (T - b.t) / (c.t - b.t);
    return [0, 1, 2].map((j) => cr(a[field][j], b[field][j], c[field][j], d[field][j], u));
  };
  return { p: at('p'), l: at('l') };
};
