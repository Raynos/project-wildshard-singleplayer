/** Actual Bellback-only arena. Run through browser-lane.sh against a built candidate, never a dev server.
 * Diagnostic PLAYER placement is logged; health, enemy state, clocks, damage and RNG are never injected. */
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { resolve as resolvePath, extname, sep } from 'node:path';

const out = process.env.BELLBACK_QA_OUT ?? 'tmp/bellback-following-diagnostics1';
mkdirSync(out, { recursive: true });
const report = { schema: 'wildshard.bellback.full-combat.v1', startedAt: new Date().toISOString(),
  source: process.env.CAPTURE_SOURCE, errors: [], samples: [], placements: [], checks: {},
  caveat: 'Cloud browser diagnostic; no physical phone performance, fun or visual acceptance claim.' };
const save = () => writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
// A bounded static server for already built bytes, never a Vite development server.
const built = resolvePath(process.env.BELLBACK_QA_DIST ?? 'tmp/bellback-following-preview-dist-build1');
const baseline = JSON.parse(readFileSync('tmp/bellback-following-preview/pose-following4-build1/preview.json'));
if (baseline.sourceHash !== process.env.CAPTURE_SOURCE) throw new Error('Product pin mismatch');
const buildFiles = JSON.parse(readFileSync('art/driftwood-isle/lowpoly-bellback/runtime-admission/arena-candidate4/build1/build-files.json'));
report.buildValidation = buildFiles.map(row => { const bytes = readFileSync(row.path); const actual = createHash('sha256').update(bytes).digest('hex'); if (actual !== row.sha256 || bytes.length !== row.bytes) throw new Error(`Build drift: ${row.path}`); return row; });
const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const path = resolvePath(built, url.pathname === '/' ? 'index.html' : `.${url.pathname}`);
  if (!path.startsWith(`${built}${sep}`)) { response.writeHead(403).end(); return; }
  try {
    response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.css': 'text/css' })[extname(path)] ?? 'application/octet-stream');
    response.end(readFileSync(path));
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => { server.listen(4474, '127.0.0.1', resolve); });
let browser = null, page = null;
try {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--mute-audio', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], viewport: { width: 402, height: 874 }, deviceScaleFactor: 1,
    recordVideo: { dir: `${out}/video`, size: { width: 402, height: 874 } } });
  page = await context.newPage(); page.setDefaultTimeout(120000);
  page.on('pageerror', error => { report.errors.push(error.message); save(); });
  await page.goto(process.env.BELLBACK_QA_URL ?? 'http://127.0.0.1:4474/', { waitUntil: 'domcontentloaded' });
  const storage = () => page.evaluate(() => ({ local: Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)])),
    session: Object.fromEntries(Object.keys(sessionStorage).map(key => [key, sessionStorage.getItem(key)])) }));
  report.storageBefore = await storage();
  await page.locator('#practice-start').tap();
  await page.waitForFunction(() => window.__practiceDemo?.arena.entered === true || !document.querySelector('#practice-start')?.disabled);
  if (!await page.evaluate(() => window.__practiceDemo?.arena.entered === true)) throw new Error(await page.locator('#practice-status').textContent() ?? 'Boot failed');
  const stateStore = () => page.evaluate(() => {
    const saves = window.__practiceDemo.game.app.saves;
    return { docs: JSON.parse(saves.exportAll()).docs,
      shard: saves.inspectShard({ id: 'driftwood-isle' }),
      generation: saves.inspectShardGeneration({ id: 'driftwood-isle' }) };
  });
  report.stateBeforeCombat = await stateStore();
  const sample = () => page.evaluate(() => {
    const d = window.__practiceDemo, a = d.arena.activeTargets[0];
    return { time: d.game.frameTime, state: d.game.app.state, targets: d.arena.activeTargets.length,
      enemy: { kind: a?.kind, hp: a?.hp, maxHp: a?.maxHp, alive: a?.alive, state: a?.state,
        mem: { ...a?.mem }, position: a?.position.toArray(), yaw: a?.yaw,
        bones: Object.fromEntries(Object.entries(a?.bones ?? {}).map(([name, bone]) => [name, { position: bone.position.toArray(), rotation: bone.rotation.toArray().slice(0, 3) }])) },
      player: { health: d.arena.playerVitals, position: d.player.position.toArray(), carried: d.player.carried },
      loot: d.arena.opponent?.loot?.receipt, status: document.querySelector('#practice-status')?.textContent };
  });
  const place = async (placementDistance, placementAngle = 0, placementPitch = .08) => {
    report.placements.push(await page.evaluate(({ distance, angle, pitch }) => {
      const d = window.__practiceDemo, a = d.arena.activeTargets[0];
      d.player.spawn(a.position.x + Math.sin(angle) * distance, a.position.z + Math.cos(angle) * distance, angle, a.position.y);
      d.player.pitch = pitch;
      return { reason: 'Diagnostic player/camera placement; aim also follows the enemy during defense; no enemy/health/time edits', distance, angle, pitch, position: d.player.position.toArray() };
    }, { distance: placementDistance, angle: placementAngle, pitch: placementPitch }));
  };
  const aim = () => page.evaluate(() => {
    const d = window.__practiceDemo, a = d.arena.activeTargets[0];
    const dx = d.player.position.x - a.position.x, dz = d.player.position.z - a.position.z;
    d.player.yaw = Math.atan2(dx, dz); d.player.pitch = Math.atan2(.4, Math.hypot(dx, dz));
  });
  const capture = async name => {
    const envelope = await page.evaluate(() => { const a = window.__practiceDemo.arena.activeTargets[0]; if (!a) return null; const point = a.position.clone(); let minY = Infinity, maxY = -Infinity, count = 0; a.mesh.updateMatrixWorld(true); a.mesh.traverse(mesh => { if (!mesh.isSkinnedMesh) return; mesh.skeleton.update(); const positions = mesh.geometry.getAttribute('position'); for (let i = 0; i < positions.count; i++) { mesh.getVertexPosition(i, point); mesh.localToWorld(point); minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y); count++; } }); return { minY, maxY, count, root: a.mesh.position.toArray(), body: a.bones.body.getWorldPosition(a.position.clone()).toArray(), alive: a.alive, deathT: a.deathT, scale: a.scale, floor: 900 }; });
    report.samples.push({ phase: 'world-envelope', capture: name, envelope }); save();
    await page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 85, scale: 'css' }); };
  const installObserver = () => page.evaluate(() => {
    const d = window.__practiceDemo, g = d.game, render = g.composer.render.bind(g.composer);
    window.__bellbackRenderTrace = [];
    window.__bellbackFixedTrace = [];
    window.__bellbackObservedRagdolls = new WeakSet();
    window.__bellbackObservedAnimals = new WeakSet();
    window.__bellbackReplayCases = [];
    g.viewmodel.visible = false;
    const label = document.createElement('div');
    label.style.cssText = 'position:fixed;top:200px;left:8px;right:8px;color:white;background:#000b;z-index:99999;padding:8px;font:12px monospace;pointer-events:none';
    document.body.append(label);
    g.composer.render = (...args) => {
      const position = g.camera.position.clone(), quaternion = g.camera.quaternion.clone();
      const a = d.arena.activeTargets[0];
      if (!a) return render(...args);
      g.camera.position.set(a.position.x + 6, a.position.y + 4.5, a.position.z + 8);
      g.camera.lookAt(a.position.x, a.position.y + 1.6, a.position.z);
      g.camera.updateMatrixWorld(true); a.mesh.updateMatrixWorld(true);
      if(!window.__bellbackObservedAnimals.has(a)) {
        window.__bellbackObservedAnimals.add(a);
        const originalStart=a.startRagdoll.bind(a);
        a.startRagdoll=(...args)=>{
          originalStart(...args);const r=a.ragdoll;if(!r)return;
          const physics=r.system.physics,world=physics.world;
          const scalar=c=>Object.fromEntries(Object.entries(c).filter(([k,v])=>['number','string','boolean'].includes(typeof v)));
          const bodyState=b=>({position:b.translation(),rotation:b.rotation(),linvel:b.linvel(),angvel:b.angvel(),mass:b.mass(),localCom:b.localCom(),principalInertia:b.principalInertia(),principalInertiaLocalFrame:b.principalInertiaLocalFrame(),linearDamping:b.linearDamping(),angularDamping:b.angularDamping(),gravityScale:b.gravityScale(),additionalSolverIterations:b.additionalSolverIterations(),additionalPgsIterations:b.additionalPgsIterations(),ccd:b.isCcdEnabled(),sleeping:b.isSleeping()});
          const bones=()=>Object.fromEntries(Object.entries(a.bones).map(([n,b])=>[n,[...b.position,...b.quaternion]]));
          const inputs=()=>({mem:{...r.corpsePose.inputs.mem},phase:r.corpsePose.inputs.phase,state:r.corpsePose.inputs.state,yaw:r.corpsePose.inputs.yaw});
          const shapeState=c=>({handle:c.handle,type:c.shapeType(),position:c.translation(),rotation:c.rotation(),localPosition:c.translationWrtParent(),localRotation:c.rotationWrtParent(),halfExtents:c.halfExtents(),friction:c.friction(),restitution:c.restitution(),collisionGroups:c.collisionGroups(),solverGroups:c.solverGroups(),sensor:c.isSensor()});
          const environment=[];world.forEachCollider(c=>{if(!r.corpseColliders.some(p=>p.collider.handle===c.handle)&&(c.collisionGroups()>>>16&1))environment.push(shapeState(c));});
          const ip=world.integrationParameters,settings=Object.fromEntries(['dt','lengthUnit','normalizedAllowedLinearError','normalizedPredictionDistance','numSolverIterations','numInternalPgsIterations','maxCcdSubsteps','contact_erp'].map(k=>[k,ip[k]]));
          const row={scenario:window.__combatScenario,settings,environment,initial:{root:{position:a.mesh.position.toArray(),rotation:a.mesh.quaternion.toArray(),scale:a.scale},bones:bones(),dims:a.model.dims,context:scalar(r.corpsePose.context),contextMem:{...r.corpsePose.context.mem},inputs:inputs(),body:bodyState(r.parts[0].body),shapes:r.corpseColliders.map(p=>({bone:p.bone.name,...shapeState(p.collider)})),damage:args[0],hitPoint:args[1].toArray(),dir:args[2].toArray(),velocity:{x:Math.sin(a.yaw)*a.speed+Math.cos(a.yaw)*a.strafe,y:0,z:Math.cos(a.yaw)*a.speed-Math.sin(a.yaw)*a.strafe}},steps:[]};
          window.__bellbackReplayCases.push(row);
          const pre=r.fixedPre.bind(r),post=r.fixedPost.bind(r);
          let pending=null;
          r.fixedPre=dt=>{pending={dt,frame:g.frameCount,gameTime:g.frameTime,inputs:inputs(),before:bodyState(r.parts[0].body)};pre(dt);pending.context=scalar(r.corpsePose.context);pending.contextMem={...r.corpsePose.context.mem};pending.bones=bones();pending.localShapes=r.corpseColliders.map(p=>({bone:p.bone.name,position:p.collider.translationWrtParent(),rotation:p.collider.rotationWrtParent()}));};
          r.fixedPost=dt=>{
            const b=r.parts[0]?.body;
            if(pending&&b&&r.state==='live'){
              pending.after=bodyState(b);pending.worldShapes=r.corpseColliders.map(p=>({bone:p.bone.name,...shapeState(p.collider)}));pending.contacts=[];
              for(const part of r.corpseColliders)world.contactPairsWith(part.collider,other=>world.contactPair(part.collider,other,(m,flipped)=>pending.contacts.push({bone:part.bone.name,other:other.handle,flipped,normal:m.normal(),points:Array.from({length:m.numContacts()},(_,i)=>({distance:m.contactDist(i),impulse:m.contactImpulse(i),local1:m.localContactPoint1(i),local2:m.localContactPoint2(i)})),solver:Array.from({length:m.numSolverContacts()},(_,i)=>({distance:m.solverContactDist(i),point:m.solverContactPoint(i)}))})));
              row.steps.push(pending);
            }
            post(dt);if(pending)pending.resultState=r.state;pending=null;
          };
        };
      }
      const strike = JSON.parse(d.arena.opponent.callbacks.control(a).snapshot()).strike;
      window.__bellbackRenderTrace.push({ frame: g.frameCount, gameTime: g.frameTime, wallTime: performance.now(),
        scenario: window.__combatScenario ?? 'entry', player: { health: d.arena.playerVitals.health, position: d.player.position.toArray() }, stage: a.mem['tg-state'], clock: a.mem['tg-clock'], strike, speed: a.speed, gait: a.phase,
        flinch: a.flinch, deathT: a.deathT, hp: a.hp, alive: a.alive,
        ragdoll: a.ragdoll ? { build: a.ragdoll.build, state: a.ragdoll.state, bodies: a.ragdoll.bodies, fixedPose:a.ragdoll.fixedPose, fixedDeathT:a.ragdoll.corpseDeathT, fastest:a.ragdoll.fastest, shapes:a.ragdoll.state==='live'?a.ragdoll.corpseColliders.map(({bone,collider:c})=>({bone:bone.name,handle:c.handle,position:c.translation(),rotation:c.rotation()})):[] } : null,
        world: a.mesh.matrixWorld.toArray(),
        bones: Object.fromEntries(Object.entries(a.bones).map(([name, bone]) => [name, [...bone.position, ...bone.quaternion]])) });
      label.textContent = `BELLBACK RUNTIME CANDIDATE4 · LIVE AI / COMBAT · OBSERVER CAMERA · frame ${g.frameCount} · ${g.frameTime.toFixed(2)}s · ${strike.phase} · death ${a.deathT.toFixed(2)}`;
      try { return render(...args); }
      finally { g.camera.position.copy(position); g.camera.quaternion.copy(quaternion); g.camera.updateMatrixWorld(true); }
    };
    return { scope: 'Camera temporarily offset during rendering and restored immediately. Full body capture; enemy/health/time unmodified. Candidate4 exact bone-following recipe and unchanged anatomy3 motion; compare exact source pins.' };
  });
  report.observerCamera = await installObserver();
  const scenario = scenarioName => page.evaluate(value => { window.__combatScenario = value; }, scenarioName);
  report.entry=await sample();save();
  for(const [name,angle] of [['diagnostic-front',0],['diagnostic-angle',1.35]]) {
    await scenario(name);
    for(let attempt=0;attempt<24;attempt++) {
      const row=await sample();if(!row.enemy.alive||row.player.health?.health===0)break;
      await place(2.2,angle,.03);await page.locator('.ws-touch-attack').tap();await page.waitForTimeout(1100);
      report.samples.push({phase:name,...await sample()});save();
    }
    report.checks[name]=!(await sample()).enemy.alive;
    if(report.checks[name]) {await page.waitForFunction(()=>window.__practiceDemo.arena.activeTargets[0]?.ragdoll?.state==='frozen',undefined,{timeout:45000});await page.waitForTimeout(1500);await capture(name+'-frozen');}
    const cases=await page.evaluate(()=>window.__bellbackReplayCases);
    for(let i=0;i<cases.length;i++)writeFileSync(`${out}/replay-case-${i}.json`,JSON.stringify(cases[i]));
    await page.locator('#practice-retry').tap();await page.waitForTimeout(600);
  }
  writeFileSync(`${out}/render-trace.json`,JSON.stringify(await page.evaluate(()=>window.__bellbackRenderTrace)));
  report.checks.errors=report.errors.length===0;
  if(Object.values(report.checks).some(v=>v!==true))process.exitCode=1;
  await context.close();
} catch(error) {report.fatal=error.message;process.exitCode=1;}
finally {await browser?.close();await new Promise(resolve=>server.close(resolve));report.endedAt=new Date().toISOString();save();}
