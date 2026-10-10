// Day 1 (568a1463f): stalk a stag in Pine Hollow, aim down the crossbow's sight and drop it (PROGRESS-TRAILER §2.2).
// The stag is one the day-1 build spawned itself (its seeded herds); the player starts ~25 m out with no ground or
// trunk in the sight line, crouch-steps in (the stag alerts and looks up), raises the sight and fires at the head with
// the drop held over (62 m/s bolts, 9.8 m/s² gravity) before it bolts.
// --opt {"pick": k, "dist": m, "lift": m} takes the k-th approach with a clear line over the ground (the five biggest
// stags × 16 bearings), the range and a hold-over scale; the take is refused unless the bolt kills.
export const shot = {
  name: 'd01-hunt',
  era: 'legacy',
  query: 'nolock=1&skipintro=1&mute=1',
  warmSec: 12,
  frames: 330,
  setup: function setup() {
    const w = window.__world, o = window.__takeOpt;
    let seed = 1234567;
    Math.random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; // the bolt's spread, repeatable
    const deer = w.animals.animals.filter((a) => a.kind === 'deer' && a.alive);
    deer.sort((a, b) => b.mesh.scale.x - a.mesh.scale.x); // stags are scaled 1.04–1.12, hinds 0.94–1.02
    // approaches with a clear line over the ground: sample the terrain under the sight line (player.spawn drops the
    // player onto heightAt, so it doubles as the height query); the k-th clear one is taken (--opt pick)
    const ground = (x, z) => { w.player.spawn(x, z, 0); return w.player.position.y; };
    const clear = [];
    for (const stag of deer.slice(0, 5)) {
      for (let s = 0; s < 16; s++) {
        const side = (s / 16) * Math.PI * 2, dist = o.dist ?? 25;
        const px = stag.position.x + Math.sin(side) * dist, pz = stag.position.z + Math.cos(side) * dist;
        if (Math.max(Math.abs(px), Math.abs(pz)) > 230) continue;
        const eyeY = ground(px, pz) + 1.2, tgtY = stag.position.y + stag.dims.bodyY;
        let ok = Math.abs(eyeY - 1.2 - stag.position.y) < 6;
        const lx = stag.position.x - px, lz = stag.position.z - pz, len = Math.hypot(lx, lz);
        for (let i = 1; i < 24 && ok; i++) {
          const u = i / 24, gx = px + lx * u, gz = pz + lz * u;
          if (ground(gx, gz) + 0.5 > eyeY + (tgtY - eyeY) * u) ok = false;
          // no trunk within half a metre of the sight line (the bolt passes trunks; the camera doesn't)
          for (const tr of w.forest.nearby(gx, gz, 2)) {
            const off = Math.abs((tr.x - px) * lz - (tr.z - pz) * lx) / len;
            if (off < tr.r + 0.5) ok = false;
          }
        }
        if (ok) clear.push({ stag, side, dist, px, pz });
      }
    }
    if (clear.length === 0) return { error: 'no clear approach' };
    const pick = clear[Math.min(o.pick ?? 0, clear.length - 1)];
    const { stag, px, pz } = pick;
    const yaw = Math.atan2(px - stag.position.x, pz - stag.position.z); // yaw 0 faces −z: face the stag
    w.player.spawn(0, -236, Math.PI); // wait at the south gate, far from every herd; the take moves in on frame 0
    window.__approach = { px, pz, yaw };
    w.crossbow.enabled = true; w.crossbow.model.visible = true; w.crossbow.adsHeld = false;
    const ev = window.__takeEvents, now = () => window.__sim?.t ?? 0;
    const wrap = (obj, key, name, fn = () => ({})) => { const prev = obj[key]; obj[key] = (...a) => { ev.push({ t: now(), e: name, ...fn(...a) }); return prev?.(...a); }; };
    wrap(w.crossbow, 'onFire', 'fire');
    wrap(w.crossbow, 'onHit', 'hit', (kind, headshot, killed) => ({ headshot, killed }));
    wrap(w.crossbow, 'onImpact', 'impact', (surface) => ({ surface }));
    wrap(w.animals, 'onKill', 'kill', (a) => ({ kind: a.kind }));
    wrap(w.player, 'onStep', 'step');
    window.__stag = stag;
    window.__takeFinal = () => ({ stagAlive: stag.alive, stagState: stag.state, player: w.player.position.toArray().map((v) => Math.round(v * 10) / 10) });
    return { clear: clear.length, side: pick.side, stag: stag.position.toArray().map((v) => Math.round(v * 10) / 10), scale: stag.mesh.scale.x, deer: deer.length, from: [px, pz].map((v) => Math.round(v * 10) / 10), lift: o.lift ?? 1 };
  }.toString(),
  step: function step(f, t, S) {
    const w = window.__world, p = w.player, stag = window.__stag;
    const aimAt = () => {
      const head = stag.headWorld(p.position.clone()); // the head sphere: body shots (55) don't drop a 60 hp deer
      const dx = head.x - p.position.x, dz = head.z - p.position.z, d = Math.hypot(dx, dz);
      const eye = w.game.camera.position, drop = 0.5 * 9.8 * (d / 62) ** 2; // 62 m/s bolts
      return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(head.y + drop * (S.lift ?? 1) - eye.y, d) };
    };
    const ease = (a, b, k) => a + (b - a) * k;
    if (f === 0) { const s = window.__approach; p.spawn(s.px, s.pz, s.yaw); p.pitch = 0; }
    if (f < 36) { p.keys.add('KeyW'); p.keys.add('ControlLeft'); } // the stalk: crouched steps in (deer alert at 30 m)
    else { p.keys.delete('KeyW'); if (f > 150) p.keys.delete('ControlLeft'); }
    const aim = aimAt();
    const k = f < 30 ? 0.05 : 0.2; // drift onto the stag while walking, settle hard before the shot
    p.yaw = ease(p.yaw, aim.yaw, k) + Math.sin(f * 0.21) * 0.0012; // a breathing hand
    p.pitch = ease(p.pitch, aim.pitch, k) + Math.sin(f * 0.17) * 0.0009;
    if (f === 40) w.crossbow.adsHeld = true;
    if (f === 76) { w.crossbow.tryFire(); const n = stag.headWorld(p.position.clone()).project(w.game.camera); window.__takeEvents.push({ t: window.__sim.t, e: 'aim', ndc: [n.x, n.y].map((v) => Math.round(v * 100) / 100) }); }
    if (f === 250) w.crossbow.adsHeld = false;
  }.toString(),
  accept(r) {
    const kill = r.events.find((e) => e.e === 'kill');
    return kill ? [] : [`no kill (final ${JSON.stringify(r.final)})`];
  },
};
