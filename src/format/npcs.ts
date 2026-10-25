import * as v from 'valibot';

const npcRowName = v.pipe(v.string(), v.minLength(1), v.maxLength(96));
const text = v.pipe(v.string(), v.minLength(1), v.maxLength(400));
const names = v.pipe(v.array(npcRowName), v.maxLength(64));
const npcRowFinite = v.pipe(v.number(), v.finite());
const positive = v.pipe(npcRowFinite, v.minValue(0));
const npcRowPoint = v.strictObject({ x: npcRowFinite, z: npcRowFinite });
const vec3 = v.tuple([npcRowFinite, npcRowFinite, npcRowFinite]);
const condition = v.strictObject({ all: v.exactOptional(names), any: v.exactOptional(names), none: v.exactOptional(names) });


/** Dialogue data independent of its rendered body. Skinned stand-in NPCs keep their own figure installer. */
const dialogue: v.StrictObjectSchema<{ readonly id: v.GenericSchema<NpcDialogueRowInput['id'], NpcDialogueRow['id']>; readonly name: v.GenericSchema<NpcDialogueRowInput['name'], NpcDialogueRow['name']>; readonly dialogue: v.GenericSchema<NpcDialogueRowInput['dialogue'], NpcDialogueRow['dialogue']>; }, undefined> = v.strictObject({ id: npcRowName, name: text,
  dialogue: v.pipe(v.array(v.strictObject({ when: v.exactOptional(condition), lines: v.pipe(v.array(text), v.minLength(1), v.maxLength(16)), sets: v.exactOptional(names) })), v.minLength(1), v.maxLength(16)),
});
/** Validated dialogue row; directly consumed by both the page and native NpcDialogue. */

/** Strict dialogue admission with a bounded named output contract. */
export const NpcDialogueRowSchema: v.GenericSchema<v.InferInput<typeof dialogue>, NpcDialogueRow> = dialogue;
/** Page talks borrow declared catalogue or resident figures; completions select named mechanics only. */
export const QuestPageTalksSchema: v.GenericSchema<QuestPageTalksRowsInput, QuestPageTalksRows> = v.strictObject({
  models: v.pipe(v.array(v.variant('source', [
    v.strictObject({ source: v.literal('catalogue'), id: npcRowName, library: text,
      bark: v.strictObject({ audio: npcRowName, group: npcRowName }) }),
    v.strictObject({ source: v.literal('entered'), id: npcRowName, approach: npcRowName, swap: v.boolean(), stow: v.boolean() }),
  ])), v.maxLength(64)),
  calls: v.pipe(v.record(npcRowName, v.variant('kind', [
    v.strictObject({ kind: v.literal('trader'), trader: text }),
    v.strictObject({ kind: v.literal('talk'), target: npcRowName,
      after: v.exactOptional(v.strictObject({ flag: npcRowName, service: npcRowName })) }),
  ])), v.maxEntries(64)),
  steps: v.exactOptional(v.unknown()),
});

/** Validate the dialogue without inventing pivot-figure fields for a skinned NPC. */
export function parseNpcDialogueRow(input: unknown): NpcDialogueRow { return v.parse(NpcDialogueRowSchema, input); }

/** One pivot's turn (radians): `base` plus `swing`·sin(`hz`·t), only the sine's positive half when marked 'half'. */
const npcSwing = v.union([v.tuple([npcRowFinite, npcRowFinite, positive]), v.tuple([npcRowFinite, npcRowFinite, positive, v.literal('half')])]);
/** A pose: the arm's `lift` (the shoulder about z), `forward` (the shoulder about x) and the forearm's `bend` (the elbow about z). */
const npcPose = v.strictObject({ lift: npcSwing, forward: npcSwing, bend: npcSwing });
/**
 * How a pivot NPC moves: whether it `turns` to face the player (within its face range or while it talks; else back to
 * its home facing); whether it waves only until it is met; its arm's easing rate (per second); its breath (a yaw sway
 * and a vertical swell, [amplitude, hz]); and its arm's pose at rest, waving (the player within its wave range) and
 * talking.
 */
const motion: v.GenericSchema<NpcMotionInput, NpcMotion> = v.strictObject({ turns: v.boolean(), waveUntilMet: v.boolean(), ease: positive,
  breathe: v.strictObject({ yaw: v.tuple([npcRowFinite, positive]), scale: v.tuple([npcRowFinite, positive]) }),
  rest: npcPose, wave: npcPose, talk: npcPose });
/** A validated pivot NPC motion row. */


/** Strict pivot-motion admission; native interpolation stays with the runtime owner. */
export const NpcMotionSchema: v.GenericSchema<v.InferInput<typeof motion>, NpcMotion> = motion;

