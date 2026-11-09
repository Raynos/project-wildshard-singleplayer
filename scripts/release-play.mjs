// Manual staged/production play evidence. Only real controls and read-only probes.
export function recordFirstReleaseCard() {
  let seen = false;
  const observe = () => {
    const card = document.querySelector('.ws-load');
    if (seen || card === null) return;
    seen = true;
    requestAnimationFrame(() => {
      window.__releaseFirstCard = { name: card.querySelector('[data-el=slug]')?.textContent,
        art: getComputedStyle(document.documentElement).getPropertyValue('--ws-load-portrait').trim() };
    });
  };
  new MutationObserver(observe).observe(document, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', observe, { once: true });
}

export async function proveLoadingCard(page, slug, label, direct = false) {
  await page.locator('.ws-load[data-ready]').waitFor({ timeout: 150_000 });
  const report = await page.evaluate(({ slug, direct }) => {
    const row = JSON.parse(document.getElementById('ws-title-rows')?.textContent ?? '[]').find(row => row.slug === slug);
    if (row === undefined) throw new Error('Expected loading destination absent from actual catalogue');
    const card = document.querySelector('.ws-load'), timing = window.__bootTiming?.read();
    const first = window.__releaseFirstCard;
    const name = card?.querySelector('[data-el=slug]')?.textContent;
    const art = getComputedStyle(document.documentElement).getPropertyValue('--ws-load-portrait').trim();
    // A direct URL has no titleArrival: its contract is the slug-derived name
    // and the document's approved placeholder map. Actual title/GRID handoffs
    // must retain the exact catalogue destination name and portrait instead.
    let expectedName = row.name, expectedArt = row.card.portrait;
    if (direct) {
      expectedName = slug.replaceAll('-', ' ');
      const scripts = [...document.scripts].map(script => script.textContent ?? '');
      const source = scripts.find(text => text.includes('const titleAssetURLs = '));
      const value = source?.split('const titleAssetURLs = ')[1]?.split(';')[0];
      if (value === undefined) throw new Error('Direct-link placeholder contract absent');
      expectedArt = JSON.parse(value)[`/assets/title/${slug}-portrait.jpg`];
      if (typeof expectedArt !== 'string') throw new Error('Direct-link placeholder absent');
    }
    const artMatches = view => view !== undefined && (expectedArt === '' ? view.art === 'none' : view.art.includes(expectedArt));
    const matches = view => view?.name === expectedName && artMatches(view);
    // Direct bookmarks have no handed-off name before code admits the slug.
    // Record that blank first label, while rejecting another place's label.
    const firstMatches = direct ? artMatches(first) && (first.name === '' || first.name === expectedName) : matches(first);
    const bars = [...(card?.querySelectorAll('[data-phase-bar]') ?? [])].map(bar => ({ phase: bar.dataset.phaseBar, value: Number.parseFloat(bar.style.width) }));
    const operations = new Set(timing?.entries.map(entry => entry.operation));
    const server = timing?.entries.filter(entry => entry.realm !== 'page' && entry.operation.startsWith('server:') && entry.result === 'complete').length ?? 0;
    return { identity: firstMatches && matches({ name, art }), name, expectedName, first, art, expectedArt, bars, server,
      atomic: timing?.counters['atomic:completed']?.loaded ?? 0, overflow: timing?.overflow,
      entries: timing?.entries.length ?? 0, ready: operations.has('app:control-ready') };
  }, { slug, direct });
  if (!report.identity || !report.ready || report.server === 0 || report.atomic === 0 || report.entries === 0
    || Object.keys(report.overflow ?? {}).length !== 0 || report.bars.length !== 3
    || ['start', 'download', 'load'].some(phase => !report.bars.some(bar => bar.phase === phase && bar.value === 100))) {
    throw new Error(`${label}: actual loading card or measured work failed: ${JSON.stringify(report)}`);
  }
  await page.evaluate(() => {
    const write = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = text => {
      const raw = window.__bootTiming.read();
      const expected = { entries: raw.entries.map(({ id, start, end }) => ({ id, start, end })),
        resources: raw.resources.length, counters: Object.keys(raw.counters).length, realms: Object.keys(raw.realms).length };
      const receipt = { text, expected, settled: false, success: false };
      window.__releaseCopy = receipt;
      return write(text).then(() => { receipt.settled = true; receipt.success = true; }, error => { receipt.settled = true; throw error; });
    };
  });
  await page.locator('.ws-load-copy').click();
  await page.waitForFunction(() => window.__releaseCopy?.settled === true);
  const copied = await page.evaluate(async () => {
    const receipt = window.__releaseCopy;
    if (!receipt.success || await navigator.clipboard.readText() !== receipt.text) return false;
    const marker = 'timeline (LS1):\n', at = receipt.text.indexOf(marker);
    if (at === -1) return false;
    const value = JSON.parse(receipt.text.slice(at + marker.length));
    return value.exportPrivacy === 'urls-and-free-text-removed'
      && JSON.stringify(value.entries.map(({ id, start, end }) => ({ id, start, end }))) === JSON.stringify(receipt.expected.entries)
      && value.resources.length === receipt.expected.resources && Object.keys(value.counters).length === receipt.expected.counters
      && value.realms.length === receipt.expected.realms && document.querySelector('.ws-load-copy')?.textContent === 'Copied';
  });
  if (!copied) throw new Error(`${label}: complete native diagnostics copy failed`);
  console.log('PASS loading card', label, JSON.stringify(report), 'complete safe native clipboard');
  await page.locator('.ws-load-play').click();
  await page.waitForFunction(() => document.querySelector('.ws-load') === null);
}

async function gridState(page) {
  return page.evaluate(() => {
    const grid = window.__wildshard.shard.grid.state(), row = window.__workerClient();
    return { current: grid.live?.live.current, inside: grid.inside, server: grid.cells[row.cell - 1]?.instance,
      phase: grid.live?.crossing.phase, ready: grid.live?.live.gameplayReady, board: grid.cellLoading,
      x: row.serverX, z: row.serverZ, saved: row.savedOk, restored: row.restored, frames: row.frames, closed: row.closed };
  });
}
async function enteredEmber(page) {
  await page.waitForFunction(() => {
    const grid = window.__wildshard?.shard?.grid?.state(), row = window.__workerClient?.();
    return grid?.live?.live.current === 'open-plot-4-1' && grid.inside === 'open-plot-4-1'
      && grid.live.live.gameplayReady && grid.cellLoading === null && row !== undefined
      && grid.cells[row.cell - 1]?.instance === 'open-plot-4-1' && row.closed === null;
  }, undefined, { timeout: 90_000 });
  return gridState(page);
}
async function walk(page, x, z) {
  const started = Date.now(), deadline = started + 210_000, trace = [];
  let distance = Infinity;
  try {
    while (Date.now() < deadline) {
      const sample = await page.evaluate(([x, z]) => {
        const world = window.__wildshard.world, grid = window.__wildshard.shard.grid.state(), feet = grid.live?.live.worldFeet;
        const row = window.__workerClient();
        if (feet === undefined) return { distance: Infinity, frames: row.frames };
        const game = world.game, slot = (game.frameI + game.frameMs.length - 1) % game.frameMs.length;
        world.player.yaw = Math.atan2(feet.x - x, feet.z - z);
        world.player.touchMove.y = 1; world.player.touchSprint = true;
        return { distance: Math.hypot(feet.x - x, feet.z - z), x: feet.x, z: feet.z,
          frames: row.frames, serverX: row.serverX, serverZ: row.serverZ,
          clientFps: row.framesPerSecond, simulationTps: row.ticksPerSecond,
          workerTickMs: row.workerTickMs, clientMainP95Ms: row.mainMsP95,
          frame: { count: game.frameCount, intervalMs: game.frameMs[slot], workMs: game.workMs[slot],
            updateMs: game.updateMs[slot], renderMs: game.renderMs[slot],
            calls: game.lastFrame.calls, triangles: game.lastFrame.triangles },
          visibility: document.visibilityState,
          move: world.player.touchMove.y, sprint: world.player.touchSprint,
          phase: grid.live?.crossing.phase, ready: grid.live?.live.gameplayReady,
          board: grid.cellLoading, paused: world.game.app.clock.paused };
      }, [x, z]);
      distance = sample.distance;
      trace.push({ ms: Date.now() - started, ...sample });
      if (trace.length > 64) trace.shift();
      if (distance < 5) {
        console.log('ROAD ARRIVAL TRACE', x, z, JSON.stringify(trace));
        return;
      }
      await page.waitForTimeout(250);
    }
    console.error('ROAD DEADLINE TRACE', x, z, JSON.stringify(trace));
    throw new Error(`Actual road leg ${x},${z} stopped ${distance.toFixed(1)}m away: ${JSON.stringify(await gridState(page))}`);
  } finally {
    await page.evaluate(() => { const player = window.__wildshard.world.player; player.touchMove.y = 0; player.touchSprint = false; });
  }
}
export async function proveEmber(page, modules, label) {
  console.log('Real road crossing', label);
  console.log('ROAD PLATFORM', label, JSON.stringify(await page.evaluate(() => {
    const game = window.__wildshard.world.game, gl = game.renderer.getContext();
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    return { build: window.__bootTiming?.read().build, userAgent: navigator.userAgent,
      devicePixelRatio, width: innerWidth, height: innerHeight, visibility: document.visibilityState,
      vendor: info === null ? gl.getParameter(gl.VENDOR) : gl.getParameter(info.UNMASKED_VENDOR_WEBGL),
      renderer: info === null ? gl.getParameter(gl.RENDERER) : gl.getParameter(info.UNMASKED_RENDERER_WEBGL) };
  })));
  for (const [x, z] of [[0, -281.25], [1125, -281.25], [1125, -390]]) {
    await walk(page, x, z);
    console.log('PASS actual road leg', label, x, z, JSON.stringify(await gridState(page)));
  }
  await enteredEmber(page);
  // The last held input must actually drain before choosing the saved pose.
  // Require three advancing authoritative reports at the stopped position.
  await page.waitForFunction(() => {
    const row = window.__workerClient(), previous = window.__releaseStopped;
    if (previous?.frame === row.frames) return false;
    const count = previous && Math.hypot(row.serverX - previous.x, row.serverZ - previous.z) < .00001 ? previous.count + 1 : 0;
    window.__releaseStopped = { frame: row.frames, x: row.serverX, z: row.serverZ, count };
    return count >= 3;
  }, undefined, { timeout: 15_000 });
  await page.evaluate(() => { delete window.__releaseStopped; });
  await page.evaluate(() => window.__workerClientSave());
  const saved = await gridState(page);
  if (!saved.saved || saved.phase !== 'settled') throw new Error('Ember did not acknowledge its real durable save');
  console.log('PASS real Ember crossing', label, JSON.stringify(saved));
  await modules.wait();
  await page.evaluate(() => window.__wildshard.world.hud.setPaused(true));
  await page.getByText('Exit to main', { exact: true }).click();
  await page.locator('.ws-main-grid').waitFor({ timeout: 90_000 });
  await modules.wait();
  await Promise.all([page.waitForEvent('domcontentloaded', { timeout: 90_000 }), page.locator('.ws-main-grid').click()]);
  await proveLoadingCard(page, 'open-plot-ember-forge', `${label} earned Ember return`);
  await page.waitForFunction(() => window.__wildshard?.world?.hud !== undefined, undefined, { timeout: 150_000 });
  await page.evaluate(() => { window.__wildshard.world.hud.enterNow(); window.__wildshard.world.hud.setPaused(false); });
  const restored = await enteredEmber(page), away = Math.hypot(restored.x - saved.x, restored.z - saved.z);
  if (!restored.restored || away > .003) throw new Error(`Epoch-one earned Ember progress did not survive: ${JSON.stringify({ away, restored })}`);
  console.log('PASS epoch-one earned progress survived', label, JSON.stringify({ away, ...restored }));
}
