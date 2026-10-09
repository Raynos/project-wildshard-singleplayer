// The headless half of the updraft ride: the same start, mount and stick as the browser probe.
const R = '/Users/raynos/projects/games/wildshard-singleplayer/';
const { readFileSync } = await import('node:fs');
const { installAppIdentity } = await import(R + 'src/engine/app/identity.ts');
const { WILDSHARD_IDENTITY } = await import(R + 'src/game/identity.ts');
installAppIdentity(WILDSHARD_IDENTITY);
const { createSimHost } = await import(R + 'src/engine/sim.ts');
const { loadRapier } = await import(R + 'src/engine/physics/rapier.ts');
const source = (await import(R + 'src/shards/far-reach/shard.config.ts')).default;
const { prepareHeadlessRuntime } = await import(R + 'src/shards/far-reach/runtime/headless.ts');
const rapier = await loadRapier(readFileSync(R + 'public/assets/physics/rapier.wasm'));
const assets = new Map(source.files.map(f => [f.hash, new Uint8Array(readFileSync(R + `src/shards/far-reach/assets/${f.hash}`))]));
const plan = await prepareHeadlessRuntime({ shard: source, assets, rapier });
const host = createSimHost(plan.level, { ...plan.ports, rapier });
plan.install(host, { restoring: false, commands: () => [], emit: () => {} });
const WP = [[-11.53, -75.17], [-54.55, -116.84], [-64, -126]];
host.player.position.set(-8.66, 30.2, -72.39);
for (let i = 0; i < 60; i++) host.step({ moveX: 0, moveZ: 0, yaw: 2.37 });
host.step({ moveX: 0, moveZ: 0, yaw: 2.37, hover: true });
for (let i = 0; i < 30; i++) host.step({ moveX: 0, moveZ: 0, yaw: 2.37 });
const rows = []; let wi = 0, landings = [], wasAir = false, hp0 = host.player.health.attributes.health;
for (let t = 0; t < 60 * 20 && wi < WP.length; t++) {
  const p = host.player.position, [x, z] = WP[wi], dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
  if (d < 0.8) { wi++; continue; }
  const vyBefore = host.boardVelocity.y;
  host.step({ moveX: dx / d, moveZ: dz / d, yaw: Math.atan2(-dx, -dz) });
  const air = host.playerBoard.hoverAir;
  if (wasAir && !air) landings.push({ t, vy: -vyBefore, y: p.y });
  wasAir = air;
  rows.push([t, +p.x.toFixed(2), +p.y.toFixed(3), +p.z.toFixed(2), +host.boardVelocity.y.toFixed(2), air ? 1 : 0, +host.player.health.attributes.health.toFixed(0)]);
  if (p.y < 20) break;
}
const minVy = Math.min(...rows.map(r => r[4]));
console.log(JSON.stringify({ host: 'headless', ticks: rows.length, end: rows.at(-1), maxY: Math.max(...rows.map(r => r[2])), minVy, landings: landings.length, hard: landings.filter(l => l.vy > 9).length, hp: [hp0, host.player.health.attributes.health], rows }));
