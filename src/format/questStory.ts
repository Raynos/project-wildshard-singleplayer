import * as v from 'valibot';
import { ObservationRefSchema } from './sceneRefs';
import { QuestEffectSchema } from './questSteps';
import { isJsonData } from './json';

const text = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const finite = v.pipe(v.number(), v.finite());
const positive = v.pipe(finite, v.minValue(0));
// Live markers and discovery name authored frames; readers admit their owners.
const at: v.StrictObjectSchema<{ readonly poi: v.GenericSchema<AdventurePlaceAtInput['poi'], AdventurePlaceAt['poi']>; readonly x: v.GenericSchema<AdventurePlaceAtInput['x'], AdventurePlaceAt['x']>; readonly z: v.GenericSchema<AdventurePlaceAtInput['z'], AdventurePlaceAt['z']>; readonly anchor: v.ExactOptionalSchema<v.GenericSchema<Exclude<AdventurePlaceAtInput['anchor'], undefined>, Exclude<AdventurePlaceAt['anchor'], undefined>>, undefined>; }, undefined> = v.strictObject({ poi: text, x: finite, z: finite, anchor: v.exactOptional(text) });
/** Original discovery catalogue; anchors resolve against the live placed world. */
export const AdventureContentSchema: v.StrictObjectSchema<{ readonly places: v.SchemaWithPipe<readonly [v.ArraySchema<v.GenericSchema<AdventureContentInput['places'][number], AdventureContent['places'][number]> & { readonly entries: { readonly at: typeof at } }, undefined>, v.MaxLengthAction<AdventureContent['places'], 64, undefined>]>; readonly guide: v.GenericSchema<AdventureContentInput['guide'], AdventureContent['guide']>; readonly glassCount: v.GenericSchema<AdventureContentInput['glassCount'], AdventureContent['glassCount']>; readonly shardFlags: v.GenericSchema<AdventureContentInput['shardFlags'], AdventureContent['shardFlags']>; }, undefined> = v.strictObject({
  places: v.pipe(v.array(v.strictObject({ id: text, label: text, completeLabel: text, at, r: positive })), v.maxLength(64)),
  guide: v.strictObject({ wander: positive, idle: positive, idleSpeed: positive, cooldown: positive, retry: positive }),
  glassCount: v.pipe(positive, v.safeInteger()), shardFlags: v.pipe(v.array(text), v.maxLength(32)),
});
/** Immutable discovery rows; flags and clocks retain their existing owners. */

/** Refuse malformed catalogue data before installing world discovery. */
export function parseAdventureContent(input: unknown): AdventureContent { return v.parse(AdventureContentSchema, input); }

const markerAt = v.strictObject({ ...at.entries, y: v.exactOptional(finite), dy: v.exactOptional(finite), yaw: v.exactOptional(finite) });
const chapterText = v.pipe(v.string(), v.maxLength(512));
const ChapterPresentation: v.GenericSchema<ChapterStoryPresentationInput, ChapterStoryPresentation> = v.pipe(v.strictObject({
  chapters: v.pipe(v.array(v.pipe(chapterText, v.minLength(1))), v.maxLength(64)),
  talks: v.pipe(v.array(v.strictObject({ id: chapterText, figure: v.exactOptional(chapterText), label: chapterText,
    radius: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(100)) })), v.maxLength(64)),
  rewards: v.record(chapterText, v.strictObject({ event: chapterText, title: chapterText })),
  flagEvents: v.pipe(v.array(v.strictObject({ flag: chapterText, event: chapterText })), v.maxLength(64)),
  introTitle: chapterText, chapterTitle: chapterText, completedObjective: chapterText, completedHint: chapterText,
  rewardKicker: chapterText, rewardSubtitle: chapterText, started: chapterText, objective: chapterText,
  messages: v.exactOptional(v.strictObject({ firstStep: v.exactOptional(chapterText), started: chapterText, objective: chapterText, completed: chapterText })),
  decision: v.exactOptional(v.strictObject({ program: v.exactOptional(v.pipe(v.unknown(), v.check(isJsonData))),
    observations: v.pipe(v.record(chapterText, v.strictObject({ source: ObservationRefSchema,
      on: v.exactOptional(chapterText) })), v.maxEntries(64)),
    actions: v.pipe(v.record(chapterText, v.pipe(v.array(QuestEffectSchema), v.maxLength(32))), v.maxEntries(64)),
  })),
  rewardMs: v.pipe(v.number(), v.safeInteger(), v.minValue(0), v.maxValue(60000)),
}), v.check(rows => rows.chapters.length > 0 && new Set(rows.chapters).size === rows.chapters.length
  && new Set(rows.talks.map(row => row.id)).size === rows.talks.length
  && Object.keys(rows.rewards).every(id => rows.chapters.includes(id)), 'unique bound chapter and speaker ids'));
