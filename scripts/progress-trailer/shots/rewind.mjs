// The rewind (PROGRESS-TRAILER §2.2 0:46): one look-and-fire input track, byte-identical on every build (--era,
// --query), hip-firing the crossbow at one point from the rewind spot (230, 0) (PT2: the ground is 0 m on all four
// builds). The track is authored on day 22 at a real stag; the other builds replay it and the bolt flies through
// their woods. Tracers are off (§2.3, `prepare`).
// --opt {"spot": [x, z], "aim": [x, y, z] (absolute; omitted on the authoring run: the nearest stag's head),
//        "fire": frame, "from": [dyaw, dpitch] (the look starts this far off the aim and eases on)}.
// The fire event logs the stag's head at the shot: a longer lead-in moves a grazing stag, so day 22 is shot twice (the
// second pass aims at the logged head) and the other builds replay that second pass's track.
export const shot = {
  name: 'rewind',
  era: 'app',
  query: 'chunk=pine-hollow&nolock=1&skipintro=1&mute=1&tracer=0',
  warmSec: 15,
  // tracers off the way a player does it (§2.3): days 15 / 22 through pause ▸ Settings ▸ Gameplay ▸ Tracer bolts
  // (their settings live in the save store), day 8 by `?tracer=0`; day 1 has none. Returns what the menu showed.
  prepare(page) {
    return page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((e) => e.textContent.trim().startsWith('Tracer bolts'));
      if (!b) return { tracers: 'no menu toggle' };
      const before = b.getAttribute('aria-checked');
      if (before === 'true') b.click(); // the toggle's own click handler, as a player's click on it
      return { tracers: { before, after: b.getAttribute('aria-checked') } };
    });
  },
  frames: 150,
  setup: function setup() {
    const w = window.__world ?? window.__wildshard.world, o = window.__takeOpt;
    let seed = 7654321;
    Math.random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; // the bolt's spread, repeatable
    const spot = o.spot ?? [230, 0];
    const weapon = w.weapons ?? window.__weapons ?? w.crossbow;
    window.__takeWeapon = weapon;
    // the target: on the authoring run, the stag nearest the spot (its head); else the given point
    const deer = (w.animals?.animals ?? []).filter((a) => a.kind === 'deer' && a.alive !== false);
    deer.sort((a, b) => Math.hypot(a.position.x - spot[0], a.position.z - spot[1]) - Math.hypot(b.position.x - spot[0], b.position.z - spot[1]));
    const stag = deer.find((a) => /stag/u.test(a.model?.variant ?? a.variant ?? '')) ?? null;
    const head = stag?.headWorld ? stag.headWorld(w.player.position.clone()) : null;
    const aim = o.aim ?? (head ? [head.x, head.y, head.z] : null);
    window.__aim = aim;
    window.__stag = stag;
    w.player.spawn(0, -235, Math.PI); // wait at the south gate; the take moves in on frame 0
    window.__takeFinal = () => ({ stagAlive: stag ? stag.alive !== false && stag.state !== 'dead' : null, stag: stag ? stag.position.toArray().map((v) => Math.round(v * 100) / 100) : null });
    const r2 = (v) => Math.round(v * 100) / 100;
    return { aim: aim?.map(r2) ?? null, stag: stag ? { p: stag.position.toArray().map(r2), v: stag.model?.variant ?? stag.variant ?? null, d: r2(Math.hypot(stag.position.x - spot[0], stag.position.z - spot[1])) } : null, weapon: weapon?.current?.id ?? weapon?.constructor?.name ?? null };
  }.toString(),
  step: function step(f) {
    const w = window.__world ?? window.__wildshard.world, p = w.player, o = window.__takeOpt, aim = window.__aim;
    const spot = o.spot ?? [230, 0];
    if (f === 0) { p.spawn(spot[0], spot[1], 0); p.pitch = 0; }
    if (!aim) return;
    const dx = aim[0] - p.position.x, dz = aim[2] - p.position.z;
    const yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(aim[1] - (p.position.y + 1.68), Math.hypot(dx, dz));
    const [oy, op] = o.from ?? [0.06, -0.03], k = Math.min(1, f / 40), e = 1 - (1 - k) ** 3; // ease onto the aim
    p.yaw = yaw + oy * (1 - e);
    p.pitch = pitch + op * (1 - e);
    if (f === (o.fire ?? 60)) {
      // where the target's head is at the shot (the authoring pass logs it; the next pass aims there, on every build)
      const h = window.__stag?.headWorld ? window.__stag.headWorld(p.position.clone()) : null;
      window.__takeEvents.push({ t: window.__sim.t, e: 'fire', head: h ? [h.x, h.y, h.z].map((v) => Math.round(v * 1000) / 1000) : null });
      window.__takeWeapon.tryFire();
    }
    if (window.__stag && !window.__killed && (window.__stag.alive === false || window.__stag.state === 'dead')) { window.__killed = true; window.__takeEvents.push({ t: window.__sim.t, e: 'kill' }); }
  }.toString(),
  accept(r) {
    const problems = [];
    if (!r.events.some((e) => e.e === 'fire')) problems.push('no shot');
    if (r.opt.authoring && !r.events.some((e) => e.e === 'kill')) problems.push(`the stag lives (${JSON.stringify(r.final)})`);
    return problems;
  },
};
