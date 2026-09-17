import { bootstrap } from './core/bootstrap';

async function main() {
  const world = await bootstrap();
  world.game.buildComposer();
  world.game.start();
  (window as unknown as { __world: unknown }).__world = world;
}
main();
