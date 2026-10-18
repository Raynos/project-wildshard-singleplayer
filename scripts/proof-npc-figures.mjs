#!/usr/bin/env node
// Actual resident NPC draws, isolated only for a pixel-parity measurement.
// No geometry, shader, skin or pose substitute is introduced. The ordinary
// world and HUD are checked separately through the touch talk control.
// browser-lane.sh node scripts/proof-npc-figures.mjs --url=... --out=tmp/c6-before
// node scripts/proof-npc-figures.mjs --compare=tmp/c6-before,tmp/c6-after
import { chromium, devices } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { installInit } from './parity/init.mjs';
import { developerSettings } from './debug-settings.mjs';

const arg = key => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3);
const hash = value => createHash('sha256').update(value).digest('hex');
const compare = arg('compare');
if (compare !== undefined) {
  const [before, after] = compare.split(','), a = JSON.parse(readFileSync(join(before, 'summary.json'))), b = JSON.parse(readFileSync(join(after, 'summary.json')));
  if (a.rows.length !== 20 || b.rows.length !== 20) throw new Error('Need twenty populated NPC captures');
  const rows = a.rows.map((row, i) => {
    const other = b.rows[i];
    if (row.key !== other.key || row.width !== other.width || row.height !== other.height) throw new Error('NPC capture layout differs');
    const x = readFileSync(join(before, `${row.key}.rgba`)), y = readFileSync(join(after, `${row.key}.rgba`));
    if (x.length !== y.length) throw new Error('NPC pixel dimensions differ');
    let different = 0; for (let j = 0; j < x.length; j++) if (x[j] !== y[j]) different++;
    return { key: row.key, exactPixels: different === 0, differentBytes: different, pixels: x.length / 4,
      exactVisibility: row.visibleTriangles === other.visibleTriangles,
      exactGeometry: JSON.stringify(row.geometry) === JSON.stringify(other.geometry),
      exactPrompt: JSON.stringify(row.prompt) === JSON.stringify(other.prompt),
      exactCollider: JSON.stringify(row.collider) === JSON.stringify(other.collider) };
  });
  const pass = rows.every(row => row.exactPixels && row.exactVisibility && row.exactGeometry && row.exactPrompt && row.exactCollider);
  const result = { before: a.build, after: b.build, pass, rows };
  writeFileSync(join(after, 'comparison.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2)); process.exit(pass ? 0 : 1);
}
const url = arg('url'), out = arg('out');
if (url === undefined || out === undefined) throw new Error('Need --url and --out');
mkdirSync(out, { recursive: true });
const version = await (await fetch(new URL('/version.json', url))).json(), rows = [], errors = [];
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio'] });
try {
  for (const tier of ['phone', 'desktop']) for (const shardName of ['pine-hollow', 'driftwood-isle']) {
    const context = await browser.newContext({ ...devices['iPhone 16 Pro'] });
    await installInit(context, { lane: 'npc-figure-parity', sha: version.build, browser: 'chromium', capture: 30, tier });
    await developerSettings(context, { time: 'midday' });
    const page = await context.newPage(); page.on('pageerror', error => { errors.push(String(error)); console.error(String(error)); });
    await page.goto(new URL(`/?chunk=${shardName}&mute=1&skipintro=1&nolock=1&sw=0&tier=${tier}&touch=1`, url).href);
    await page.waitForFunction(() => window.__wildshard?.world?.game?.app?.physics !== undefined && !document.querySelector('.ws-load'), undefined, { timeout: 400000 });
    await page.evaluate(() => window.__parity.advance(30));
    const ids = shardName === 'pine-hollow' ? ['ranger', 'miller', 'trader'] : ['castaway', 'trader'];
    for (const figureId of ids) for (const poseId of ['idle', 'talk']) {
      const capture = await page.evaluate(async ({ shard, id, pose }) => {
        const api = window.__wildshard, w = api.world, g = w.game, scene = g.rootScene ?? g.scene, r = g.renderer, camera = g.camera;
        g.frameGate = () => false;
        const pine = shard === 'pine-hollow' ? api.shard['pine.quest'].people.find(person => person.kind === id) : undefined;
        const adventure = shard === 'driftwood-isle' ? api.shard['driftwood.adventure'] : undefined;
        const fig = pine?.fig ?? (id === 'trader' ? adventure?.trader?.trader : undefined);
        const root = fig?.group ?? g.scene.getObjectByName('npc-castaway');
        if (root === undefined) throw new Error(`Missing NPC: ${id}`);
        const feet = root.getWorldPosition(root.position.clone());
        w.player.position.set(feet.x, feet.y, feet.z + 2);
        const spine = g.app.systemsByPhase().update.find(system => system.id === 'shard.driftwood-isle.installSpine');
        const advance = (dt, time) => { if (fig !== undefined) fig.update(dt, time, w.player.position); else spine.run(dt, time); };
        if (fig !== undefined) fig.talking = false;
        if (shard === 'driftwood-isle' && id === 'trader') { fig.setNear(true); fig.gesture = 'none'; fig.greeted = true; fig.offerT = 10000; }
        for (let i = 0; i < 900; i++) advance(1 / 30, i / 30);
        if (pose === 'talk') {
          if (pine !== undefined) fig.talking = true;
          else if (id === 'trader') fig.offer();
          else w.interactables.find(prompt => /Wendell/.test(prompt.label ?? '')).onInteract();
          for (let i = 0; i < 195; i++) advance(1 / 30, 10 + i / 30);
        }
        fig?.lod?.(0); root.updateWorldMatrix(true, true);
        const prompt = pine?.prompt ?? w.interactables.find(p => (id === 'castaway' ? /Wendell/ : /Maren/).test(p.label ?? ''));
        if (prompt === undefined) throw new Error(`Missing actual NPC prompt: ${id}`);
        const related = object => { for (let at = object; at !== null && at !== undefined; at = at.parent) if (at === root) return true; return false; };
        const pieces = (w.registry ?? g.app.registry).pieces.filter(piece => piece.colliders?.length > 0 && (related(piece.object) || related(piece.follows)));
        const collider = pieces.length > 0 ? pieces.flatMap(piece => piece.colliders) : fig?.collider;
        if (collider === undefined) throw new Error(`Missing actual NPC collider: ${id}`);
        let visibleTriangles = 0;
        root.traverseVisible(node => {
          if (!node.isMesh || node.isInstancedMesh && node.count === 0) return;
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          if (!materials.some(material => material.visible)) return;
          const count = node.geometry.index?.count ?? node.geometry.getAttribute('position')?.count ?? 0;
          visibleTriangles += Math.min(count, node.geometry.drawRange.count) / 3;
        });
        if (visibleTriangles === 0) throw new Error(`NPC has no visible triangles: ${id}`);
        const geometry = [];
        const digest = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
        const meshes = []; root.traverse(node => { if (node.isMesh) meshes.push(node); });
        for (const mesh of meshes) geometry.push({
          name: mesh.name, attributes: await Promise.all(Object.entries(mesh.geometry.attributes).map(async ([name, attr]) => [name, attr.itemSize, attr.count, await digest(attr.array)])),
          index: mesh.geometry.index === null ? null : await digest(mesh.geometry.index.array),
          material: (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map(mat => ({ type: mat.type, color: mat.color?.toArray(), roughness: mat.roughness,
            metalness: mat.metalness, normalScale: mat.normalScale?.toArray(), side: mat.side, vertexColors: mat.vertexColors })),
        });
        const keep = new Set(); root.traverse(node => keep.add(node));
        const hidden = [];
        scene.traverse(node => { if ((node.isMesh || node.isPoints || node.isLine || node.isSprite) && !keep.has(node)) { hidden.push([node, node.visible]); node.visible = false; }
          for (const mat of Array.isArray(node.material) ? node.material : node.material ? [node.material] : []) for (const key of ['uTime', 'time', 'uCloudTime']) if (typeof mat.uniforms?.[key]?.value === 'number') mat.uniforms[key].value = 10;
        });
        camera.position.set(feet.x, feet.y + 1.3, feet.z + 3.6); camera.lookAt(feet.x, feet.y + 0.95, feet.z); camera.updateMatrixWorld(true);
        r.setRenderTarget(null); r.setScissorTest(false);
        const gl = r.getContext(), ratio = r.getPixelRatio(); r.setViewport(0, 0, gl.drawingBufferWidth / ratio, gl.drawingBufferHeight / ratio);
        r.shadowMap.needsUpdate = true;
        for (let i = 0; i < 3; i++) { r.clear(true, true, true); r.render(scene, camera); }
        const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
        gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let raw = ''; for (let i = 0; i < pixels.length; i += 32768) raw += String.fromCodePoint(...pixels.subarray(i, i + 32768));
        for (const [node, visible] of hidden) node.visible = visible;
        if (pose === 'talk' && id === 'castaway') adventure.spine.dialogue.close(false);
        return { raw: btoa(raw), visibleTriangles, width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, geometry,
          prompt: { at: prompt.position.toArray(), label: prompt.label, radius: prompt.radius }, collider };
      }, { shard: shardName, id: figureId, pose: poseId });
      const { raw, ...facts } = capture, key = `${tier}-${shardName}-${figureId}-${poseId}`, bytes = Buffer.from(raw, 'base64');
      const colors = new Set(); for (let i = 0; i < bytes.length; i += 40) colors.add(`${bytes[i]},${bytes[i + 1]},${bytes[i + 2]}`);
      if (colors.size < 8) throw new Error(`Empty NPC capture: ${key}`);
      writeFileSync(join(out, `${key}.rgba`), bytes); rows.push({ key, ...facts, hash: hash(bytes) });
      console.log(`${key} ${hash(bytes)}`);
    }
    await context.close();
  }
  if (errors.length > 0) throw new Error(errors.join('\n'));
  writeFileSync(join(out, 'summary.json'), `${JSON.stringify({ build: version.build, profile: 'iPhone 16 Pro; fixed real NPC pose; native render scale; plain actual-scene draw with other draws hidden only for parity', rows }, null, 2)}\n`);
} finally { await browser.close(); }
