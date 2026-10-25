import * as schema from 'valibot';

/** Native held models, view tables and ABI-v1 decision references. */
const finite = schema.pipe(schema.number(), schema.finite()), triple = schema.tuple([finite, finite, finite]);
const cue = schema.custom<`cue.${string}`>(value => typeof value === 'string' && /^cue\.[a-z][a-zA-Z0-9.-]*$/u.test(value));
const pose = schema.strictObject({ pos: triple, q: schema.tuple([finite, finite, finite, finite]) });
export const PolearmPresentationSchema: schema.GenericSchema<PolearmPresentationInput, PolearmPresentation>=schema.strictObject({parts:schema.strictObject({leftArm:schema.string(),rightArm:schema.string(),body:schema.string(),metal:schema.string(),fist:schema.string(),projectile:schema.string(),projectileMetal:schema.string(),world:schema.string()}),materials:schema.strictObject({rim:finite,bands:finite,metalness:finite,roughness:finite,environment:finite,worldRim:finite}),arc:schema.strictObject({color:finite,size:finite})});
export const PolearmRowsSchema: schema.GenericSchema<PolearmRowsInput, PolearmRows> = schema.strictObject({ pool: schema.strictObject({ url: schema.string(), parts: schema.array(schema.string()) }),
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
export const BladeRowsSchema: schema.GenericSchema<BladeRowsInput, BladeRows> = schema.strictObject({ pool: schema.strictObject({ url: schema.string(), parts: schema.array(schema.string()) }),
  program:schema.unknown(),power:schema.unknown(),parts:schema.strictObject({body:schema.string(),arms:schema.string(),metal:schema.string()}),
  blade: schema.strictObject({ length: finite, curve: finite }), rig: schema.strictObject({ tipY: finite, baseY: finite, tipX: finite }),
  moves: schema.strictObject({ rest: bladePose, charge: bladePose, sprint: bladePose, combo: schema.array(bladeMove), heavy: bladeMove, passes: schema.strictObject({ left: bladeMove, right: bladeMove }) }) });

export const ArcWeaponRowsSchema: schema.GenericSchema<ArcWeaponRowsInput, ArcWeaponRows>=schema.strictObject({program:schema.unknown(),item:schema.custom<`weapon.${string}`>(value=>typeof value==='string'&&/^weapon\.[a-z][a-zA-Z0-9.-]*$/u.test(value)),name:schema.string(),blue:triple,glow:triple,powers:schema.strictObject({crescentRange:finite,crescentDamage:finite,crescentTime:finite,arcRadius:finite,gallopMin:finite,callRange:finite,callDamage:finite,callRadius:finite,callTime:finite,stormMultiplier:finite,stormArcs:finite,clearArcs:finite,crescentWidth:finite})});






/** Admitted data contracts, independent of validator implementation metadata. */
export type PolearmPresentationInput = PolearmPresentation;
interface PolearmPresentationFields {
    parts: {
        leftArm: string;
        rightArm: string;
        body: string;
        metal: string;
        fist: string;
        projectile: string;
        projectileMetal: string;
        world: string;
    };
    materials: {
        rim: number;
        bands: number;
        metalness: number;
        roughness: number;
        environment: number;
        worldRim: number;
    };
    arc: {
        color: number;
        size: number;
    };
}
export type PolearmPresentation = { [Key in keyof PolearmPresentationFields]: PolearmPresentationFields[Key] };
interface PolearmRowsInputFields {
    pool: {
        url: string;
        parts: (string)[];
    };
    profile: {
        damage: number;
        reach: number;
        thrust: {
            damage: number;
            stagger: number;
            windup: number;
            activeEnd: number;
            total: number;
            fan: {
                yaws: (number)[];
                pitches: (number)[];
            };
        };
        lance: {
            reach: number;
            cone: number;
            minSpeed: number;
            baseDamage: number;
            speedDamage: number;
            rehit: number;
        };
        hitStop: {
            body: number;
            head: number;
            kill: number;
        };
        cues: {
            fire: `cue.${string}`;
            reload: `cue.${string}`;
            impact: `cue.${string}`;
            hit: `cue.${string}`;
            charge: {
                throw: `cue.${string}`;
                recover: `cue.${string}`;
            };
        };
        feel: {
            lag: {
                gain: number;
                clampYaw: number;
                clampPitch: number;
                k: number;
                c: number;
                posYaw: number;
                posPitch: number;
            };
            bob: {
                x: number;
                y: number;
                rx: number;
                rz: number;
            };
            sway: {
                ax: number;
                fx: number;
                ay: number;
                fy: number;
            };
            fovHip: number;
        };
    };
    program: unknown;
    presentation: PolearmPresentationInput;
    view: {
        poses: {
            rest: {
                pos: [
                    number,
                    number,
                    number
                ];
                q: [
                    number,
                    number,
                    number,
                    number
                ];
            };
            cock: {
                pos: [
                    number,
                    number,
                    number
                ];
                q: [
                    number,
                    number,
                    number,
                    number
                ];
            };
            jab: {
                pos: [
                    number,
                    number,
                    number
                ];
                q: [
                    number,
                    number,
                    number,
                    number
                ];
            };
            leftLow: {
                pos: [
                    number,
                    number,
                    number
                ];
                q: [
                    number,
                    number,
                    number,
                    number
                ];
            };
            sprint: {
                pos: [
                    number,
                    number,
                    number
                ];
                q: [
                    number,
                    number,
                    number,
                    number
                ];
            };
            lance: {
                pos: [
                    number,
                    number,
                    number
                ];
                q: [
                    number,
                    number,
                    number,
                    number
                ];
            };
            javCock: {
                pos: [
                    number,
                    number,
                    number
                ];
                q: [
                    number,
                    number,
                    number,
                    number
                ];
            };
            javOut: {
                pos: [
                    number,
                    number,
                    number
                ];
                q: [
                    number,
                    number,
                    number,
                    number
                ];
            };
        };
        elbows: {
            left: [
                number,
                number,
                number
            ];
            right: [
                number,
                number,
                number
            ];
        };
        wrists: {
            left: [
                number,
                number,
                number
            ];
            right: [
                number,
                number,
                number
            ];
        };
        javelinGrip: number;
        tapMax: number;
    };
}
export type PolearmRowsInput = { [Key in keyof PolearmRowsInputFields]: PolearmRowsInputFields[Key] };
interface PolearmRowsFields {
    pool: {
        url: string;
        parts: (string)[];
    };
    profile: {
        damage: number;
        reach: number;
        thrust: {
            damage: number;
            stagger: number;
            windup: number;
            activeEnd: number;
            total: number;
            fan: {
                yaws: (number)[];
                pitches: (number)[];
            };
        };
        lance: {
            reach: number;
            cone: number;
            minSpeed: number;
            baseDamage: number;
            speedDamage: number;
            rehit: number;
        };
        hitStop: {
            body: number;
            head: number;
            kill: number;
        };
        cues: {
            fire: `cue.${string}`;
            reload: `cue.${string}`;
            impact: `cue.${string}`;
            hit: `cue.${string}`;
            charge: {
                throw: `cue.${string}`;
                recover: `cue.${string}`;
            };
        };
        feel: {
            lag: {
                gain: number;
                clampYaw: number;
                clampPitch: number;
                k: number;
                c: number;
                posYaw: number;
                posPitch: number;
            };
            bob: {
                x: number;
                y: number;
                rx: number;
                rz: number;
            };
            sway: {
                ax: number;
                fx: number;
                ay: number;
                fy: number;
            };
            fovHip: number;
        };
    };
    program: unknown;
    presentation: PolearmPresentation;
    view: {
        poses: {
            rest: {
                pos: [
                    number,
                    number,
                    number
                ];
                q: [
                    number,
                    number,
                    number,
                    number
                ];
            };
            cock: {
                pos: [
                    number,
                    number,
                    number
                ];
                q: [
                    number,
                    number,
                    number,
                    number
                ];
            };
            jab: {
                pos: [
                    number,
                    number,
                    number
                ];
                q: [
                    number,
                    number,
                    number,
                    number
                ];
            };
            leftLow: {
                pos: [
                    number,
                    number,
                    number
                ];
                q: [
                    number,
                    number,
                    number,
                    number
                ];
            };
            sprint: {
                pos: [
                    number,
                    number,
                    number
                ];
                q: [
                    number,
                    number,
                    number,
                    number
                ];
            };
            lance: {
                pos: [
                    number,
                    number,
                    number
                ];
                q: [
                    number,
                    number,
                    number,
                    number
                ];
            };
            javCock: {
                pos: [
                    number,
                    number,
                    number
                ];
                q: [
                    number,
                    number,
                    number,
                    number
                ];
            };
            javOut: {
                pos: [
                    number,
                    number,
                    number
                ];
                q: [
                    number,
                    number,
                    number,
                    number
                ];
            };
        };
        elbows: {
            left: [
                number,
                number,
                number
            ];
            right: [
                number,
                number,
                number
            ];
        };
        wrists: {
            left: [
                number,
                number,
                number
            ];
            right: [
                number,
                number,
                number
            ];
        };
        javelinGrip: number;
        tapMax: number;
    };
}
export type PolearmRows = { [Key in keyof PolearmRowsFields]: PolearmRowsFields[Key] };
export type BladeRowsInput = BladeRows;
interface BladeRowsFields {
    pool: {
        url: string;
        parts: (string)[];
    };
    program: unknown;
    power: unknown;
    parts: {
        body: string;
        arms: string;
        metal: string;
    };
    blade: {
        length: number;
        curve: number;
    };
    rig: {
        tipY: number;
        baseY: number;
        tipX: number;
    };
    moves: {
        rest: {
            t: number;
            pos: [
                number,
                number,
                number
            ];
            q: [
                number,
                number,
                number,
                number
            ];
        };
        charge: {
            t: number;
            pos: [
                number,
                number,
                number
            ];
            q: [
                number,
                number,
                number,
                number
            ];
        };
        sprint: {
            t: number;
            pos: [
                number,
                number,
                number
            ];
            q: [
                number,
                number,
                number,
                number
            ];
        };
        combo: ({
            name: 'slash' | 'backhand' | 'finisher' | 'heavy' | 'pass-left' | 'pass-right';
            keys: [
                {
                    t: number;
                    pos: [
                        number,
                        number,
                        number
                    ];
                    q: [
                        number,
                        number,
                        number,
                        number
                    ];
                },
                {
                    t: number;
                    pos: [
                        number,
                        number,
                        number
                    ];
                    q: [
                        number,
                        number,
                        number,
                        number
                    ];
                },
                {
                    t: number;
                    pos: [
                        number,
                        number,
                        number
                    ];
                    q: [
                        number,
                        number,
                        number,
                        number
                    ];
                }
            ];
            damage: number;
            hitStop: number;
            windup: number;
            slashEnd: number;
            total: number;
            stagger: number;
            sweep: number;
            reach?: number;
            kick: {
                pitch: number;
                roll: number;
                fov?: number;
            };
            trail: {
                alpha: number;
                color: [
                    number,
                    number,
                    number
                ];
                from: number;
                inner: number;
                life: number;
            };
        })[];
        heavy: {
            name: 'slash' | 'backhand' | 'finisher' | 'heavy' | 'pass-left' | 'pass-right';
            keys: [
                {
                    t: number;
                    pos: [
                        number,
                        number,
                        number
                    ];
                    q: [
                        number,
                        number,
                        number,
                        number
                    ];
                },
                {
                    t: number;
                    pos: [
                        number,
                        number,
                        number
                    ];
                    q: [
                        number,
                        number,
                        number,
                        number
                    ];
                },
                {
                    t: number;
                    pos: [
                        number,
                        number,
                        number
                    ];
                    q: [
                        number,
                        number,
                        number,
                        number
                    ];
                }
            ];
            damage: number;
            hitStop: number;
            windup: number;
            slashEnd: number;
            total: number;
            stagger: number;
            sweep: number;
            reach?: number;
            kick: {
                pitch: number;
                roll: number;
                fov?: number;
            };
            trail: {
                alpha: number;
                color: [
                    number,
                    number,
                    number
                ];
                from: number;
                inner: number;
                life: number;
            };
        };
        passes: {
            left: {
                name: 'slash' | 'backhand' | 'finisher' | 'heavy' | 'pass-left' | 'pass-right';
                keys: [
                    {
                        t: number;
                        pos: [
                            number,
                            number,
                            number
                        ];
                        q: [
                            number,
                            number,
                            number,
                            number
                        ];
                    },
                    {
                        t: number;
                        pos: [
                            number,
                            number,
                            number
                        ];
                        q: [
                            number,
                            number,
                            number,
                            number
                        ];
                    },
                    {
                        t: number;
                        pos: [
                            number,
                            number,
                            number
                        ];
                        q: [
                            number,
                            number,
                            number,
                            number
                        ];
                    }
                ];
                damage: number;
                hitStop: number;
                windup: number;
                slashEnd: number;
                total: number;
                stagger: number;
                sweep: number;
                reach?: number;
                kick: {
                    pitch: number;
                    roll: number;
                    fov?: number;
                };
                trail: {
                    alpha: number;
                    color: [
                        number,
                        number,
                        number
                    ];
                    from: number;
                    inner: number;
                    life: number;
                };
            };
            right: {
                name: 'slash' | 'backhand' | 'finisher' | 'heavy' | 'pass-left' | 'pass-right';
                keys: [
                    {
                        t: number;
                        pos: [
                            number,
                            number,
                            number
                        ];
                        q: [
                            number,
                            number,
                            number,
                            number
                        ];
                    },
                    {
                        t: number;
                        pos: [
                            number,
                            number,
                            number
                        ];
                        q: [
                            number,
                            number,
                            number,
                            number
                        ];
                    },
                    {
                        t: number;
                        pos: [
                            number,
                            number,
                            number
                        ];
                        q: [
                            number,
                            number,
                            number,
                            number
                        ];
                    }
                ];
                damage: number;
                hitStop: number;
                windup: number;
                slashEnd: number;
                total: number;
                stagger: number;
                sweep: number;
                reach?: number;
                kick: {
                    pitch: number;
                    roll: number;
                    fov?: number;
                };
                trail: {
                    alpha: number;
                    color: [
                        number,
                        number,
                        number
                    ];
                    from: number;
                    inner: number;
                    life: number;
                };
            };
        };
    };
}
export type BladeRows = { [Key in keyof BladeRowsFields]: BladeRowsFields[Key] };
export type ArcWeaponRowsInput = ArcWeaponRows;
interface ArcWeaponRowsFields {
    program: unknown;
    item: `weapon.${string}`;
    name: string;
    blue: [
        number,
        number,
        number
    ];
    glow: [
        number,
        number,
        number
    ];
    powers: {
        crescentRange: number;
        crescentDamage: number;
        crescentTime: number;
        arcRadius: number;
        gallopMin: number;
        callRange: number;
        callDamage: number;
        callRadius: number;
        callTime: number;
        stormMultiplier: number;
        stormArcs: number;
        clearArcs: number;
        crescentWidth: number;
    };
}
export type ArcWeaponRows = { [Key in keyof ArcWeaponRowsFields]: ArcWeaponRowsFields[Key] };
