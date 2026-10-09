import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';
import { saveFixture } from '../../../../scripts/debug-settings.mjs';

const url = process.argv[2], output = process.argv[3];
if (!url || !output) throw new Error('Expected preview URL and output path');
const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--mute-audio'] });
const errors = [];
try {
  const context = await browser.newContext({ ...devices['iPhone 16 Pro'], deviceScaleFactor: 2 });
  await saveFixture(context, { scope: 'device', key: 'devMode', data: true });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(new URL('/?chunk=pine-hollow&mute=1&skipintro=1&nolock=1&sw=0&tier=phone', url).href);
  await page.waitForFunction(() => window.__antlerKing?.fight?.king && window.__wildshard?.world && !document.querySelector('.ws-load'), null, { timeout: 240000 });
  const trace = await page.evaluate(async () => {
    const w = window.__wildshard.world, host = window.__antlerKing, king = host.fight.king;
    const scene = w.game.scene, species = king.model.species;
    const previousAnimate = species.animate, previousRender = scene.onBeforeRender;
    const V = king.position.constructor, a = new V(), b = new V();
    let input = null, phase = 0, sequence = 0, last = -1;
    const frames = [], modes = new Set();
    const point = p => ({ x: p.x, y: p.y, z: p.z });
    species.animate = c => {
      if (c.animal === king) {
        input = { dt: c.dt, t: c.t, scale: c.scale, speed: c.speed, deathT: c.deathT, flinch: c.flinch,
          brace: c.brace, attack: c.attack, lookWeight: c.lookWeight, yaw: c.yaw,
          lookTarget: point(c.lookTarget), position: point(c.position), mem: { ...c.mem } };
        sequence++;
      }
      previousAnimate(c);
    };
    scene.onBeforeRender = function(...args) {
      previousRender.apply(this, args);
      if (input === null || last === sequence || frames.length >= 10000) return;
      last = sequence;
      const head = king.headWorld(a).toArray();
      king.bodyCapsule(a, b); const body = [a.toArray(), b.toArray()];
      if (!king.foreCapsule(a, b)) throw new Error('Missing real King fore capsule');
      const fore = [a.toArray(), b.toArray()], ribs = host.fight.look.ribcageWorld(a).toArray();
      modes.add(host.fight.mode);
      frames.push({ sequence, phase, mode: host.fight.mode, input, world: king.mesh.matrixWorld.toArray(), head, body, fore, ribs });
    };
    try {
      // Exercise the real fight adapter, without replacement AI or debug gait poses. The ordinary boss developer
      // start port supplies each phase; health only prevents the harness dying before it can observe that phase.
      host.forcedNight = true;
      w.game.app.player.attributes.maxHealth = 1000000;
      w.game.app.player.attributes.health = 1000000;
      for (phase = 0; phase < 3; phase++) {
        w.player.spawn(150, -20, 0);
        host.boss.devStartAt(phase);
        await new Promise(resolve => setTimeout(resolve, 12000));
      }
    } finally {
      species.animate = previousAnimate;
      scene.onBeforeRender = previousRender;
    }
    return { frames, modes: [...modes], actualFight: true, samplePoint: 'scene.onBeforeRender after scene matrix propagation', renderedSamples: frames.length };
  });
  const version = await (await fetch(new URL('/version.json', url))).json();
  if (errors.length > 0 || trace.frames.length < 100) throw new Error(JSON.stringify({ errors, samples: trace.frames.length }));
  writeFileSync(output, JSON.stringify({ version, ...trace, errors }) + '\n');
  console.log(JSON.stringify({ build: version.build, samples: trace.frames.length, modes: trace.modes, errors }));
  await context.close();
} finally { await browser.close(); }