/** Immutable chapter UI policy; authored templates accept {chapter}, {title}, {objective} and {reward}. */

/** Admit the presentation separately from the quest graph; it never supplies progression state. */
export function parseChapterStoryPresentation(input: unknown): ChapterStoryPresentation { return v.parse(ChapterPresentation, input); }

export const QuestStorySchema: v.StrictObjectSchema<{ readonly chapters: v.ExactOptionalSchema<v.GenericSchema<Exclude<QuestStoryInput['chapters'], undefined>, Exclude<QuestStory['chapters'], undefined>>, undefined>; readonly quest: v.GenericSchema<QuestStoryInput['quest'], QuestStory['quest']>; readonly presentation: v.GenericSchema<QuestStoryInput['presentation'], QuestStory['presentation']>; readonly journal: v.GenericSchema<QuestStoryInput['journal'], QuestStory['journal']>; readonly ignoredFlagPrefixes: v.GenericSchema<QuestStoryInput['ignoredFlagPrefixes'], QuestStory['ignoredFlagPrefixes']>; readonly notices: v.GenericSchema<QuestStoryInput['notices'], QuestStory['notices']>; readonly bench: v.GenericSchema<QuestStoryInput['bench'], QuestStory['bench']>; }, undefined> = v.strictObject({
  chapters: v.exactOptional(ChapterPresentation),
  quest: v.strictObject({ id: text, markers: v.record(text, markerAt) }),
  presentation: v.strictObject({ introTitle: text, worldPins: v.boolean(), mapMarkers: v.boolean(), minimapMarks: v.boolean(),
    messages: v.strictObject({ firstStep: text, started: text, objective: text, completed: text }) }),
  journal: v.strictObject({ state: v.exactOptional(text), achievementPrefix: v.pipe(v.string(), v.maxLength(96)),
    migrateProgress: v.boolean(), replay: v.boolean(), refresh: v.picklist(['emit', 'outcome']), syncEvents: v.boolean() }),
  ignoredFlagPrefixes: v.pipe(v.array(text), v.maxLength(16)),
  notices: v.pipe(v.array(v.strictObject({ prefix: text, total: v.pipe(positive, v.safeInteger()), text })), v.maxLength(32)),
  bench: v.strictObject({ forward: finite, height: finite, yaw: finite, pitch: finite, terrain: v.boolean(), text }),
});
/** Authored page presentation, migration and seat rows shared by quest hosts. */

/** Strict story admission adds no cursor, save or callback policy. */
export function parseQuestStory(input: unknown): QuestStory { return v.parse(QuestStorySchema, input); }


