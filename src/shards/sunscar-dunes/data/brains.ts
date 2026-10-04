/** Shipping strider challenge and exact charge/close utility, including native pose memory fields. */
export const STRIDER_BRAIN = { id: 'sunscar.brain.strider', kind: 'challenge-grazer', charge: 'sunscar.strider.charge', close: 'sunscar.strider.horns',
  noticeRadius: 24, chargeRadius: 17, loseRadius: 40, walkSpeed: 1.1, approachSpeed: 2.4, homeRadius: 16, faceSeconds: 0.7,
  circleRate: 0.05, farPreferenceRadius: 5, farWeight: 2, nearWeight: 0.2, closeWeight: 1, windupField: 'paw', recoveryField: 'winded' };
/** Shipping home patrol and near-player swoop; the native recipe supplies the tower home. */
export const RAY_BRAIN = { id: 'sunscar.brain.ray', kind: 'patrol-diver', strike: 'sunscar.ray.swoop',
  glideAltitude: 14, glideSpeed: 9, circleRadius: 20, patrolRadius: 34, patrolAltitude: 22,
  noticeRadius: 55, diveFrom: 38, diveSpeed: 15, climbAltitude: 17, climbSeconds: 2.6, diveMaxSeconds: 4.5,
  restSeconds: 3, targetHeight: 1.2, diveSlope: 0.35, climbSpeedBonus: 3, orbitLead: 0.55, heldField: 'held' };
