import * as schema from 'valibot';

/** Native held models, view tables and ABI-v1 decision references. */
const finite = schema.pipe(schema.number(), schema.finite()), triple = schema.tuple([finite, finite, finite]);
const cue = schema.custom<`cue.${string}`>(value => typeof value === 'string' && /^cue\.[a-z][a-zA-Z0-9.-]*$/u.test(value));
const pose = schema.strictObject({ pos: triple, q: schema.tuple([finite, finite, finite, finite]) });
export const PolearmPresentationSchema=schema.strictObject({parts:schema.strictObject({leftArm:schema.string(),rightArm:schema.string(),body:schema.string(),metal:schema.string(),fist:schema.string(),projectile:schema.string(),projectileMetal:schema.string(),world:schema.string()}),materials:schema.strictObject({rim:finite,bands:finite,metalness:finite,roughness:finite,environment:finite,worldRim:finite}),arc:schema.strictObject({color:finite,size:finite})});
export const PolearmRowsSchema = schema.strictObject({ pool: schema.strictObject({ url: schema.string(), parts: schema.array(schema.string()) }),
  profile: schema.strictObject({ damage: finite, reach: finite,
    thrust: schema.strictObject({ damage: finite, stagger: finite, windup: finite, activeEnd: finite, total: finite,
      fan: schema.strictObject({ yaws: schema.array(finite), pitches: schema.array(finite) }) }),
    lance: schema.strictObject({ reach: finite, cone: finite, minSpeed: finite, baseDamage: finite, speedDamage: finite, rehit: finite }),
    hitStop: schema.strictObject({ body: finite, head: finite, kill: finite }),
    cues: schema.strictObject({ fire: cue, reload: cue, impact: cue, hit: cue,
      charge: schema.strictObject({ throw: cue, recover: cue }) }),
    feel: schema.strictObject({ lag: schema.strictObject({ gain: finite, clampYaw: finite, clampPitch: finite, k: finite, c: finite, posYaw: finite, posPitch: finite }),
      bob: schema.strictObject({ x: finite, y: finite, rx: finite, rz: finite }), sway: schema.strictObject({ ax: finite, fx: finite, ay: finite, fy: finite }), fovHip: finite }) }),
  program:schema.unknown(),presentation:PolearmPresentationSchema,
  view: schema.strictObject({ poses: schema.strictObject({ rest: pose, cock: pose, jab: pose, leftLow: pose, sprint: pose, lance: pose, javCock: pose, javOut: pose }),
    elbows: schema.strictObject({ left: triple, right: triple }), wrists: schema.strictObject({ left: triple, right: triple }), javelinGrip: finite, tapMax: finite }) });


const bladePose = schema.strictObject({ t: finite, pos: triple, q: schema.tuple([finite, finite, finite, finite]) });
const bladeMove = schema.strictObject({ name: schema.picklist(['slash', 'backhand', 'finisher', 'heavy', 'pass-left', 'pass-right']), keys: schema.tuple([bladePose, bladePose, bladePose]),
  damage: finite, hitStop: finite, windup: finite, slashEnd: finite, total: finite, stagger: finite, sweep: finite, reach: schema.exactOptional(finite),
  kick: schema.strictObject({ pitch: finite, roll: finite, fov: schema.exactOptional(finite) }),
  trail: schema.strictObject({ alpha: finite, color: triple, from: finite, inner: finite, life: finite }) });
export const BladeRowsSchema = schema.strictObject({ pool: schema.strictObject({ url: schema.string(), parts: schema.array(schema.string()) }),
  program:schema.unknown(),power:schema.unknown(),parts:schema.strictObject({body:schema.string(),arms:schema.string(),metal:schema.string()}),
  blade: schema.strictObject({ length: finite, curve: finite }), rig: schema.strictObject({ tipY: finite, baseY: finite, tipX: finite }),
  moves: schema.strictObject({ rest: bladePose, charge: bladePose, sprint: bladePose, combo: schema.array(bladeMove), heavy: bladeMove, passes: schema.strictObject({ left: bladeMove, right: bladeMove }) }) });

export const ArcWeaponRowsSchema=schema.strictObject({program:schema.unknown(),item:schema.custom<`weapon.${string}`>(value=>typeof value==='string'&&/^weapon\.[a-z][a-zA-Z0-9.-]*$/u.test(value)),name:schema.string(),blue:triple,glow:triple,powers:schema.strictObject({crescentRange:finite,crescentDamage:finite,crescentTime:finite,arcRadius:finite,gallopMin:finite,callRange:finite,callDamage:finite,callRadius:finite,callTime:finite,stormMultiplier:finite,stormArcs:finite,clearArcs:finite,crescentWidth:finite})});

export type PolearmRows=schema.InferOutput<typeof PolearmRowsSchema>;
export type PolearmPresentation=schema.InferOutput<typeof PolearmPresentationSchema>;
export type BladeRows=schema.InferOutput<typeof BladeRowsSchema>;
export type ArcWeaponRows=schema.InferOutput<typeof ArcWeaponRowsSchema>;
