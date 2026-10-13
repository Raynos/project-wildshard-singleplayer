
/** Original native fan command identities; every pitch command is tick-local, never held continuation. */
export const FAN_ACTOR = 'far.fan';
export const FAN_AIM = 'far.fan.aim';
export const FAN_ACT = { heavy: 1, gust: 2 } as const;
export const FAN_STEP = 'item.weapon.far-reach.fan';
export const FAN_PITCH_LIMIT = 1.45;
/** The shared host retains immediate contacts, the camera pitch clamp and both original cooldown fields. */
export const SKY_MELEE_HOST = {
  step: FAN_STEP, eye: 1.68, mode: 'immediate', pitchLimit: FAN_PITCH_LIMIT, zeroAim: 'refuse',
  body: 'none', liveTargetsOnly: true, commandsAfterCool: true,
  actions: [{ action: 0, move: 0, aim: 'selected', hook: null }, { action: 1, move: 1, aim: 'facing', hook: null },
    { action: 2, move: 2, aim: 'facing', hook: 3 }],
  continuation: { encoding: 'object', fields: [
    { key: 'cooldown', source: 'primary', min: 0 }, { key: 'gustCooldown', source: 'secondary', min: 0 },
  ] },
} as const;