const bossRecord = v.variant('kind', [
  v.strictObject({ kind: v.literal('state'), key: text, actor: text, jsonError: text, writeError: text }),
  v.strictObject({ kind: v.literal('flags'), names: v.strictObject({ defeated: text, paid: text }), actor: text }),
]);
const pageStage = v.strictObject({ system: text, data: v.unknown(), initial: v.array(v.record(text, v.boolean())) });
export const PersistedQuestPageSchema: v.StrictObjectSchema<{ readonly id: v.GenericSchema<PersistedQuestPageInput['id'], PersistedQuestPage['id']>; readonly rewardId: v.GenericSchema<PersistedQuestPageInput['rewardId'], PersistedQuestPage['rewardId']>; readonly npc: v.GenericSchema<PersistedQuestPageInput['npc'], PersistedQuestPage['npc']>; readonly strings: v.GenericSchema<PersistedQuestPageInput['strings'], PersistedQuestPage['strings']>; readonly persistence: v.GenericSchema<PersistedQuestPageInput['persistence'], PersistedQuestPage['persistence']>; readonly model: v.ExactOptionalSchema<v.GenericSchema<Exclude<PersistedQuestPageInput['model'], undefined>, Exclude<PersistedQuestPage['model'], undefined>>, undefined>; readonly places: v.GenericSchema<PersistedQuestPageInput['places'], PersistedQuestPage['places']>; readonly markers: v.ExactOptionalSchema<v.GenericSchema<Exclude<PersistedQuestPageInput['markers'], undefined>, Exclude<PersistedQuestPage['markers'], undefined>>, undefined>; readonly presentationFlags: v.ExactOptionalSchema<v.GenericSchema<Exclude<PersistedQuestPageInput['presentationFlags'], undefined>, Exclude<PersistedQuestPage['presentationFlags'], undefined>>, undefined>; readonly projectProgress: v.ExactOptionalSchema<v.GenericSchema<Exclude<PersistedQuestPageInput['projectProgress'], undefined>, Exclude<PersistedQuestPage['projectProgress'], undefined>>, undefined>; readonly unpaid: v.ExactOptionalSchema<v.GenericSchema<Exclude<PersistedQuestPageInput['unpaid'], undefined>, Exclude<PersistedQuestPage['unpaid'], undefined>>, undefined>; readonly beat: v.ExactOptionalSchema<v.GenericSchema<Exclude<PersistedQuestPageInput['beat'], undefined>, Exclude<PersistedQuestPage['beat'], undefined>>, undefined>; readonly finishFlags: v.ExactOptionalSchema<v.GenericSchema<Exclude<PersistedQuestPageInput['finishFlags'], undefined>, Exclude<PersistedQuestPage['finishFlags'], undefined>>, undefined>; readonly stages: v.ExactOptionalSchema<v.GenericSchema<Exclude<PersistedQuestPageInput['stages'], undefined>, Exclude<PersistedQuestPage['stages'], undefined>>, undefined>; readonly repair: v.ExactOptionalSchema<v.GenericSchema<Exclude<PersistedQuestPageInput['repair'], undefined>, Exclude<PersistedQuestPage['repair'], undefined>>, undefined>; readonly capture: v.ExactOptionalSchema<v.GenericSchema<Exclude<PersistedQuestPageInput['capture'], undefined>, Exclude<PersistedQuestPage['capture'], undefined>>, undefined>; }, undefined> = v.strictObject({
  id: text, rewardId: text, npc: text,
  strings: v.looseObject({ reward: v.string(), newQuest: v.string(), quest: v.string(), rewardKicker: v.string(), rewardSubtitle: v.string() }),
  persistence: v.strictObject({ reward: v.strictObject({ kind: v.picklist(['state', 'flag']), key: text, legacy: text }),
    boss: v.exactOptional(v.strictObject({ record: bossRecord, defeated: v.strictObject({ fact: text, entity: text }) })) }),
  model: v.exactOptional(v.strictObject({ id: text, kind: v.picklist(['mesh', 'pivots']), material: v.exactOptional(text) })),
  places: v.pipe(v.array(v.strictObject({ id: text, label: text, x: finite, z: finite, r: positive,
    quiet: v.exactOptional(v.boolean()), y: v.exactOptional(finite) })), v.maxLength(64)),
  markers: v.exactOptional(v.record(text, markerAt)),
  presentationFlags: v.exactOptional(v.boolean()), projectProgress: v.exactOptional(v.boolean()), unpaid: v.exactOptional(v.picklist(['live', 'initial'])),
  beat: v.exactOptional(v.strictObject({ at: v.strictObject({ x: finite, y: finite, z: finite }),
    toward: v.looseObject({ x: finite, z: finite }), pitch: finite, holdSeconds: positive })),
  finishFlags: v.exactOptional(v.pipe(v.array(text), v.maxLength(256))), stages: v.exactOptional(v.pipe(v.array(pageStage), v.maxLength(64))),
  repair: v.exactOptional(v.strictObject({ data: v.unknown(), initial: v.array(v.record(text, v.boolean())),
    legacyObservation: text, advances: v.pipe(positive, v.safeInteger(), v.maxValue(64)) })),
  capture: v.exactOptional(v.record(text, v.pipe(v.array(v.union([v.strictObject({ flag: text }), v.strictObject({ call: text })])), v.maxLength(64)))),
});
/** Page policy borrows existing flag, reward and presentation owners; it adds no saved cursor. */

/** Validate compiled page JSON before the existing shared quest owner installs it. */
export function parsePersistedQuestPage(input: unknown): PersistedQuestPage { return v.parse(PersistedQuestPageSchema, input); }

