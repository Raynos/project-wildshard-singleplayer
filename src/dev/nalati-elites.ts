// Dev entry: the Nalati named elites (row B12 of project/archive/2026-09-23-nalati.md) — the elite system + the five, without the rest of the
// shard's wiring (so another row's work in progress cannot take this page down).
// http://127.0.0.1:5188/dev/nalati-elites.html?nolock=1&elite=aqbars|kokbori|qyran|qara-batyr|argymaq
//   &wildlife=1   the shard's NALATI_WILDLIFE too (Kokbori's pack and Argymaq's herd are spawned either way)
// window.__world = { ...bootstrap(), animals, wildlife, elites }   window.__elites (src/nalati/elites.ts)
import { bootstrap } from '../core/bootstrap';
import { AnimalManager } from '../entities/AnimalManager';
import { Wildlife, NALATI_WILDLIFE } from '../entities/Wildlife';
import { wildEnv } from '../entities/wildEnv';
import { NalatiPOIs } from '../world/nalati';
import { wireElites } from '../nalati/elites';
import { Minimap } from '../ui/Minimap';
import type { Interactable } from '../world/Cabin';

if (!new URLSearchParams(location.search).has('chunk')) location.search += `${location.search ? '&' : '?'}chunk=nalati-grasslands`;

const world = await bootstrap();
const { game, sky, player, params } = world;
const pois = new NalatiPOIs(sky).build();
pois.addTo(game.scene, player);
const animals = new AnimalManager(game.scene, sky, world.forest, { style: 'painterly' }).build();
animals.onCharge = (a, dmg) => console.log('[elites] hurt by', a.kind, dmg);
animals.onKill = (a) => console.log('[elites] kill', a.kind, a.variant);
wildEnv.onKnockdown = () => console.log('[elites] knocked down');
const wildlife = new Wildlife(animals, { scene: game.scene, sky, seed: world.chunk.seed, layout: params.has('wildlife') ? NALATI_WILDLIFE : { packs: [], herds: [], flocks: [] } }).build();
const time = params.get('time') ?? 'day';
const elites = wireElites({ game, sky, player, ledges: pois.cragLedges, phase: () => time, storm: () => params.has('storm') });
const interactables: Interactable[] = [];
elites.bind({
  animals, wildlife, taming: null, ghosts: null, interactables, params,
  toast: (s) => { console.log('[elites] toast', s); }, feed: (s) => { console.log('[elites] feed', s); },
  addItem: (id) => { console.log('[elites] item', id); }, record: (k, v) => { console.log('[elites] record', k, v); },
});
const minimap = new Minimap();
game.onUpdate((dt, t) => {
  pois.update(dt);
  animals.update(dt, t, player.position, player.sprinting);
  wildlife.update(dt, t, player);
  elites.update(dt, t);
  minimap.update(player.position, player.yaw, animals.animals);
});
Object.assign(window, { __world: { ...world, animals, wildlife, elites, pois } });
game.buildComposer();
game.start();