/**
 * A quest-giver NPC as a declared row (SHARD-PLATFORM SF27, the pivot-NPC row): who it is, where it stands and what it
 * says, and how its figure moves. The figure is one generated model split onto pivots (not skinned): the head turns at
 * the neck, one arm swings at the shoulder; it faces `faceHome` until the player comes within `faceRange`, waves within
 * `waveRange` until its `metFlag` is raised, and gestures while it talks. Its talk prompt (`spot`, the interaction rows'
 * named spot) stands `talkHeight` over its feet and reaches `talkRadius` from the player's eye. Its first matching
 * dialogue entry is what it says (the engine's NpcDef order).
 */
const row: v.GenericSchema<NpcRowInput, NpcRow> = v.strictObject({
  id: npcRowName, name: text, spot: npcRowName, at: npcRowPoint, faceHome: npcRowPoint, metFlag: npcRowName,
  talkHeight: positive, talkRadius: positive, faceRange: positive, waveRange: positive,
  /** the solid column round it (`half` m square, from `below` under its feet to `above` over them); none: it is not solid */
  collider: v.exactOptional(v.strictObject({ half: positive, below: positive, above: positive, surface: v.picklist(['flesh', 'wood', 'metal', 'felt', 'shell', 'earth']) })),
  /**
   * The figure: the model id, fitted to `height` m with its feet on y 0 facing +Z (centred on its footing when `centre`
   * is 'base'); the head is every triangle at or over the neck (no neck: no head pivot); the arm, the triangles with x
   * under `armBelowX + armSlope·y` and y over `armAboveY`, under `armTopY` (else the neck + 0.02); with an `elbow`, the
   * arm's triangles past the plane through `elbow.at` square to `elbow.axis` (x-y) are the forearm on the elbow pivot;
   * the vertex-coloured material's roughness and flat shading (a flat figure's normals are recomputed).
   */
  figure: v.strictObject({ model: npcRowName, height: positive, neck: v.exactOptional(vec3), shoulder: vec3, armBelowX: npcRowFinite, armAboveY: npcRowFinite,
    armSlope: v.exactOptional(npcRowFinite), armTopY: v.exactOptional(npcRowFinite), centre: v.exactOptional(v.picklist(['base'])),
    elbow: v.exactOptional(v.strictObject({ at: vec3, axis: v.tuple([npcRowFinite, npcRowFinite]) })),
    roughness: v.pipe(npcRowFinite, v.minValue(0), v.maxValue(1)), flat: v.boolean() }),
  /** how the figure moves (`NpcMotionSchema`); none: `PIVOT_NPC_MOTION` (plugin/geometry) */
  motion: v.exactOptional(motion),
  dialogue: dialogue.entries.dialogue,
});
/** A validated quest-giver NPC row (`NpcRowSchema`). */

/** Strict quest-giver admission with named input/output seams independent of runtime figures. */
export const NpcRowSchema: v.GenericSchema<v.InferInput<typeof row>, NpcRow> = row;
/** Compile an authored NPC row; an unknown field or an empty dialogue refuses. */
export function parseNpcRow(input: unknown): NpcRow { return v.parse(NpcRowSchema, input); }

const questBinding: v.GenericSchema<QuestNpcBindingInput, QuestNpcBinding> = v.strictObject({
  npc: NpcRowSchema, label: text, system: npcRowName, sourceFile: text,
  ground: v.strictObject({ height: npcRowFinite, at: v.nullable(npcRowPoint), error: text }),
  met: v.picklist(['flag', 'unmet']), missing: v.picklist(['omit', 'anchor']), update: v.picklist(['loaded', 'always']),
});
/** Serialisable NPC placement, prompt and lifecycle policy; geometry and its look remain borrowed resources. */

/** Strict NPC binding admission with bounded lifecycle choices and finite authored ground. */
export const QuestNpcBindingSchema: v.GenericSchema<v.InferInput<typeof questBinding>, QuestNpcBinding> = questBinding;
/** Admit the quest NPC's policy before constructing a figure or registering any system or collider. */
export function parseQuestNpcBinding(input: unknown): QuestNpcBinding { return v.parse(QuestNpcBindingSchema, input); }