/** Admitted data contracts, independent of validator implementation metadata. */
export type AdventurePlaceAtInput = AdventurePlaceAt;
interface AdventurePlaceAtFields {
    poi: string;
    x: number;
    z: number;
    anchor?: string;
}
export type AdventurePlaceAt = { [Key in keyof AdventurePlaceAtFields]: AdventurePlaceAtFields[Key] };
interface AdventureContentInputFields {
    places: ({
        id: string;
        label: string;
        completeLabel: string;
        at: AdventurePlaceAtInput;
        r: number;
    })[];
    guide: {
        wander: number;
        idle: number;
        idleSpeed: number;
        cooldown: number;
        retry: number;
    };
    glassCount: number;
    shardFlags: (string)[];
}
export type AdventureContentInput = { [Key in keyof AdventureContentInputFields]: AdventureContentInputFields[Key] };
interface AdventureContentFields {
    places: ({
        id: string;
        label: string;
        completeLabel: string;
        at: AdventurePlaceAt;
        r: number;
    })[];
    guide: {
        wander: number;
        idle: number;
        idleSpeed: number;
        cooldown: number;
        retry: number;
    };
    glassCount: number;
    shardFlags: (string)[];
}
export type AdventureContent = { [Key in keyof AdventureContentFields]: AdventureContentFields[Key] };
interface ChapterStoryPresentationInputFields {
    chapters: (string)[];
    talks: ({
        id: string;
        figure?: string;
        label: string;
        radius: number;
    })[];
    rewards: Record<string, {
        event: string;
        title: string;
    }>;
    flagEvents: ({
        flag: string;
        event: string;
    })[];
    introTitle: string;
    chapterTitle: string;
    completedObjective: string;
    completedHint: string;
    rewardKicker: string;
    rewardSubtitle: string;
    started: string;
    objective: string;
    messages?: {
        firstStep?: string;
        started: string;
        objective: string;
        completed: string;
    };
    decision?: {
        program?: unknown;
        observations: Record<string, {
            source: v.InferInput<typeof ObservationRefSchema>;
            on?: string;
        }>;
        actions: Record<string, (v.InferInput<typeof QuestEffectSchema>)[]>;
    };
    rewardMs: number;
}
export type ChapterStoryPresentationInput = { [Key in keyof ChapterStoryPresentationInputFields]: ChapterStoryPresentationInputFields[Key] };
interface ChapterStoryPresentationFields {
    chapters: (string)[];
    talks: ({
        id: string;
        figure?: string;
        label: string;
        radius: number;
    })[];
    rewards: Record<string, {
        event: string;
        title: string;
    }>;
    flagEvents: ({
        flag: string;
        event: string;
    })[];
    introTitle: string;
    chapterTitle: string;
    completedObjective: string;
    completedHint: string;
    rewardKicker: string;
    rewardSubtitle: string;
    started: string;
    objective: string;
    messages?: {
        firstStep?: string;
        started: string;
        objective: string;
        completed: string;
    };
    decision?: {
        program?: unknown;
        observations: Record<string, {
            source: v.InferOutput<typeof ObservationRefSchema>;
            on?: string;
        }>;
        actions: Record<string, (v.InferOutput<typeof QuestEffectSchema>)[]>;
    };
    rewardMs: number;
}
export type ChapterStoryPresentation = { [Key in keyof ChapterStoryPresentationFields]: ChapterStoryPresentationFields[Key] };
interface QuestStoryInputFields {
    chapters?: ChapterStoryPresentationInput;
    quest: {
        id: string;
        markers: Record<string, Omit<AdventurePlaceAtInput, keyof ({
            y?: number;
            dy?: number;
            yaw?: number;
        })> & {
            y?: number;
            dy?: number;
            yaw?: number;
        }>;
    };
    presentation: {
        introTitle: string;
        worldPins: boolean;
        mapMarkers: boolean;
        minimapMarks: boolean;
        messages: {
            firstStep: string;
            started: string;
            objective: string;
            completed: string;
        };
    };
    journal: {
        state?: string;
        achievementPrefix: string;
        migrateProgress: boolean;
        replay: boolean;
        refresh: 'emit' | 'outcome';
        syncEvents: boolean;
    };
    ignoredFlagPrefixes: (string)[];
    notices: ({
        prefix: string;
        total: number;
        text: string;
    })[];
    bench: {
        forward: number;
        height: number;
        yaw: number;
        pitch: number;
        terrain: boolean;
        text: string;
    };
}
export type QuestStoryInput = { [Key in keyof QuestStoryInputFields]: QuestStoryInputFields[Key] };
interface QuestStoryFields {
    chapters?: ChapterStoryPresentation;
    quest: {
        id: string;
        markers: Record<string, Omit<AdventurePlaceAt, keyof ({
            y?: number;
            dy?: number;
            yaw?: number;
        })> & {
            y?: number;
            dy?: number;
            yaw?: number;
        }>;
    };
    presentation: {
        introTitle: string;
        worldPins: boolean;
        mapMarkers: boolean;
        minimapMarks: boolean;
        messages: {
            firstStep: string;
            started: string;
            objective: string;
            completed: string;
        };
    };
    journal: {
        state?: string;
        achievementPrefix: string;
        migrateProgress: boolean;
        replay: boolean;
        refresh: 'emit' | 'outcome';
        syncEvents: boolean;
    };
    ignoredFlagPrefixes: (string)[];
    notices: ({
        prefix: string;
        total: number;
        text: string;
    })[];
    bench: {
        forward: number;
        height: number;
        yaw: number;
        pitch: number;
        terrain: boolean;
        text: string;
    };
}
export type QuestStory = { [Key in keyof QuestStoryFields]: QuestStoryFields[Key] };
interface PersistedQuestPageInputFields {
    id: string;
    rewardId: string;
    npc: string;
    strings: ({
        reward: string;
        newQuest: string;
        quest: string;
        rewardKicker: string;
        rewardSubtitle: string;
    }) & Record<string, unknown>;
    persistence: {
        reward: {
            kind: 'state' | 'flag';
            key: string;
            legacy: string;
        };
        boss?: {
            record: ({
                kind: 'state';
                key: string;
                actor: string;
                jsonError: string;
                writeError: string;
            }) | ({
                kind: 'flags';
                names: {
                    defeated: string;
                    paid: string;
                };
                actor: string;
            });
            defeated: {
                fact: string;
                entity: string;
            };
        };
    };
    model?: {
        id: string;
        kind: 'mesh' | 'pivots';
        material?: string;
    };
    places: ({
        id: string;
        label: string;
        x: number;
        z: number;
        r: number;
        quiet?: boolean;
        y?: number;
    })[];
    markers?: Record<string, Omit<AdventurePlaceAtInput, keyof ({
        y?: number;
        dy?: number;
        yaw?: number;
    })> & {
        y?: number;
        dy?: number;
        yaw?: number;
    }>;
    presentationFlags?: boolean;
    projectProgress?: boolean;
    unpaid?: 'live' | 'initial';
    beat?: {
        at: {
            x: number;
            y: number;
            z: number;
        };
        toward: ({
            x: number;
            z: number;
        }) & Record<string, unknown>;
        pitch: number;
        holdSeconds: number;
    };
    finishFlags?: (string)[];
    stages?: ({
        system: string;
        data: unknown;
        initial: (Record<string, boolean>)[];
    })[];
    repair?: {
        data: unknown;
        initial: (Record<string, boolean>)[];
        legacyObservation: string;
        advances: number;
    };
    capture?: Record<string, (({
        flag: string;
    }) | ({
        call: string;
    }))[]>;
}
export type PersistedQuestPageInput = { [Key in keyof PersistedQuestPageInputFields]: PersistedQuestPageInputFields[Key] };
interface PersistedQuestPageFields {
    id: string;
    rewardId: string;
    npc: string;
    strings: ({
        reward: string;
        newQuest: string;
        quest: string;
        rewardKicker: string;
        rewardSubtitle: string;
    }) & Record<string, unknown>;
    persistence: {
        reward: {
            kind: 'state' | 'flag';
            key: string;
            legacy: string;
        };
        boss?: {
            record: ({
                kind: 'state';
                key: string;
                actor: string;
                jsonError: string;
                writeError: string;
            }) | ({
                kind: 'flags';
                names: {
                    defeated: string;
                    paid: string;
                };
                actor: string;
            });
            defeated: {
                fact: string;
                entity: string;
            };
        };
    };
    model?: {
        id: string;
        kind: 'mesh' | 'pivots';
        material?: string;
    };
    places: ({
        id: string;
        label: string;
        x: number;
        z: number;
        r: number;
        quiet?: boolean;
        y?: number;
    })[];
    markers?: Record<string, Omit<AdventurePlaceAt, keyof ({
        y?: number;
        dy?: number;
        yaw?: number;
    })> & {
        y?: number;
        dy?: number;
        yaw?: number;
    }>;
    presentationFlags?: boolean;
    projectProgress?: boolean;
    unpaid?: 'live' | 'initial';
    beat?: {
        at: {
            x: number;
            y: number;
            z: number;
        };
        toward: ({
            x: number;
            z: number;
        }) & Record<string, unknown>;
        pitch: number;
        holdSeconds: number;
    };
    finishFlags?: (string)[];
    stages?: ({
        system: string;
        data: unknown;
        initial: (Record<string, boolean>)[];
    })[];
    repair?: {
        data: unknown;
        initial: (Record<string, boolean>)[];
        legacyObservation: string;
        advances: number;
    };
    capture?: Record<string, (({
        flag: string;
    }) | ({
        call: string;
    }))[]>;
}
export type PersistedQuestPage = { [Key in keyof PersistedQuestPageFields]: PersistedQuestPageFields[Key] };
