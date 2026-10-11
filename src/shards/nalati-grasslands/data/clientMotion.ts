import { ClientChannels } from '@wildshard/sdk/clientChannels';

const drift = new ClientChannels('nalati-far-horse.drift');
const x = drift.read('x'), z = drift.read('z'), yaw = drift.read('yaw'), turn = drift.read('turn'), speed = drift.read('speed');
const herdX = drift.read('herdX'), herdZ = drift.read('herdZ'), radius = drift.read('radius'), random = drift.read('random'), step = drift.clock('delta');
const turnDelta = drift.binary('mul', drift.binary('mul', drift.binary('sub', random, drift.constant(0.5)), drift.constant(0.08)), step);
const nextTurn = drift.binary('max', drift.constant(-0.2), drift.binary('min', drift.constant(0.2), drift.binary('add', turn, turnDelta)));
const toCentre = drift.binary('atan2', drift.binary('sub', herdX, x), drift.binary('sub', herdZ, z));
const distance = drift.binary('hypot', drift.binary('sub', x, herdX), drift.binary('sub', z, herdZ));
const headingError = drift.binary('sub', toCentre, yaw);
const correction = drift.select(drift.binary('gt', distance, drift.binary('mul', radius, drift.constant(0.9))),
  drift.binary('mul', drift.binary('atan2', drift.unary('sin', headingError), drift.unary('cos', headingError)), drift.constant(0.3)), drift.constant(0));
const nextYaw = drift.binary('add', yaw, drift.binary('mul', drift.binary('add', nextTurn, correction), step));
drift.output('turn', nextTurn); drift.output('yaw', nextYaw);
drift.output('x', drift.binary('add', x, drift.binary('mul', drift.binary('mul', drift.unary('sin', nextYaw), speed), step)));
drift.output('z', drift.binary('add', z, drift.binary('mul', drift.binary('mul', drift.unary('cos', nextYaw), speed), step)));

// The existing view owner copies its actual clearing-query result after evaluating the proposed draw position.
const commit = new ClientChannels('nalati-far-horse.commit');
const oldX = commit.read('x'), oldZ = commit.read('z'), proposedYaw = commit.read('yaw');
const proposedX = commit.read('nextX'), proposedZ = commit.read('nextZ'), proposedTurn = commit.read('turn'), blocked = commit.read('blocked');
commit.output('x', commit.select(blocked, oldX, proposedX)); commit.output('z', commit.select(blocked, oldZ, proposedZ));
commit.output('yaw', commit.select(blocked, commit.binary('add', proposedYaw, commit.constant(1.5)), proposedYaw));
commit.output('turn', proposedTurn);

/** Private decorative horse poses only; these rows never drive Nalati's authoritative herd, player or colliders. */
export const NALATI_FAR_HERD_CHANNELS = [drift.build(), commit.build()];
