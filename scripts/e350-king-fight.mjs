#!/usr/bin/env node
// e350-king-fight.mjs — E350 F-X2: a scripted Antler King fight in a real build (phone tier, iPhone 16 Pro), measuring
// every hit against his visible body. Per phase (`?boss=antler-king&bossPhase=<n>&bossGod=1`, the fight's own harness):
//
//   sweep   the player placed round him (distance, angle off his heading), the fight's sweep run (its own mode, wind-up
//           and blow); per spot: did the blow hurt (ctx.hurt 24) and did his skinned mesh come within the player's
//           capsule (0.38 m) during the swing (the CPU-skinned hull, every frame)? hurt & touched = a hit; hurt & not = a
//           hit from air; touched & not hurt = a miss through his body
//   stomp   the rearing strike run; where the forehooves land (their bones at the slam) against the root ring's start;
//           a player on the ground at 3 / 4.4 / 6 m: hurt by the ring (20)?
//   lane    the phase-III lane charge locked on a point, the player then stood off the lane's line by 0 … 4.5 m; hurt
//           (32) and his mesh's closest pass
//   bolts   rays from a standing eye at 15 m (front, 40°, side) through `animals.raycast` (the bolt's own test) against
//           the skinned mesh's first triangle: over his silhouette (a grid), plus aimed at the ribcage and the face; and
//           real bolts fired (Crossbow.fire) at the ribcage and the face: where they land, rib / headshot
//
//   node scripts/e350-king-fight.mjs --url=http://127.0.0.1:<port> [--out=art/pine-hollow/round-<n>-e350-king-fight]
//        [--phases=1,2,3] [--label=after]
// Writes <out>/fight-<label>.json and (with --strip) <out>/strip.jpg: frames with his hit volumes drawn over him.
// One headless Chromium on Metal (--mute-audio, the harness mute), closed at the end.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { debugSettings } from './debug-settings.mjs';

const { chromium, devices } = await import('playwright');
const ROOT = resolvePath(new URL('..', import.meta.url).pathname);
const argv = process.argv.slice(2);
const flag = (n, d) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const URL_BASE = flag('url', 'http://127.0.0.1:4400');
const OUT = resolvePath(ROOT, flag('out', 'progress/e350-king-fight'));
const LABEL = flag('label', 'after');
const PHASES = flag('phases', '1,2,3').split(',').map(Number);
const STRIP = argv.includes('--strip');
mkdirSync(OUT, { recursive: true });
const iphone = devices['iPhone 16 Pro'];
const CTX = { userAgent: iphone.userAgent, isMobile: true, hasTouch: true, deviceScaleFactor: 3, viewport: { width: 390, height: 844 } };

