// Real-fight query parity, including the previous-pose collision cache. Writes a bounded summary, never a frame archive.
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';
import { saveFixture } from '../../../../scripts/debug-settings.mjs';

const [url, output] = process.argv.slice(2);
if (!url || !output) throw new Error('Expected preview URL and summary path');
const errors = [], browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio'] });
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], deviceScaleFactor: 2 });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  const page = await context.newPage(); page.on('pageerror', error => { errors.push(String(error)); });
  await page.goto(new URL('/?chunk=pine-hollow&mute=1&skipintro=1&nolock=1&sw=0&tier=phone', url).href);
  await page.waitForFunction(() => window.__antlerKing?.fight?.king && window.__wildshard?.world && !document.querySelector('.ws-load'), null, { timeout: 240000 });
  const summary = await page.evaluate(async () => {
    const world = window.__wildshard.world, host = window.__antlerKing, king = host.fight.king;
    const scene = world.game.scene, species = king.model.species, prototype = Object.getPrototypeOf(king);
    if (!Object.hasOwn(king, 'headWorld') || king.headWorld === prototype.headWorld) throw new Error('King FK queries are not activated');
    const V = king.position.constructor;
    const head = new V(), headOld = new V(), a = new V(), b = new V(), aOld = new V(), bOld = new V(), ribsOld = new V();
    const look = host.fight.look, chest = king.mesh.getObjectByName('chest');
    if (!look || !chest) throw new Error('Missing actual King cage');
    look.ribcageWorld(ribsOld);
    const cage = chest.children.find(child => child.getWorldPosition(new V()).distanceToSquared(ribsOld) < 1e-20);
    if (!cage) throw new Error('Missing authored King ribcage');
    const prior = { head: king.headWorld, body: king.bodyCapsule, fore: king.foreCapsule,
      ribs: look.ribcageWorld, animate: species.animate, render: scene.onBeforeRender };
    const counts = { head: 0, body: 0, fore: 0, ribs: 0, beforePose: 0, afterPose: 0, render: 0 };
    const max = { head: 0, body: 0, fore: 0, ribs: 0 }, failures = [], modes = new Set();
    const epsilon = 1e-10;
    let phase = 0, sequence = 0;
    const record = (kind, delta) => {
      counts[kind]++; max[kind] = Math.max(max[kind], delta);
      if (delta > epsilon && failures.length < 8) failures.push({ kind, delta, phase, sequence, mode: host.fight.mode });
    };
    const headQuery = out => {
      const result = prior.head.call(king, out); prototype.headWorld.call(king, headOld);
      record('head', out.distanceTo(headOld)); return result;
    };
    const bodyQuery = (rear, front) => {
      prior.body.call(king, rear, front); prototype.bodyCapsule.call(king, aOld, bOld);
      record('body', Math.max(rear.distanceTo(aOld), front.distanceTo(bOld)));
    };
    const foreQuery = (left, right) => {
      const result = prior.fore.call(king, left, right), old = prototype.foreCapsule.call(king, aOld, bOld);
      if (result !== old) throw new Error('King fore-capsule presence changed');
      if (result) record('fore', Math.max(left.distanceTo(aOld), right.distanceTo(bOld)));
      return result;
    };
    const check = () => { headQuery(head); bodyQuery(a, b); foreQuery(a, b); };
    king.headWorld = headQuery; king.bodyCapsule = bodyQuery; king.foreCapsule = foreQuery;
    look.ribcageWorld = out => {
      const result = prior.ribs(out);
      // Passive read of the old live cage after its original parent-chain propagation, with no extra publication.
      ribsOld.setFromMatrixPosition(cage.matrixWorld); record('ribs', out.distanceTo(ribsOld)); check(); return result;
    };
    species.animate = c => {
      if (c.animal === king) { counts.beforePose++; check(); }
      prior.animate(c);
      if (c.animal === king) { sequence++; counts.afterPose++; check(); modes.add(host.fight.mode); }
    };
    scene.onBeforeRender = function (...args) {
      prior.render.apply(this, args); counts.render++; check();
    };
    try {
      host.forcedNight = true;
      world.game.app.player.attributes.maxHealth = world.game.app.player.attributes.health = 1000000;
      for (phase = 0; phase < 3; phase++) {
        world.player.spawn(150, -20, 0); host.boss.devStartAt(phase);
        await new Promise(resolve => setTimeout(resolve, 12000));
      }
    } finally {
      king.headWorld = prior.head; king.bodyCapsule = prior.body; king.foreCapsule = prior.fore;
      look.ribcageWorld = prior.ribs; species.animate = prior.animate; scene.onBeforeRender = prior.render;
    }
    return { actualFight: true, epsilonMetres: epsilon, queries: counts, maxErrorMetres: max,
      modes: [...modes], firstFailures: failures, pass: failures.length === 0 && counts.afterPose >= 900 };
  });
  const version = await (await fetch(new URL('/version.json', url))).json();
  const result = { build: version.build, ...summary, errors, pass: summary.pass && errors.length === 0 };
  writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`); console.log(JSON.stringify(result));
  if (!result.pass) process.exitCode = 1;
  await context.close();
} finally { await browser.close(); }
