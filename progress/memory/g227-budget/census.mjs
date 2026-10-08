import { chromium, devices } from 'playwright';
import { GL_INIT } from '../../../scripts/parity/glbytes.mjs';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { saveFixture } from '../../../scripts/debug-settings.mjs';
import { driveFloorGrid, stageFloorGrid, gridFloorPlans, runFloorGridRoute } from '../../../scripts/frame-floor-grid.mjs';

const [base, out] = process.argv.slice(2);
const report = { version: await (await fetch(new URL('version.json', base))).json(),
  protocol: 'One muted Chromium/Metal iPhone 16 Pro, Developer ON, live input crossings. Claims count retained resources; hidden is not freed.',
  driverHash: createHash('sha256').update(`${stageFloorGrid.toString()}\n${driveFloorGrid.toString()}`).digest('hex'), snapshots: [], routes: [], errors: [], console: [], assetRequests: [] };
const save = () => writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
const browser = await chromium.launch({ args: ['--mute-audio', '--use-angle=metal', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], serviceWorkers: 'block' });
  await saveFixture(context, { scope: 'global', key: 'settings', data: { tier: 'phone', fps: 'auto', tex: 'auto' }, merge: true });
  await saveFixture(context, { scope: 'global', key: 'gfx', data: { dpr: '2', aa: 'auto' } });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  await context.addInitScript(GL_INIT);
  await context.addInitScript(() => {
    window.__wildshardHarness = { seed: 357, capture: null };
    window.__gridAdmissionLongTasks = [];
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) window.__gridAdmissionLongTasks.push({ start: entry.startTime, ms: entry.duration,
        live: window.__wildshard?.shard?.grid?.state().live?.live });
    }).observe({ entryTypes: ['longtask'] });
  });
  const page = await context.newPage();
  page.on('request', request => { const url = request.url(); if (/\.(glb|gltf|ktx2)(?:[?#]|$)/u.test(url)) report.assetRequests.push(url); });
  page.on('requestfailed', request => { report.console.push(`REQUEST FAILED ${request.url()} ${request.failure()?.errorText}`); });
  page.on('pageerror', error => { report.errors.push(String(error)); save(); });
  page.on('console', message => { if (['error', 'warn'].includes(message.type())) report.console.push(message.text().slice(0, 1200)); });
  const snapshot = async label => {
    const value = await page.evaluate(() => {
      const api = window.__wildshard, grid = api.shard.grid;
      const roots = [];
      api.world.game.rootScene.traverse(object => {
        if (object.isMesh && object.name.startsWith('grid-')) roots.push({ name: object.name, visible: object.visible,
          vertices: object.geometry?.attributes.position?.count, indices: object.geometry?.index?.count });
      });
      const allocations = new Map(), textures = new Map(); let next = 0;
      const attributeArray = attribute => {
        if (!attribute) return undefined;
        const descriptor = Object.getOwnPropertyDescriptor(attribute, 'array');
        return descriptor?.get ? undefined : (attribute.array ?? attribute.data?.array);
      };
      const addArray = (value, user, role) => {
        if (!ArrayBuffer.isView(value)) return;
        const buffer = value.buffer;
        let item = allocations.get(buffer);
        if (!item) { item = { id: ++next, bytes: buffer.byteLength, uses: [] }; allocations.set(buffer, item); }
        const key = user + ':' + role;
        if (!item.uses.some(use => use.key === key)) item.uses.push({ key, user, role, viewBytes: value.byteLength });
      };
      const original = window.__sc_gl().flatMap(c => c.resources);
      const textureHandles = new Map();
      api.world.game.rootScene.traverse(object => {
        const names = []; let parent = object;
        while (parent) { names.unshift(parent.name || parent.type); parent = parent.parent; }
        const user = names.join('/');
        if (object.geometry) {
          for (const [role, attribute] of Object.entries(object.geometry.attributes)) addArray(attributeArray(attribute), user, role);
          addArray(attributeArray(object.geometry.index), user, 'index');
        }
        addArray(object.instanceMatrix?.array, user, 'instanceMatrix'); addArray(object.instanceColor?.array, user, 'instanceColor');
        for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
          if (!material) continue;
          const values = [...Object.values(material), ...Object.values(material.uniforms ?? {}).map(uniform => uniform?.value)].flat();
          for (const texture of values) {
            if (!texture?.isTexture) continue;
            let item = textures.get(texture);
            if (!item) {
              item = { uuid: texture.uuid, name: texture.name, uses: [], imageKind: texture.image?.constructor?.name,
                width: texture.image?.width, height: texture.image?.height, depth: texture.image?.depth };
              textures.set(texture, item);
              const handle = api.world.game.renderer.properties.get(texture).__webglTexture;
              if (handle) { textureHandles.set(texture.uuid, handle); window.__sc_label_gl(handle, 'g227:scene-texture', texture.uuid); }
            }
            if (!item.uses.includes(user)) item.uses.push(user);
            addArray(texture.image?.data, user, 'texture:' + texture.uuid);
            for (const mip of texture.mipmaps ?? []) addArray(mip.data, user, 'mip:' + texture.uuid);
          }
        }
      });
      const linked = window.__sc_gl().map(({gl, ...context}) => context);
      const usageById = new Map(linked.flatMap(c => c.resources).filter(r => r.owner === 'g227:scene-texture').map(r => [r.id, r.asset]));
      const originalById = new Map(original.map(r => [r.id, r]));
      for (const resource of linked.flatMap(c => c.resources)) {
        const originalResource = originalById.get(resource.id);
        if (originalResource) { resource.owner = originalResource.owner; resource.asset = originalResource.asset; resource.labelled = originalResource.labelled; }
        const uuid = usageById.get(resource.id);
        if (uuid) {
          resource.sceneTextureUuid = uuid;
          const tag = originalById.get(resource.id);
          if (tag) window.__sc_label_gl(textureHandles.get(uuid), tag.owner, tag.asset);
        }
      }
      const census = { gl: linked, cpuAllocations: [...allocations.values()], textures: [...textures.values()],
        note: 'GPU allocations plus deduplicated directly retained scene ArrayBuffers. ImageBitmap/canvas/native costs are not inferred from dimensions.' };
      return { census, state: grid.state(), residency: grid.residency(), road: grid.roadResident(), roots, longTasks: window.__gridAdmissionLongTasks,
        runtime: { texture: api.world.game.level.assets?.texture, level: api.world.game.level.id },
        reveal: window.__wsReveal };
    });
    report.stage = label; report.snapshots.push({ label, ...value }); save(); console.log(label, value.state.playingMB, 'MB', value.state.live?.live.current);
  };
  try {
    await page.goto(`${base}?mute=1&nolock=1&sw=0`, { waitUntil: 'commit', timeout: 180000 });
    report.stage = 'title'; save(); console.log('title navigation');
    await page.locator('.ws-main-grid').waitFor({ timeout: 120000 });
    await page.locator('.ws-main-grid').click();
    report.stage = 'grid-loading'; save(); console.log('grid title tapped');
    await page.waitForFunction(() => Boolean(document.querySelector('#wserr .msg')?.textContent)
      || (!document.querySelector('.ws-load') && Boolean(window.__wildshard?.shard?.grid?.state().live?.live)), null, { timeout: 240000 });
    const failure = await page.evaluate(() => document.querySelector('#wserr .msg')?.textContent); if (failure) throw new Error(failure);
    await page.evaluate(() => window.__wildshard.world.hud.enterNow());
    await page.waitForFunction(() => window.__wsReveal?.endedMs != null, null, { timeout: 45000 });
    await page.waitForTimeout(5000); await snapshot('home-settled');
    const documentOrigin = await page.evaluate(() => performance.timeOrigin);
    report.documentOrigin = documentOrigin;
    const state = await page.evaluate(() => window.__wildshard.shard.grid.state());
    const plans = gridFloorPlans(state, 'runtime-travel');
    for (const original of plans) {
      const plan = { ...original, requiredResidents: [original.to] };
      report.stage = `route:${plan.name}`; save();
      // Entry-edge poses first, then a real-input route into each cell centre. No diagnostic teleport across a seam.
      report.routes.push(await runFloorGridRoute(page, plan, documentOrigin));
      await page.waitForTimeout(5000); await snapshot(`${plan.to}-entry`);
      const cell = state.cells.find(row => row.instance === plan.to); if (!cell) throw new Error('Missing destination');
      report.routes.push(await runFloorGridRoute(page, { name: `${plan.to}-centre`, from: plan.to, to: plan.to,
        waypoints: [{ x: cell.cell[0] * 555, z: cell.cell[1] * 555 }], requiredResidents: [plan.to] }, documentOrigin));
      await page.waitForTimeout(5000); await snapshot(`${plan.to}-centre`);
    }
  } catch (error) {
    report.failure = String(error);
    report.diagnostic = await page.evaluate(() => ({ documentOrigin: performance.timeOrigin, url: location.href, body: document.body.innerText.slice(-6000),
      boot: window.__wildshard?.world?.game?.app?.state, grid: window.__wildshard?.shard?.grid?.state(), reveal: window.__wsReveal,
      longTasks: window.__gridAdmissionLongTasks,
      resources: performance.getEntriesByType('resource').slice(-20).map(row => ({ name: row.name, duration: row.duration })) })).catch(() => null);
    save(); console.error(report.failure); process.exitCode = 1;
  }
  finally {
    await context.close();
  }
} finally { await browser.close(); report.closed = true; save(); }