/** the in-page kit (installed once per page): the tests below call it */
function installKit() {
  const W = window.__world, AK = window.__antlerKing, f = AK.fight, pl = W.player, cam = W.game.camera;
  const V = pl.position.constructor;
  const hurts = [];
  const ctx = f.ctx, origHurt = ctx.hurt;
  ctx.hurt = (a, dmg) => { hurts.push({ t: performance.now(), dmg, king: a === f.king }); origHurt(a, dmg); };
  // the held mode: he stands, faces where he faces, does nothing (the tests put him in a move and back)
  const origFight = f.fight.bind(f);
  f.fight = (k, dt, t) => { if (f.mode === 'e350-hold') { k.setMotion(k.yaw, 0, 1); f.open = Math.max(0, f.open - dt); return; } origFight(k, dt, t); };
  // his heading frozen while a test runs (the fight turns him to you; the blows are measured off a fixed heading)
  let freeze = false;
  const patched = new WeakSet();
  const patch = (k) => { if (patched.has(k)) return; patched.add(k); const o = k.setMotion.bind(k); k.setMotion = (y, s, r) => { if (freeze) o(k.yaw, f.mode === 'stalk3' ? s : 0, r); else o(y, s, r); }; };
  const frame = () => new Promise((resolve) => { requestAnimationFrame(() => { resolve(); }); });
  const C = () => f.king.position;
  // the skinned hull's world vertices (the King's mesh: a SkinnedMesh, CPU-skinned through three's getVertexPosition)
  const v = new V();
  const parts = (() => {
    const m = f.king.mesh, g = m.geometry, si = g.getAttribute('skinIndex'), sw = g.getAttribute('skinWeight'), P = g.getAttribute('position');
    const names = m.skeleton.bones.map((b) => b.name);
    const part = new Uint8Array(P.count);   // 1 body (torso, neck, shoulders, haunches), 2 face, 3 rack, 0 limbs / tail
    for (let i = 0; i < P.count; i++) {
      let best = 0, bw = -1;
      for (let c = 0; c < 4; c++) { const w = sw.getComponent(i, c); if (w > bw) { bw = w; best = si.getComponent(i, c); } }
      const n = names[best] ?? '';
      if (n === 'head') part[i] = P.getY(i) * 2.6 > 7.6 || Math.abs(P.getX(i)) * 2.6 > 1.1 ? 3 : 2;
      else if (['body', 'chest', 'hips', 'neck'].includes(n) || /_sh$|_hip$/.test(n)) part[i] = 1;
    }
    return part;
  })();
  function skinned() {
    const m = f.king.mesh, n = m.geometry.getAttribute('position').count, out = new Float32Array(n * 3);
    m.updateMatrixWorld(true); m.skeleton.update();
    for (let i = 0; i < n; i++) { m.getVertexPosition(i, v); v.applyMatrix4(m.matrixWorld); out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z; }
    return out;
  }
  /** his mesh's closest gap to the player's capsule (feet → +1.8 m, r 0.38): < 0 is inside it */
  function gapToPlayer(S) {
    const p = pl.position, y0 = p.y + 0.38, y1 = p.y + 1.8 - 0.38;
    let best = Infinity;
    for (let i = 0; i < S.length; i += 3) {
      const dy = S[i + 1] < y0 ? y0 - S[i + 1] : S[i + 1] > y1 ? S[i + 1] - y1 : 0;
      const d = Math.hypot(S[i] - p.x, dy, S[i + 2] - p.z) - 0.38;
      if (d < best) best = d;
    }
    return best;
  }
  function place(d, angDeg, face = true) {
    const k = f.king, a = k.yaw + angDeg * Math.PI / 180;
    const x = k.position.x + Math.sin(a) * d, z = k.position.z + Math.cos(a) * d;
    // the player's yaw faces (−sin, −cos): toward him
    pl.spawn(x, z, face ? Math.atan2(x - k.position.x, z - k.position.z) : pl.yaw);
  }
  function hold() { f.mode = 'e350-hold'; f.lane.cancel(); f.tellRing.hide(); f.sweepCd = 1e9; f.stompCd = 1e9; f.callCd = 1e9; f.clearAdds(); }
  // his spot: the clearing's centre (the reward point is 4 m south of it), facing +z, before every test
  const home = (dz = 0) => { const rp = f.rewardPoint(); f.king.place(rp.x, rp.z - 4 + dz, 0); };
  async function settle(dz = 0) { hold(); f.king.cancelAttack(); home(dz); for (let i = 0; i < 40; i++) { home(dz); await frame(); } }
  async function sweep(d, ang) {
    await settle();
    freeze = true; patch(f.king);
    place(d, ang); await frame(); await frame();
    const h0 = hurts.length;
    f.setMode('sweep'); f.king.mem.act = 1; f.king.startAttack(0.9);
    let minGap = Infinity, rackLow = Infinity, frames = 0;
    while (f.mode === 'sweep' && frames < 200) {
      await frame(); frames++;
      const a = f.king.attackPhase;
      if (a >= 0.5) { const S = skinned(); minGap = Math.min(minGap, gapToPlayer(S)); for (let i = 0; i < S.length; i += 3) if (parts[i / 3] === 3) rackLow = Math.min(rackLow, S[i + 1] - f.king.position.y); }
    }
    const hurt = hurts.slice(h0).some((h) => h.dmg === 24 && h.king);
    const real = { d: Math.hypot(pl.position.x - C().x, pl.position.z - C().z) };
    freeze = false; hold();
    return { d, ang, dReal: Number(real.d.toFixed(2)), hurt, minGap: Number(minGap.toFixed(2)), rackLowY: Number(rackLow.toFixed(2)) };
  }
  async function stomp(d, ang) {
    await settle();
    freeze = true; patch(f.king);
    place(d, ang); await frame(); await frame();
    const h0 = hurts.length;
    f.setMode('stomp'); f.king.mem.act = 2; f.king.startAttack(1.0);
    let hooves = null, ringStart = null, frames = 0, minGap = Infinity;
    while (f.mode !== 'open' && frames < 400) {
      const before = f.mode;
      await frame(); frames++;
      if (f.king.attackPhase > 0.85 && f.mode === 'stomp') minGap = Math.min(minGap, gapToPlayer(skinned()));
      if (before === 'stomp' && f.mode === 'waves' && hooves === null) {
        const k = f.king, out = [];
        for (const n of ['armL_hoof', 'armR_hoof']) { const b = k.mesh.getObjectByName(n); b.getWorldPosition(v); out.push(Number(Math.hypot(v.x - k.position.x, v.z - k.position.z).toFixed(2))); }
        hooves = out; ringStart = Number(f.waves[0].r.toFixed(2));
      }
    }
    const hurt = hurts.slice(h0).some((h) => h.dmg === 20 && h.king);
    freeze = false; hold();
    return { d, ang, hurtByRing: hurt, forehoovesOut: hooves, ringStartR: ringStart, slamGap: Number(minGap.toFixed(2)) };
  }
  async function lane(off) {
    await settle(-8);
    freeze = true; patch(f.king);
    const k = f.king, P0x = k.position.x + Math.sin(k.yaw) * 16, P0z = k.position.z + Math.cos(k.yaw) * 16;
    // the player 16 m ahead, then stood `off` m off the lane's line (square to his heading)
    const sx = Math.cos(k.yaw), sz = -Math.sin(k.yaw);
    pl.spawn(P0x + sx * off, P0z + sz * off, k.yaw + Math.PI);
    await frame();
    const h0 = hurts.length;
    f.setMode('stalk3'); f.modeT = -100;
    k.mem.act = 4; f.lane.start(k, P0x, P0z, 1.1);
    let minGap = Infinity, frames = 0, pass = Infinity;
    const p0 = pl.position.clone();
    while (f.lane.busy && frames < 600) {
      await frame(); frames++;
      if (f.lane.state === 'run') { minGap = Math.min(minGap, gapToPlayer(skinned())); pass = Math.min(pass, Math.hypot(pl.position.x - k.position.x, pl.position.z - k.position.z)); }
    }
    const hurt = hurts.slice(h0).some((h) => h.dmg === 32 && h.king);
    freeze = false; hold();
    return { off, hurt, minGap: Number(minGap.toFixed(2)), closestPass: Number(pass.toFixed(2)), playerMoved: Number(pl.position.distanceTo(p0).toFixed(2)) };
  }
  // ── bolts: rays from a standing eye ──
  function meshRay(S, o, d) {
    const idx = f.king.mesh.geometry.getIndex(), I = idx.array;
    let best = Infinity, part = -1;
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
      const e1x = S[b] - S[a], e1y = S[b + 1] - S[a + 1], e1z = S[b + 2] - S[a + 2], e2x = S[c] - S[a], e2y = S[c + 1] - S[a + 1], e2z = S[c + 2] - S[a + 2];
      const px = d.y * e2z - d.z * e2y, py = d.z * e2x - d.x * e2z, pz = d.x * e2y - d.y * e2x, det = e1x * px + e1y * py + e1z * pz;
      if (Math.abs(det) < 1e-12) continue;
      const inv = 1 / det, tx = o.x - S[a], ty = o.y - S[a + 1], tz = o.z - S[a + 2], u = (tx * px + ty * py + tz * pz) * inv;
      if (u < 0 || u > 1) continue;
      const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x, w = (d.x * qx + d.y * qy + d.z * qz) * inv;
      if (w < 0 || u + w > 1) continue;
      const tt = (e2x * qx + e2y * qy + e2z * qz) * inv;
      if (tt > 1e-4 && tt < best) { best = tt; part = parts[I[t]]; }
    }
    return { t: best, part };
  }
  async function bolts(pose) {
    await settle();
    freeze = true; patch(f.king);
    if (pose === 'rear') { f.king.mem.act = 3; f.king.startAttack(1.6); for (let i = 0; i < 50; i++) await frame(); }
    const out = { pose, views: [] };
    for (const [d, ang] of [[15, 0], [14, 40], [13, 90]]) {
      place(d, ang); await frame(); await frame();
      const S = skinned(), k = f.king;
      const eye = new V(pl.position.x, pl.position.y + 1.68, pl.position.z);
      const counts = { hit: 0, through: 0, air: 0, ribSeen: 0, ribRegistered: 0, faceAimed: 0, faceHeadshot: 0 };
      const rib0 = f.look.ribcageWorld(new V()), ribVis = 0.36 * k.scale;
      const sphereT = (o, dv, c, r) => { const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z, b = ox * dv.x + oy * dv.y + oz * dv.z, cc = ox * ox + oy * oy + oz * oz - r * r, h = b * b - cc; return h < 0 ? Infinity : -b - Math.sqrt(h); };
      // a grid over his silhouette (the plane through him, square to the view)
      const vx = k.position.x - eye.x, vz = k.position.z - eye.z, L = Math.hypot(vx, vz), sx = -vz / L, sz = vx / L;
      for (let gy = 0; gy < 26; gy++) for (let gx = 0; gx < 26; gx++) {
        const u = (gx + 0.5) / 26 * 2 - 1, y = k.position.y + (gy + 0.5) / 26 * 10;
        const tgt = new V(k.position.x + sx * u * 6, y, k.position.z + sz * u * 6), dir = tgt.clone().sub(eye).normalize();
        const m = meshRay(S, eye, dir), h = W.animals.raycast(eye, dir, 60);
        const tc = sphereT(eye, dir, rib0, ribVis);
        if (tc < m.t) { m.t = tc; m.part = 4; }
        const hb = h && h.animal === k ? h.distance : Infinity;
        const target = m.part === 1 || m.part === 2 || m.part === 4;
        if (m.part === 4) { counts.ribSeen++; if (h && h.animal === k && h.point.distanceTo(rib0) < f.look.ribcageRadius) counts.ribRegistered++; }
        if (target) { if (hb <= m.t + 2 && hb >= m.t - 1) counts.hit++; else if (hb < m.t - 1) counts.air++; else counts.through++; }
        else if (hb < m.t - 1) counts.air++;
      }
      // aimed: the ribcage basket (its centre and 6 points on its front) and the face (the head ball's centre ± 0.4 m)
      const rib = f.look.ribcageWorld(new V()), rr = f.look.ribcageRadius;
      void rib; void rr;
      const face = k.headWorld(new V());
      for (const [ox, oy] of [[0, 0], [0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4]]) {
        const dir = face.clone().add(new V(sx * ox, oy, sz * ox)).sub(eye).normalize();
        const h = W.animals.raycast(eye, dir, 60); counts.faceAimed++;
        if (h && h.animal === k && h.headshot) counts.faceHeadshot++;
      }
      out.views.push({ d, ang, ...counts });
    }
    freeze = false; hold();
    return out;
  }
  /** a real bolt from the crossbow at `what` ('rib' | 'face'), from (d, ang): where it landed */
  async function fire(what, d, ang) {
    await settle();
    freeze = true; patch(f.king);
    place(d, ang); await frame(); await frame();
    const k = f.king, cb = W.crossbow;
    W.weapons.select('crossbow', true);
    const tgt = what === 'rib' ? f.look.ribcageWorld(new V()) : k.headWorld(new V());
    // aim: the camera at the eye, yaw / pitch onto the target (two passes, the second corrects on the real camera)
    for (let pass = 0; pass < 3; pass++) {
      const e = cam.position, dx = tgt.x - e.x, dy = tgt.y - e.y, dz = tgt.z - e.z;
      pl.yaw = Math.atan2(-dx, -dz); pl.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      await frame(); await frame();
    }
    const got = [];
    const prevD = k.onDamaged;
    k.onDamaged = (an, amount, point, dir, died) => { got.push({ amount, rib: point.distanceTo(f.look.ribcageWorld(new V())) < f.look.ribcageRadius, fromAim: Number(point.distanceTo(tgt).toFixed(2)), aboveGround: Number((point.y - k.position.y).toFixed(2)) }); prevD?.(an, amount, point, dir, died); };
    const prevH = cb.onHit; let head = null;
    cb.onHit = (kind, hs, killed) => { head = hs; prevH?.(kind, hs, killed); };
    cb.state.loaded = true; cb.state.reloading = false; cb.cooldown = 0; cb.state.bolts = Math.max(cb.state.bolts, 5);
    cb.fire();
    for (let i = 0; i < 60 && got.length === 0; i++) await frame();
    k.onDamaged = prevD; cb.onHit = prevH;
    freeze = false; hold();
    const g = got[0];
    return { what, d, ang, landed: g !== undefined, rib: g?.rib ?? false, headshot: head, dmg: g?.amount ?? 0, fromAim: g?.fromAim, at: g?.aboveGround };
  }
  // ── the strip: his hit volumes drawn over the frame (a 2D overlay on the canvas, removed after the shot) ──
  function overlay(on, move = '') {
    document.getElementById('e350-ov')?.remove();
    if (!on) return;
    const k = f.king, c = document.createElement('canvas'), dpr = 2;
    c.id = 'e350-ov'; c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    Object.assign(c.style, { position: 'fixed', left: '0', top: '0', width: '100vw', height: '100vh', zIndex: '99999', pointerEvents: 'none' });
    document.body.append(c);
    const g = c.getContext('2d'); g.lineWidth = 1.5 * dpr;
    const proj = (p) => { const q = p.clone().project(cam); return q.z > 1 ? null : [(q.x + 1) / 2 * c.width, (1 - q.y) / 2 * c.height]; };
    const A = new V(), B = new V();
    // where the move's blow lands, outlined on the ground (amber): the sweep's two regions, the lane's catch band
    const gy = k.position.y + 0.08, at = (ang, r) => new V(k.position.x + Math.sin(k.yaw + ang) * r, gy, k.position.z + Math.cos(k.yaw + ang) * r);
    const poly = (pts) => { g.beginPath(); let first = true; for (const pt of pts) { const q = proj(pt); if (!q) { first = true; continue; } if (first) { g.moveTo(q[0], q[1]); first = false; } else g.lineTo(q[0], q[1]); } g.stroke(); };
    g.strokeStyle = 'rgba(255,190,90,0.95)'; g.lineWidth = 2 * dpr;
    const sector = (a0, a1, r) => { const pts = [at(0, 0)]; for (let i = 0; i <= 24; i++) pts.push(at(a0 + (a1 - a0) * i / 24, r)); pts.push(at(0, 0)); poly(pts); };
    if (move === 'sweep') { sector(-1.31, 1.31, 4); sector(-0.26 - 0.52, -0.26 + 0.52, 7.1); }
    if (move === 'lane') {
      const L = f.lane, dx = L.x1 - L.x0, dz = L.z1 - L.z0, len = Math.hypot(dx, dz), nx = dz / len, nz = -dx / len, hw = 5.2 / 2 + 0.4;
      for (const sgn of [1, -1]) poly([new V(L.x0 + nx * hw * sgn, gy, L.z0 + nz * hw * sgn), new V(L.x1 + nx * hw * sgn, gy, L.z1 + nz * hw * sgn)]);
    }
    g.lineWidth = 1.5 * dpr;
    const caps = [];
    k.bodyCapsule(A, B); caps.push([A.clone(), B.clone(), k.dims.bodyRadius * k.scale]);
    if (k.foreCapsule(A, B)) caps.push([A.clone(), B.clone(), k.dims.fore.radius * k.scale]);
    const h = k.headWorld(new V()); caps.push([h.clone(), h.clone(), k.dims.headRadius * k.scale]);
    g.strokeStyle = 'rgba(143,227,255,0.7)'; g.lineWidth = 1.1 * dpr;
    for (const [a, b, r] of caps) {
      const ax = b.clone().sub(a), L = ax.length(), u = L > 1e-4 ? ax.clone().multiplyScalar(1 / L) : new V(0, 1, 0);
      const t1 = Math.abs(u.y) < 0.9 ? new V(0, 1, 0).cross(u).normalize() : new V(1, 0, 0).cross(u).normalize(), t2 = u.clone().cross(t1);
      const ring = (ctr, rad) => { g.beginPath(); let first = true; for (let i = 0; i <= 32; i++) { const th = i / 32 * Math.PI * 2; const p = proj(ctr.clone().addScaledVector(t1, Math.cos(th) * rad).addScaledVector(t2, Math.sin(th) * rad)); if (!p) { first = true; continue; } if (first) { g.moveTo(p[0], p[1]); first = false; } else g.lineTo(p[0], p[1]); } g.stroke(); };
      for (let s = 0; s <= 2; s++) ring(a.clone().lerp(b, s / 2), r);
      // the end caps: rings up each hemisphere
      for (let s = 2; s <= 2; s++) { const ph = s / 4 * Math.PI / 2; ring(a.clone().addScaledVector(u, -r * Math.sin(ph)), r * Math.cos(ph)); ring(b.clone().addScaledVector(u, r * Math.sin(ph)), r * Math.cos(ph)); }
      // meridians: a → b down one side, over the cap, back up the other
      for (let m = 0; m < 3; m++) {
        const th = m / 3 * Math.PI, dv = t1.clone().multiplyScalar(Math.cos(th)).addScaledVector(t2, Math.sin(th)), pts = [];
        for (let i = 0; i <= 12; i++) { const q = i / 12 * Math.PI; pts.push(a.clone().addScaledVector(u, -Math.sin(q) * r).addScaledVector(dv, Math.cos(q) * r)); }
        for (let i = 0; i <= 12; i++) { const q = i / 12 * Math.PI; pts.push(b.clone().addScaledVector(u, Math.sin(q) * r).addScaledVector(dv, -Math.cos(q) * r)); }
        pts.push(pts[0]);
        g.beginPath(); let first = true;
        for (const pt of pts) { const p = proj(pt); if (!p) { first = true; continue; } if (first) { g.moveTo(p[0], p[1]); first = false; } else g.lineTo(p[0], p[1]); }
        g.stroke();
      }
    }
  }
  /** pose him for a strip frame: the move at attack progress `a`, you at (d, ang) facing him */
  async function stage(move, a, d, ang, lookUp = 0) {
    await settle(move === 'lane' ? -8 : 0);
    freeze = true; patch(f.king);
    const k = f.king;
    if (move === 'lane') {
      // side on: the lane runs along his heading, you stand 13 m off it, level with its middle
      const a2 = k.yaw, lx = k.position.x + Math.sin(a2) * 8 + Math.cos(a2) * d, lz = k.position.z + Math.cos(a2) * 8 - Math.sin(a2) * d;
      pl.spawn(lx, lz, 0);
    } else place(d, ang);
    for (let i = 0; i < 6; i++) await frame();   // the camera follows the spawn
    if (move === 'sweep') { f.setMode('sweep'); k.mem.act = 1; k.startAttack(0.9); }
    if (move === 'stomp') { f.setMode('stomp'); k.mem.act = 2; k.startAttack(1.0); }
    if (move === 'lane') { f.setMode('stalk3'); f.modeT = -100; k.mem.act = 4; f.lane.start(k, k.position.x + Math.sin(k.yaw) * 16, k.position.z + Math.cos(k.yaw) * 16, 1.1); }
    if (move !== 'idle') for (let i = 0; i < 400; i++) { await frame(); const ph = move === 'lane' ? (f.lane.state === 'run' ? Math.min(1, f.lane.t / 0.8) : 0) : k.attackPhase; if (ph >= a) break; }
    // look at his middle
    const tgt = new V(k.position.x, k.position.y + 3.2 + lookUp, k.position.z), e = cam.position, dx = tgt.x - e.x, dy = tgt.y - e.y, dz = tgt.z - e.z;
    pl.yaw = Math.atan2(-dx, -dz); pl.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    // freeze the frame: the fight holds, the move's pose stays (debugGait holds his clip where it is)
    const clip = move === 'sweep' ? 'sweep' : move === 'stomp' ? 'strike' : move === 'lane' ? 'charge' : 'idle';
    k.debugGait = { gait: clip, phase: move === 'lane' ? 0.3 : Math.min(1, k.attackPhase < 0 ? a : k.attackPhase) };
    f.mode = 'e350-hold';
    await frame(); await frame(); await frame();
  }
  async function unstage() { f.king.debugGait = undefined; overlay(false); freeze = false; await settle(); }
  window.__e350 = { sweep, stomp, lane, bolts, fire, overlay, stage, unstage, settle, hurts };
}

