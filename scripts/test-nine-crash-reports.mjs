#!/usr/bin/env node
// E259: actually terminate a renderer during Explore entry, then recover its report on the static title.
// All telemetry is intercepted locally. Uses Metal; closes its browser even on failure.
// node scripts/test-nine-crash-reports.mjs --url=http://127.0.0.1:4184
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = (process.argv.find((part) => part.startsWith('--url='))?.slice(6) ?? 'http://127.0.0.1:4184').replace(/\/$/, '');
const browser = await chromium.launch({ args: ['--use-angle=metal', '--mute-audio'] });
try {
  const context = await browser.newContext({ viewport: { width: 402, height: 653 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const reports = [], envelopes = [];
  let unavailable = true;
  await context.route('**/api/errors', async (route) => {
    reports.push({ payload: route.request().postDataJSON(), accepted: !unavailable });
    await route.fulfill({ status: unavailable ? 503 : 200, contentType: 'application/json', body: '{}' });
  });
  await context.route(/https:\/\/[^/]+\.ingest\.[^/]+\/api\//, async (route) => {
    envelopes.push(route.request().postData() ?? '');
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  // Hold the lazy module request so the real renderer dies while entry is unfinished.
  const held = [];
  await context.route(/\/assets\/Explore-[^/]+\.js$/, (route) => { held.push(route); });
  const page = await context.newPage();
  await page.goto(`${base}/?chunk=nine-dragon-stack&tier=phone&touch=1&mute=1&nolock=1&sw=0`);
  await page.waitForFunction(() => Boolean(window.__wildshard?.world), null, { timeout: 90_000 });
  await page.locator('.ws-menu-explore').click();
  await page.waitForFunction(() => {
    const trace = JSON.parse(localStorage.getItem('ws.nineBoot') ?? 'null');
    return trace?.status === 'in_progress' && /explore/i.test(trace.stage);
  });
  const attempt = await page.evaluate(() => JSON.parse(localStorage.getItem('ws.nineBoot')).id);
  assert.ok(held.length > 0, 'Explore import must be held before the crash');
  const cdp = await context.newCDPSession(page);
  const crashed = page.waitForEvent('crash');
  void cdp.send('Page.crash').catch(() => undefined);
  await crashed;
  console.info('Renderer terminated during real Explore entry; no unload handler ran.');
  await page.close();
  await context.unroute(/\/assets\/Explore-[^/]+\.js$/);
  const title = await context.newPage();
  await title.goto(`${base}/`);
  await title.waitForFunction(() => localStorage.getItem('wsNineReports') !== null);
  await expectEventually(() => reports.length > 0 && envelopes.length > 0, 'both transports attempted');
  assert.equal(await title.evaluate(() => Boolean(window.__wildshard?.world)), false, 'reporting must work without gameplay boot');
  assert.ok(JSON.stringify(reports[0]).includes(attempt), 'report must identify the interrupted attempt');
  assert.ok(JSON.stringify(reports[0]).includes('explore'), 'report must identify Explore');
  const sentryCount = envelopes.length;
  unavailable = false;
  await title.reload();
  await expectEventually(() => reports.some((report) => report.accepted), 'failed first-party report retries on next title');
  await title.waitForFunction(() => localStorage.getItem('wsNineReports') === null || localStorage.getItem('wsNineReports') === '[]');
  const acceptedCount = reports.filter((report) => report.accepted).length;
  await title.reload();
  await title.waitForTimeout(1500);
  assert.equal(reports.filter((report) => report.accepted).length, acceptedCount, 'acknowledged inbox report must not repeat');
  assert.equal(envelopes.length, sentryCount, 'acknowledged Sentry report must not repeat when inbox retries');
  console.info('PASS: real renderer crash → static-title reporting → offline retry → no acknowledged duplicates.');
  await context.close();

  // A separate live context exercises the application's recovery reload, not a synthetic report record.
  const recovery = await browser.newContext({ viewport: { width: 402, height: 653 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const recoveryReports = [], recoveryEnvelopes = [];
  await recovery.route('**/api/errors', async (route) => {
    recoveryReports.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await recovery.route(/https:\/\/[^/]+\.ingest\.[^/]+\/api\//, async (route) => {
    recoveryEnvelopes.push(route.request().postData() ?? '');
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  const gpuPage = await recovery.newPage();
  await gpuPage.goto(`${base}/?chunk=nine-dragon-stack&tier=phone&touch=1&mute=1&nolock=1&sw=0`);
  await gpuPage.waitForFunction(() => window.__wildshard?.world && JSON.parse(localStorage.getItem('ws.nineBoot') ?? 'null')?.status === 'ready', null, { timeout: 90_000 });
  const lostAttempt = await gpuPage.evaluate(() => {
    const trace = JSON.parse(localStorage.getItem('ws.nineBoot'));
    const extension = window.__wildshard.world.game.renderer.getContext().getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('Recovery reporting test requires WEBGL_lose_context');
    extension.loseContext();
    return trace.id;
  });
  await gpuPage.waitForURL(`${base}/`, { timeout: 20_000 });
  await expectEventually(() => recoveryReports.length > 0 && recoveryEnvelopes.length > 0, 'known GPU reload reports both channels');
  await gpuPage.waitForFunction(() => localStorage.getItem('wsNineReports') === '[]');
  assert.equal(await gpuPage.evaluate(() => Boolean(window.__wildshard?.world)), false, 'GPU recovery report reaches static title without renderer');
  assert.ok(recoveryReports.some((report) => report.system === 'gpu-recovery' && report.context.bootDiagnostic.includes(lostAttempt)), 'known failure keeps original attempt identity');
  assert.ok(recoveryReports.some((report) => report.context.bootDiagnostic.includes('gpu:recovery')), 'known failure keeps GPU recovery checkpoint');
  assert.ok(await gpuPage.evaluate(() => JSON.parse(localStorage.getItem('ws.lastEnd') ?? '{}').reason.includes('graphics recovery')), 'actual planned recovery navigation occurred');
  console.info('PASS: real un-restored context loss → automatic planned reload/pagehide → GPU report on static title.');

  const inboxBefore = recoveryReports.length, sentryBefore = recoveryEnvelopes.length;
  await gpuPage.goto(`${base}/?chunk=nine-dragon-stack&tier=phone&touch=1&mute=1&nolock=1&sw=0`);
  await gpuPage.waitForFunction(() => Boolean(window.__wildshard?.world), null, { timeout: 90_000 });
  await gpuPage.locator('.ws-menu-explore').click();
  await gpuPage.locator('.ws-x-card[data-m="world"]').click();
  await gpuPage.waitForFunction(() => {
    const trace = JSON.parse(localStorage.getItem('ws.nineBoot') ?? 'null');
    return trace?.status === 'ready' && trace.checkpoints?.some((point) => point.operation === 'explore:stable');
  }, null, { timeout: 25_000 });
  await gpuPage.locator('.ws-x-close').click(); // world → hub
  await gpuPage.locator('.ws-x-close').click(); // hub → title
  assert.equal(await gpuPage.evaluate(() => JSON.parse(localStorage.getItem('ws.nineBoot')).status), 'ready', 'successful in-page exit ends the entry watch');
  await gpuPage.goto(`${base}/`); // normal pagehide, not a process termination
  await gpuPage.waitForFunction(() => localStorage.getItem('wsNineReports') === '[]');
  await gpuPage.waitForTimeout(1000);
  assert.equal(recoveryReports.length, inboxBefore, 'normal Explore/title navigation is not an abrupt crash');
  assert.equal(recoveryEnvelopes.length, sentryBefore, 'normal navigation produces no Sentry error');
  console.info('PASS: stable Explore → title → normal navigation produces no crash report.');
  await recovery.close();

} finally {
  await browser.close();
}

async function expectEventually(check, label) {
  const until = Date.now() + 15_000;
  while (!check()) {
    assert.ok(Date.now() < until, label);
    await new Promise((resolve) => { setTimeout(resolve, 100); });
  }
}
