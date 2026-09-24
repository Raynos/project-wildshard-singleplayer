// Dev entry: base world + the painterly grass carpet (B1 of project/archive/2026-09-23-nalati.md) + wind + trample.
// http://127.0.0.1:5188/dev/nalati-grass.html?chunk=nalati-grasslands&nolock=1&x=0&z=225&yaw=0&pitch=0
// Before the Nalati chunk exists: ?chunk=pine-hollow&grass=painterly&noforest=1
// Params: ?wind=<m/s>  ?winddir=<rad>  ?gust=<0..1>  ?wolves=<n> (fake movers circling the player)
//         ?crouch=1 (eye at 1.03 m)
// window.__world = { ...bootstrap(), grass, wind, trample, grassHeightAt, stats() }
import * as THREE from 'three';
import { bootstrap } from '../core/bootstrap';
import { Grass } from '../world/Grass';
import { wind } from '../world/steppeWind';
import { trample, grassHeightAt } from '../world/GrassTrample';
import { heightAt } from '../world/Heightfield';

const world = await bootstrap();
const { game, player, params, num } = world;
if (params.has('noforest')) world.forest.group.visible = false;
const grass = new Grass(world.sky, world.forest).build();
game.scene.add(grass.group);
if (params.has('wind')) wind.set(num('wind', 5), num('winddir', wind.dir), num('gust', wind.gustiness));

// fake movers: wolves loping on circles 14 m ahead of the player, so the wakes / trample trails can be judged
const wolves = Math.round(num('wolves', 0));
const wolfMeshes: THREE.Mesh[] = [];
for (let i = 0; i < wolves; i++) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.7, 1.1), new THREE.MeshStandardMaterial({ color: 0x6b6358 }));
  world.sky.setupMaterial(m.material);
  game.scene.add(m); wolfMeshes.push(m);
  trample.track(m.position, 0.7);
}
const prev = wolfMeshes.map(() => new THREE.Vector2(Number.NaN, 0));
game.onUpdate((dt, t) => {
  wolfMeshes.forEach((m, i) => {
    const r = 4 + i * 3, w = (i % 2 ? -1 : 1) * 5.5 / r, a = t * w + i * 1.7;
    const cx = player.position.x - Math.sin(player.yaw) * 14, cz = player.position.z - Math.cos(player.yaw) * 14;
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    const p = prev[i];
    const vx = p && !Number.isNaN(p.x) ? (x - p.x) / Math.max(dt, 1e-3) : 0, vz = p && !Number.isNaN(p.x) ? (z - p.y) / Math.max(dt, 1e-3) : 0;
    p?.set(x, z);
    m.position.set(x, heightAt(x, z) + 0.45, z);
    m.rotation.y = Math.atan2(vx, vz);
  });
  grass.update(dt, player.position);
});

function stats() {
  const p = grass.painterly;
  const info = { calls: game.lastFrame.calls, tris: game.lastFrame.triangles, grass: {} as Record<string, unknown> };
  if (p) {
    const [tn, tf] = p.trisPerInstance;
    const n = p.near.n * p.near.n * p.near.k, f = p.far.n * p.far.n * p.far.k;
    info.grass = {
      nearInstances: n, nearLive: p.near.live, nearTrisDrawn: n * tn, nearTrisLive: p.near.live * tn,
      farInstances: f, farLive: p.far.live, farTrisDrawn: f * tf, farTrisLive: p.far.live * tf,
      wind: { speed: wind.speed.toFixed(1), dir: wind.dir.toFixed(2) },
      heightHere: grassHeightAt(player.position.x, player.position.z).toFixed(2),
    };
  }
  return info;
}
if (params.has('crouch')) player.keys.add('KeyC');
(window as unknown as { __world: unknown }).__world = { ...world, grass, wind, trample, grassHeightAt, stats };
game.buildComposer();
game.start();
