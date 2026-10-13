import { ClientChannels } from '@wildshard/sdk/clientChannels';
import { SKY_MOVER_BINDING } from './moverBindings';
import isletMotion from './isletMotion.generated.json' with { type: 'json' };

const winch = new ClientChannels('far.winch.view'); winch.fromMover(SKY_MOVER_BINDING.winch);
for (const [property, read] of [['pitch', 'euler.x'], ['yaw', 'euler.y'], ['roll', 'euler.z']] as const) {
  winch.output(property, winch.read(read)); winch.bind(property, 'winch', 'YXZ');
}
winch.output('value', winch.read('enabled'));
winch.output('turn', winch.read('field.6'));
/** Published native observations: scene rotation and read-only raised/raising signals, never a clock or body. */
export const SKY_MOVER_VIEWS = [winch.build(), ...isletMotion.channels];
