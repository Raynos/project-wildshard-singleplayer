import { ClientChannels } from '@wildshard/sdk/clientChannels';
import { NINE_FLOOR_PLAN } from './floorPlan';
import { MOVERS } from './worldDressing';

const datum = NINE_FLOOR_PLAN.datum;
const train = new ClientChannels('nds-train'), trainTime = train.clock('time');
train.output('x', train.binary('add', train.constant(MOVERS.train.x), train.binary('mod', train.binary('mul', trainTime, train.constant(MOVERS.train.speed)), train.constant(MOVERS.train.length))));
train.output('y', train.constant(datum + MOVERS.train.y)); train.output('z', train.constant(MOVERS.train.z));

const cable = { z: -12, y: datum - 16, x0: NINE_FLOOR_PLAN.well.x0, x1: NINE_FLOOR_PLAN.well.x1 };
const gondola = new ClientChannels('nds-gondola'), gondolaTime = gondola.clock('time');
const swing = gondola.unary('sin', gondola.binary('add', gondola.binary('mul', gondolaTime, gondola.constant(MOVERS.gondola.rate)), gondola.constant(MOVERS.gondola.phase)));
const gondolaX = gondola.binary('add', gondola.constant(cable.x0 + MOVERS.gondola.margin),
  gondola.binary('mul', gondola.constant(cable.x1 - cable.x0 - MOVERS.gondola.margin * 2), gondola.binary('add', gondola.constant(0.5), gondola.binary('mul', gondola.constant(0.5), swing))));
gondola.output('x', gondolaX);
gondola.output('y', gondola.binary('add', gondola.constant(cable.y), gondola.binary('mul',
  gondola.binary('div', gondola.binary('sub', gondolaX, gondola.constant(cable.x0)), gondola.constant(cable.x1 - cable.x0)), gondola.constant(MOVERS.gondola.rise))));
gondola.output('z', gondola.constant(cable.z));

const drones = MOVERS.drones.map((path, index) => {
  const drone = new ClientChannels(`nds-drone.${index}`), time = drone.clock('time');
  const angle = drone.binary('add', drone.binary('mul', time, drone.constant(path.rate)), drone.constant(path.phase));
  drone.output('x', drone.binary('add', drone.constant(path.x), drone.binary('mul', drone.unary('cos', angle), drone.constant(path.r))));
  drone.output('y', drone.binary('add', drone.constant(datum + path.y), drone.binary('mul', drone.unary('sin',
    drone.binary('add', drone.binary('mul', time, drone.constant(path.bobRate)), drone.constant(path.phase))), drone.constant(path.bob))));
  drone.output('z', drone.binary('add', drone.constant(path.z), drone.binary('mul', drone.unary('sin', angle), drone.constant(path.r))));
  drone.output('yaw', drone.unary('neg', angle));
  return drone.build();
});

/** Read-only decorative motion on the continuous page clock; physical portals stay with their native owner. */
export const NINE_CLIENT_CHANNELS = [train.build(), gondola.build(), ...drones];
