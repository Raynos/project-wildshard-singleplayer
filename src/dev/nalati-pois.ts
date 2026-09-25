// Dev entry: Nalati POIs (B5) — base world + the Nalati wiring (look, water, POIs), no weapons / animals / grass.
// http://127.0.0.1:5188/dev/nalati-pois.html?chunk=nalati-grasslands&nolock=1&x=60&z=215&yaw=-1.6&pitch=-0.1
// window.__world = { ...bootstrap(), nalati }; __pois.stats() → triangles per piece; __pois.timings → build ms
import { bootstrap } from '../core/bootstrap';
import { wireNalati } from '../nalati';

if (!new URLSearchParams(location.search).has('chunk')) location.search += `${location.search ? '&' : '?'}chunk=nalati-grasslands`;

const world = await bootstrap();
const { game, sky, player, forest, chunk } = world;
const nalati = await wireNalati({ game, sky, player, forest, chunk });
{ let y = -Infinity; for (const p of player.platforms) { const h = p(player.position.x, player.position.z); if (h !== undefined && h > y) y = h; } if (y > player.position.y) player.position.y = y; }
game.onUpdate((dt, t) => nalati.update(dt, t));
console.log('[nalati-pois] build ms', JSON.stringify(nalati.pois.timings), 'tris', JSON.stringify(nalati.pois.stats()));

const w = window as unknown as { __world: unknown; __pois: unknown };
w.__world = { ...world, nalati };
w.__pois = nalati.pois;
game.buildComposer();
game.start();
