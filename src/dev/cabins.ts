// Dev entry: base world + the three log cabins + forest props (boulders, stumps, fallen logs).
// http://localhost:5173/dev/cabins.html?nolock=1&x=-2&z=-26&yaw=1.2&pitch=0
// window.__world = { ...bootstrap(), cabins, props }
// Press E (or call __world.interact()) to use the nearest door.
import { bootstrap } from '../core/bootstrap';
import { Cabins } from '../world/Cabin';
import { Props } from '../world/Props';

const world = await bootstrap();
const cabins = new Cabins(world.sky);
const { group, colliders, interactables } = await cabins.build();
world.game.scene.add(group);
world.player.colliders.push(...colliders);

const props = new Props(world.sky, world.forest);
world.game.scene.add(await props.build());
world.player.colliders.push(...props.colliders);
console.log('props', JSON.stringify(props.counts), 'colliders', world.player.colliders.length);

world.game.onUpdate((dt, t) => cabins.update(dt, t));

function interact() {
  const p = world.player.position;
  let best: (typeof interactables)[number] | undefined, bd = Infinity;
  for (const i of interactables) {
    const d = i.position.distanceTo(p);
    if (d < i.radius && d < bd) { best = i; bd = d; }
  }
  if (best) { console.log('interact:', best.label); best.onInteract(); }
  return best?.label;
}
document.addEventListener('keydown', (e) => { if (e.code === 'KeyE') interact(); });

(window as unknown as { __world: unknown }).__world = { ...world, cabins, props, interactables, interact };
world.game.buildComposer();
world.game.start();
