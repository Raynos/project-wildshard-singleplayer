// Dev entry: base world + grass carpet + undergrowth + atmosphere particles.
// http://localhost:5173/dev/grass.html?nolock=1&x=0&z=-20&yaw=0&pitch=0
import { bootstrap } from '../core/bootstrap';
import { Grass } from '../world/Grass';

const world = await bootstrap();
const grass = new Grass(world.sky, world.forest).build();
world.game.scene.add(grass.group);
world.game.onUpdate((dt) => grass.update(dt, world.player.position));

(window as unknown as { __world: unknown }).__world = { ...world, grass };
world.game.buildComposer();
world.game.start();