const posedTalkBinding: v.GenericSchema<QuestNpcTalkBindingInput, QuestNpcTalkBinding> = v.pipe(v.strictObject({
  kind: v.literal('posed-talk'), npc: NpcDialogueRowSchema, figure: npcRowName,
  at: v.exactOptional(npcRowPoint), yaw: v.exactOptional(npcRowFinite),
  install: v.pipe(v.strictObject({ id: npcRowName, label: text,
    radius: v.pipe(npcRowFinite, v.minValue(Number.MIN_VALUE), v.maxValue(1000)), file: text,
    copyPrompt: v.boolean(), updateOrder: v.picklist(['figure-first', 'talk-first']),
    bark: v.exactOptional(v.strictObject({ enter: positive, leave: positive })),
    approach: v.exactOptional(v.strictObject({ radius: v.pipe(npcRowFinite, v.minValue(Number.MIN_VALUE), v.maxValue(1000)), unlessFlag: npcRowName })),
  }), v.check(policy => !policy.file.startsWith('/') && !policy.file.split('/').includes('..') &&
    (policy.bark === undefined || policy.bark.enter > 0 && policy.bark.leave > policy.bark.enter && policy.bark.leave <= 1000))),
  prompt: v.exactOptional(v.strictObject({ at: npcRowPoint, height: npcRowFinite })),
  done: v.exactOptional(v.strictObject({ call: npcRowName, when: v.exactOptional(condition) })),
}), v.check(binding => (binding.at === undefined) === (binding.yaw === undefined), 'An authored figure placement needs both position and yaw'));
/** A posed figure keeps its existing model and motion; the root declares its talk and placement. */


const questBindings = v.pipe(v.array(v.union([QuestNpcBindingSchema, posedTalkBinding])), v.maxLength(64),
  v.check(rows => ['id', 'spot', 'system'].every(key => {
    const values = rows.flatMap(binding => 'kind' in binding
      ? key === 'system' ? [] : [key === 'spot' ? binding.install.id : binding.npc.id]
      : [key === 'system' ? binding.system : key === 'spot' ? binding.npc.spot : binding.npc.id]);
    return new Set(values).size === values.length;
  }), 'Quest NPC identities, talk spots and update systems must be unique'));
/** Bounded native NPC placements; each row owns one identity, talk spot and update system. */
export const QuestNpcBindingsSchema: v.GenericSchema<unknown, (QuestNpcBinding | QuestNpcTalkBinding)[]> = questBindings;

/** Root NPC rows require their native quest owner and declared dialogue/met flags. */
export function questNpcBindingRules(rows: readonly (QuestNpcBinding | QuestNpcTalkBinding)[], flags: readonly string[], owned: boolean): string[] {
  if (rows.length === 0) return [];
  const errors: string[] = [], declared = new Set(flags);
  if (!owned) errors.push('quest NPCs require runtime.binds quests');
  for (const binding of rows) {
    const referenced = binding.npc.dialogue.flatMap(entry => [...entry.when?.all ?? [], ...entry.when?.any ?? [], ...entry.when?.none ?? [], ...entry.sets ?? []]);
    if ('kind' in binding) {
      referenced.push(...binding.done?.when?.all ?? [], ...binding.done?.when?.any ?? [], ...binding.done?.when?.none ?? []);
      if (binding.install.approach !== undefined) referenced.push(binding.install.approach.unlessFlag);
    }
    else if (binding.met === 'flag') referenced.push(binding.npc.metFlag);
    for (const flag of referenced) if (!declared.has(flag)) errors.push(`undeclared quest NPC flag ${flag}`);
  }
  return errors;
}


