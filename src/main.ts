import { bootstrap } from './core/bootstrap';
import { Boundary } from './world/Boundary';
import { Water } from './world/Water';

async function main() {
  const world = await bootstrap();
  const boundary = new Boundary(world.sky).build();
  world.game.scene.add(boundary.group);
  world.game.onUpdate((dt, t) => boundary.update(dt, t));
  const water = new Water(world.sky).build();
  world.game.scene.add(water.mesh);
  world.game.onUpdate((dt) => water.update(dt));
  world.game.buildComposer();
  world.game.start();
  (window as unknown as { __world: unknown }).__world = world;
}
main();
