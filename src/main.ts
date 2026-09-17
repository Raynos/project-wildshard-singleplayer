import { bootstrap } from './core/bootstrap';
import { Boundary } from './world/Boundary';

async function main() {
  const world = await bootstrap();
  const boundary = new Boundary(world.sky).build();
  world.game.scene.add(boundary.group);
  world.game.onUpdate((dt, t) => boundary.update(dt, t));
  world.game.buildComposer();
  world.game.start();
  (window as unknown as { __world: unknown }).__world = world;
}
main();