/** Admitted data contracts, independent of validator implementation metadata. */
export type NpcDialogueRowInput = NpcDialogueRow;
export interface NpcDialogueRow {
    id: string;
    name: string;
    dialogue: ({
        when?: {
            all?: (string)[];
            any?: (string)[];
            none?: (string)[];
        };
        lines: (string)[];
        sets?: (string)[];
    })[];
}
export type QuestPageTalksRowsInput = QuestPageTalksRows;
export interface QuestPageTalksRows {
    models: (({
        source: 'catalogue';
        id: string;
        library: string;
        bark: {
            audio: string;
            group: string;
        };
    }) | ({
        source: 'entered';
        id: string;
        approach: string;
        swap: boolean;
        stow: boolean;
    }))[];
    calls: Record<string, ({
        kind: 'trader';
        trader: string;
    }) | ({
        kind: 'talk';
        target: string;
        after?: {
            flag: string;
            service: string;
        };
    })>;
    steps?: unknown;
}
export type NpcMotionInput = NpcMotion;
export interface NpcMotion {
    turns: boolean;
    waveUntilMet: boolean;
    ease: number;
    breathe: {
        yaw: [
            number,
            number
        ];
        scale: [
            number,
            number
        ];
    };
    rest: {
        lift: ([
            number,
            number,
            number
        ]) | ([
            number,
            number,
            number,
            'half'
        ]);
        forward: ([
            number,
            number,
            number
        ]) | ([
            number,
            number,
            number,
            'half'
        ]);
        bend: ([
            number,
            number,
            number
        ]) | ([
            number,
            number,
            number,
            'half'
        ]);
    };
    wave: {
        lift: ([
            number,
            number,
            number
        ]) | ([
            number,
            number,
            number,
            'half'
        ]);
        forward: ([
            number,
            number,
            number
        ]) | ([
            number,
            number,
            number,
            'half'
        ]);
        bend: ([
            number,
            number,
            number
        ]) | ([
            number,
            number,
            number,
            'half'
        ]);
    };
    talk: {
        lift: ([
            number,
            number,
            number
        ]) | ([
            number,
            number,
            number,
            'half'
        ]);
        forward: ([
            number,
            number,
            number
        ]) | ([
            number,
            number,
            number,
            'half'
        ]);
        bend: ([
            number,
            number,
            number
        ]) | ([
            number,
            number,
            number,
            'half'
        ]);
    };
}
export interface NpcRowInput {
    id: string;
    name: string;
    spot: string;
    at: {
        x: number;
        z: number;
    };
    faceHome: {
        x: number;
        z: number;
    };
    metFlag: string;
    talkHeight: number;
    talkRadius: number;
    faceRange: number;
    waveRange: number;
    collider?: {
        half: number;
        below: number;
        above: number;
        surface: 'flesh' | 'wood' | 'metal' | 'felt' | 'shell' | 'earth';
    };
    figure: {
        model: string;
        height: number;
        neck?: [
            number,
            number,
            number
        ];
        shoulder: [
            number,
            number,
            number
        ];
        armBelowX: number;
        armAboveY: number;
        armSlope?: number;
        armTopY?: number;
        centre?: 'base';
        elbow?: {
            at: [
                number,
                number,
                number
            ];
            axis: [
                number,
                number
            ];
        };
        roughness: number;
        flat: boolean;
    };
    motion?: NpcMotionInput;
    dialogue: v.InferInput<(typeof dialogue)['entries']['dialogue']>;
}
export interface NpcRow {
    id: string;
    name: string;
    spot: string;
    at: {
        x: number;
        z: number;
    };
    faceHome: {
        x: number;
        z: number;
    };
    metFlag: string;
    talkHeight: number;
    talkRadius: number;
    faceRange: number;
    waveRange: number;
    collider?: {
        half: number;
        below: number;
        above: number;
        surface: 'flesh' | 'wood' | 'metal' | 'felt' | 'shell' | 'earth';
    };
    figure: {
        model: string;
        height: number;
        neck?: [
            number,
            number,
            number
        ];
        shoulder: [
            number,
            number,
            number
        ];
        armBelowX: number;
        armAboveY: number;
        armSlope?: number;
        armTopY?: number;
        centre?: 'base';
        elbow?: {
            at: [
                number,
                number,
                number
            ];
            axis: [
                number,
                number
            ];
        };
        roughness: number;
        flat: boolean;
    };
    motion?: NpcMotion;
    dialogue: v.InferOutput<(typeof dialogue)['entries']['dialogue']>;
}
export interface QuestNpcBindingInput {
    npc: NpcRowInput;
    label: string;
    system: string;
    sourceFile: string;
    ground: {
        height: number;
        at: ({
            x: number;
            z: number;
        }) | null;
        error: string;
    };
    met: 'flag' | 'unmet';
    missing: 'omit' | 'anchor';
    update: 'loaded' | 'always';
}
export interface QuestNpcBinding {
    npc: NpcRow;
    label: string;
    system: string;
    sourceFile: string;
    ground: {
        height: number;
        at: ({
            x: number;
            z: number;
        }) | null;
        error: string;
    };
    met: 'flag' | 'unmet';
    missing: 'omit' | 'anchor';
    update: 'loaded' | 'always';
}
export interface QuestNpcTalkBindingInput {
    kind: 'posed-talk';
    npc: NpcDialogueRowInput;
    figure: string;
    at?: {
        x: number;
        z: number;
    };
    yaw?: number;
    install: {
        id: string;
        label: string;
        radius: number;
        file: string;
        copyPrompt: boolean;
        updateOrder: 'figure-first' | 'talk-first';
        bark?: {
            enter: number;
            leave: number;
        };
        approach?: {
            radius: number;
            unlessFlag: string;
        };
    };
    prompt?: {
        at: {
            x: number;
            z: number;
        };
        height: number;
    };
    done?: {
        call: string;
        when?: {
            all?: (string)[];
            any?: (string)[];
            none?: (string)[];
        };
    };
}
export interface QuestNpcTalkBinding {
    kind: 'posed-talk';
    npc: NpcDialogueRow;
    figure: string;
    at?: {
        x: number;
        z: number;
    };
    yaw?: number;
    install: {
        id: string;
        label: string;
        radius: number;
        file: string;
        copyPrompt: boolean;
        updateOrder: 'figure-first' | 'talk-first';
        bark?: {
            enter: number;
            leave: number;
        };
        approach?: {
            radius: number;
            unlessFlag: string;
        };
    };
    prompt?: {
        at: {
            x: number;
            z: number;
        };
        height: number;
    };
    done?: {
        call: string;
        when?: {
            all?: (string)[];
            any?: (string)[];
            none?: (string)[];
        };
    };
}
