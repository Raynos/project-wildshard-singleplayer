// Week 3 (c9aaa62ab, main's day 22): the whip on the Dune Matriarch (PROGRESS-TRAILER §2.2 0:42.5). Allowed start
// conditions (§2.3): the quest stage a player reaches (the waymarks lit) and the boss summoned the way that quest
// summons it (`matriarch.arm()`), as the alpha's dn-matriarch does; the look follows her with lag; the whip is the
// player's weapon (`weapons.tryFire`). --opt {"spot": [x, z]} (default the alpha's (−10, −88)); {"prey": "strider"}
// instead whips the nearest dune strider on the ground from 6 m (the alpha's dn-whip), which reads better at dusk.
export const shot = {
  name: 'w3-whip',
  era: 'app',
  query: 'chunk=sunscar-dunes&nolock=1&skipintro=1&mute=1',
  warmSec: 25,
  frames: 240,
  setup: function setup() {
    const w = window.__wildshard.world, s = window.__wildshard.shard?.sunscar;
    if (!s) return { error: 'no sunscar plugin handle' };
    s.stage('waymarks-lit');
    if (s.matriarch?.state === 'dormant') s.matriarch.arm();
    for (const c of w.game.camera.children) c.visible = true;
    window.__takeFinal = () => ({ state: s.matriarch?.state ?? null, hp: s.matriarch?.hp ?? null });
    return { state: s.matriarch?.state ?? null };
  }.toString(),
  step: function step(f) {
    const w = window.__wildshard.world, p = w.player, s = window.__wildshard.shard.sunscar, o = window.__takeOpt;
    if (f === 0 && o.prey !== 'strider') { const sp = o.spot ?? [-10, -88]; p.spawn(sp[0], sp[1], 0); p.pitch = 0.25; }
    if (o.prey === 'strider' && f === 0) {
      const st = w.animals.animals.filter((a) => a.kind === 'duneStrider' && a.alive !== false)
        .sort((a, c) => a.position.distanceTo(p.position) - c.position.distanceTo(p.position))[0];
      if (st) { window.__prey = st; p.spawn(st.position.x + 5.5, st.position.z + 2.5, 0); p.pitch = -0.05; }
    }
    const b = o.prey === 'strider' ? window.__prey : s.matriarch?.body?.();
    if (b) {
      const want = Math.atan2(-(b.position.x - p.position.x), -(b.position.z - p.position.z));
      let d = want - p.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); p.yaw += d * (o.prey === 'strider' ? 0.15 : 0.08);
      const dy = b.position.y - (p.position.y + 1.65), dh = Math.hypot(b.position.x - p.position.x, b.position.z - p.position.z);
      const lo = o.prey === 'strider' ? -0.3 : 0.08;
      p.pitch += (Math.min(0.55, Math.max(lo, Math.atan2(dy, dh))) - p.pitch) * 0.05;
    }
    if (o.prey === 'strider' ? f === 30 || f === 75 || f === 130 : f === 90 || f === 150 || f === 200) { w.weapons.tryFire(); window.__takeEvents.push({ t: window.__sim.t, e: 'whip' }); }
  }.toString(),
  accept(r) { return r.events.some((e) => e.e === 'whip') ? [] : ['no whip']; },
};