const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
const report = { url: URL_BASE, tier: 'phone', device: 'iPhone 16 Pro', phases: {} };
const shots = [];
try {
  for (const phase of PHASES) {
    const page = await (await browser.newContext(CTX)).newPage();
    await debugSettings(page, { creatures: 'models' });
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message.slice(0, 200)));
    const q = ['chunk=pine-hollow', 'mute=1', 'nolock=1', 'skipintro=1', 'sw=0', 'tier=phone', 'touch', 'boss=antler-king', `bossPhase=${phase}`, 'bossGod=1', 'from=15'].join('&');
    await page.goto(`${URL_BASE}/?${q}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__world?.animals && window.__antlerKing?.fight?.king), undefined, { timeout: 300000, polling: 1000 });
    // the fight begins: the intro, then his first move
    await page.waitForFunction(() => { const m = window.__antlerKing.fight.mode; return m === 'stalk' || m === 'stalk3' || m === 'sweep' || m === 'stomp' || m === 'call'; }, undefined, { timeout: 120000, polling: 250 });
    const build = await page.evaluate(async () => { try { return await (await fetch('/version.json')).json(); } catch { return null; } });
    await page.evaluate(installKit);
    const R = { build, sweep: [], stomp: [], lane: [], bolts: [], fired: [] };
    if (STRIP) {
      const frames = phase === 1
        ? [['sweep', 0.85, 16, 35, -1.2, 'I · sweep: the rack scythes low (amber: where it hurts)'], ['stomp', 0.97, 16, 25, -0.5, 'I · rearing strike: the slam at the hooves']]
        : phase === 3 ? [['lane', 0.5, 15, 0, -1, 'III · lane charge (amber: the catch band)']] : [['idle', 0, 16, -50, 0.8, 'II · hit volumes: face, fore block, barrel']];
      for (const [move, a, d, ang, up, label] of frames) {
        await page.evaluate(([m, aa, dd, an, u]) => window.__e350.stage(m, aa, dd, an, u), [move, a, d, ang, up]);
        await page.evaluate((m) => window.__e350.overlay(true, m), move);
        const b64 = (await page.screenshot({ type: 'jpeg', quality: 85, scale: 'css' })).toString('base64');
        shots.push({ label, b64 });
        await page.evaluate(() => window.__e350.unstage());
      }
    }
    if (!argv.includes('--strip-only')) {
    const sweeps = [[3, 0], [5, 0], [6.5, 0], [7, 0], [7.5, 0], [8.5, 0], [10, 0], [3.5, 70], [3.5, -85], [5.5, 10], [5.5, 25], [5.5, -40], [5.5, -55], [6.5, -30], [6.5, 30], [5.5, 90]];
    for (const [d, a] of (phase === 1 ? sweeps : sweeps.filter((_, i) => i % 3 === 0))) R.sweep.push(await page.evaluate(([dd, aa]) => window.__e350.sweep(dd, aa), [d, a]));
    for (const [d, a] of [[3, 0], [4.4, 0], [6, 0], [4.4, 90]]) R.stomp.push(await page.evaluate(([dd, aa]) => window.__e350.stomp(dd, aa), [d, a]));
    for (const off of phase === 3 ? [0, 1.5, 2.5, 3.0, 3.5, 4.0] : [0, 2.5, 3.5]) R.lane.push(await page.evaluate((o) => window.__e350.lane(o), off));
    R.bolts.push(await page.evaluate(() => window.__e350.bolts('idle')));
    if (phase === 1) R.bolts.push(await page.evaluate(() => window.__e350.bolts('rear')));
    for (const [w, d, a] of [['rib', 15, 0], ['rib', 15, 0], ['rib', 14, 30], ['face', 15, 0], ['face', 15, 0], ['face', 14, -30]]) R.fired.push(await page.evaluate(([ww, dd, aa]) => window.__e350.fire(ww, dd, aa), [w, d, a]));
    }
    R.errors = errs.slice(0, 4);
    report.phases[phase] = R;
    console.log(`phase ${phase}:`, JSON.stringify(R));
    await page.close();
  }
  writeFileSync(resolvePath(OUT, `fight-${LABEL}.json`), JSON.stringify(report, null, 1));
  if (STRIP && shots.length > 0) {
    const comp = await (await browser.newContext()).newPage();
    const b64 = await comp.evaluate(async ({ list }) => {
      const load = (src) => new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
      const w = 390, h = 844, G = 4, LAB = 22;
      const c = document.createElement('canvas'); c.width = list.length * (w + G) + G; c.height = h + LAB + G;
      const x = c.getContext('2d'); x.fillStyle = '#0d1b26'; x.fillRect(0, 0, c.width, c.height);
      for (let i = 0; i < list.length; i++) {
        x.drawImage(await load(`data:image/jpeg;base64,${list[i].b64}`), G + i * (w + G), LAB, w, h);
        x.font = '600 11px ui-monospace, monospace'; x.fillStyle = '#8fe3ff'; x.fillText(list[i].label.toUpperCase(), G + i * (w + G) + 2, 15);
      }
      for (let qq = 0.88; qq >= 0.4; qq -= 0.04) { const u = c.toDataURL('image/jpeg', qq); if (u.length * 0.75 < 4.8e5) return u.split(',')[1]; }
      return c.toDataURL('image/jpeg', 0.35).split(',')[1];
    }, { list: shots });
    writeFileSync(resolvePath(OUT, 'strip.jpg'), Buffer.from(b64, 'base64'));
    console.log(`wrote ${resolvePath(OUT, 'strip.jpg').slice(ROOT.length + 1)}`);
  }
} finally {
  await browser.close();
}
