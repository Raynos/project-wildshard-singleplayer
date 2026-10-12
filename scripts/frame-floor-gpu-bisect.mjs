// GPU attribution by subtraction at a standing pose (sp-o3; diagnostic, no timing credit). WebKit exposes no GPU timer
// queries, so on the Simulator a render-shaped standing miss is attributed by measuring the drawn cadence with one thing
// switched off at a time: each post pass, the shadow-map update, and each heavy scene subtree. The browser function runs
// as is in Safari and Chromium (frame-floor's evaluator) and restores everything it switched before it resolves.

/**
 * Browser side: `frames` drawn frames per variant (rAF timestamps between drawn frameCount changes, as frame-floor's
 * sampler). Returns the baseline, then one row per variant, each with its mean / p50 / p95 interval and game work p95.
 * @param {number} frames
 */
export async function gpuBisect(frames) {
  const g = window.__wildshard.world.game, root = g.rootScene;
  const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
  const measure = () => new Promise((resolve, reject) => {
    const intervals = [], work = [];
    let count = g.frameCount, last = -1;
    const timeout = setTimeout(() => reject(new Error('gpu bisect sampler stalled')), 30000);
    const tick = (t) => {
      if (g.frameCount !== count) {
        if (last >= 0) { intervals.push(t - last); work.push(g.workMs[(g.frameI + g.frameMs.length - 1) % g.frameMs.length]); }
        count = g.frameCount; last = t;
      }
      if (intervals.length < frames) { requestAnimationFrame(tick); return; }
      clearTimeout(timeout);
      const pct = (v, p) => { const s = [...v].sort((a, b) => a - b); return s[Math.max(0, Math.ceil(s.length * p) - 1)]; };
      const r = (v) => Math.round(v * 10) / 10;
      resolve({ meanMs: r(intervals.reduce((a, b) => a + b, 0) / intervals.length), p50Ms: r(pct(intervals, 0.5)), p95Ms: r(pct(intervals, 0.95)), workP95Ms: r(pct(work, 0.95)), calls: g.lastFrame.calls, triangles: g.lastFrame.triangles });
    };
    requestAnimationFrame(tick);
  });
  const run = async (variant, off, on) => { off(); try { await wait(400); return { variant, ...(await measure()) }; } finally { on(); await wait(200); } };
  const meshes = (o) => { let n = 0; o.traverseVisible((c) => { if (c.isMesh || c.isInstancedMesh || c.isPoints || c.isLine) n++; }); return n; };
  const label = (o) => `${o.name !== "" ? o.name : o.type}${o.userData?.tag ? `#${o.userData.tag}` : ''}`;
  const rows = [{ variant: 'baseline', ...(await measure()) }];
  // post passes (the first scene render stays)
  const passes = g.composer.passes;
  for (const [i, pass] of passes.entries()) {
    if (i === 0 || !pass.enabled) continue;
    const effects = (pass.effects ?? []).map((e) => (typeof e.name === "string" && e.name !== "" ? e.name : e.constructor?.name)).join('+');
    rows.push(await run(`pass ${i} ${typeof pass.name === "string" && pass.name !== "" ? pass.name : pass.constructor?.name}${effects ? ` (${effects})` : ''}`, () => { pass.enabled = false; }, () => { pass.enabled = true; }));
  }
  // the shadow maps' per-frame update
  if (g.renderer.shadowMap.enabled && g.renderer.shadowMap.autoUpdate) rows.push(await run('shadow map update', () => { g.renderer.shadowMap.autoUpdate = false; }, () => { g.renderer.shadowMap.autoUpdate = true; }));
  // heavy subtrees: the root's children, and the children of any root child holding over 40 visible meshes
  const candidates = [];
  for (const child of root.children) {
    if (!child.visible || child === g.camera) continue;
    const n = meshes(child);
    if (n === 0) continue;
    candidates.push({ o: child, n, path: label(child) });
    if (n > 40) for (const sub of child.children) { const m = sub.visible ? meshes(sub) : 0; if (m > 0) candidates.push({ o: sub, n: m, path: `${label(child)}/${label(sub)}` }); }
  }
  candidates.sort((a, b) => b.n - a.n);
  for (const c of candidates.slice(0, 20)) rows.push({ ...(await run(`hide ${c.path}`, () => { c.o.visible = false; }, () => { c.o.visible = true; })), meshes: c.n });
  rows.push({ variant: 'baseline again', ...(await measure()) });
  return rows;
}
