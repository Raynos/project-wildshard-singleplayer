import * as v from 'valibot';
import { isJsonData } from './json';
import { ReturnProgramSchema } from './namedJsonContracts';
import { parsePanelDefinition, type PanelDefinition } from './panelTemplate';

const text = v.pipe(v.string(), v.minLength(1), v.maxLength(400));
const integer = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
const positive = v.pipe(integer, v.minValue(1));
const reward: v.GenericSchema<ContractRewardInput, ContractReward> = v.strictObject({ items: v.pipe(v.array(v.strictObject({ id: text, n: positive })), v.maxLength(16)),
  bolts: integer, skin: v.exactOptional(text) });
const target = v.strictObject({ kind: text, target: text });
/** Deterministic contract board policy and content. Selection laws and identities are authored rows. */
export const ContractCatalogueSchema: v.GenericSchema<ContractCatalogueInput, ContractCatalogue> = v.strictObject({
  program: v.exactOptional(ReturnProgramSchema),
  id: text, store: text, slots: v.pipe(positive, v.maxValue(8)), attempts: v.pipe(positive, v.maxValue(256)),
  initial: v.array(target), fallback: target,
  draws: v.pipe(v.array(v.strictObject({ below: v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(1)),
    kind: text, targets: v.pipe(v.array(text), v.minLength(1), v.maxLength(64)) })), v.minLength(1), v.maxLength(32)),
  ranks: v.record(text, integer), defaultRank: text,
  tags: v.exactOptional(v.pipe(v.array(v.strictObject({ tag: text,
    any: v.pipe(v.array(v.union([
      v.strictObject({ kind: text, variant: v.exactOptional(text), label: v.exactOptional(text) }),
      v.strictObject({ kind: v.exactOptional(text), variant: text, label: v.exactOptional(text) }),
      v.strictObject({ kind: v.exactOptional(text), variant: v.exactOptional(text), label: text }),
    ])), v.minLength(1), v.maxLength(64)) })), v.maxLength(64))),
  matches: v.pipe(v.array(v.strictObject({ kind: text, match: v.picklist(['species', 'rarity', 'elite', 'tag']),
    excludeTags: v.array(text), excludeElite: v.boolean(), belowRank: v.exactOptional(positive) })), v.minLength(1), v.maxLength(32)),
  milestones: v.pipe(v.array(v.strictObject({ claimed: positive, skin: text })), v.maxLength(32)),
  species: v.array(v.strictObject({ id: text, plural: text, need: positive, title: text })),
  rarity: v.array(v.strictObject({ id: text, need: positive, title: text })),
  elites: v.record(text, v.strictObject({ name: text, kind: text, variant: text })),
  eliteIds: v.array(text),
  rows: v.pipe(v.array(v.strictObject({ id: text, kind: text, target: text, need: positive,
    title: text, goal: text, reward })), v.minLength(1), v.maxLength(256)),
});
/** Successful claims return ids for the existing inventory and cosmetic owners. */


/** Admit the complete catalogue before creating state; duplicate and missing references refuse. */
export function parseContractCatalogue(input: unknown): ContractCatalogue {
  if (!isJsonData(input)) throw new Error('Contract catalogue must be plain JSON');
  const rows = v.parse(ContractCatalogueSchema, input);
  const has = (kind: string, value: string): boolean => rows.rows.some(row => row.kind === kind && row.target === value);
  if (new Set(rows.rows.map(row => row.id)).size !== rows.rows.length
    || new Set(rows.rows.map(row => JSON.stringify([row.kind, row.target]))).size !== rows.rows.length
    || new Set(rows.matches.map(row => row.kind)).size !== rows.matches.length
    || new Set(rows.tags?.map(row => row.tag)).size !== (rows.tags?.length ?? 0)
    || rows.rows.some(row => !rows.matches.some(match => match.kind === row.kind))
    || rows.draws.some((row, index) => (index > 0 && row.below <= (rows.draws[index - 1]?.below ?? 0))
      || row.targets.some(value => !has(row.kind, value)))
    || rows.draws.at(-1)?.below !== 1 || rows.initial.some(row => !has(row.kind, row.target))
    || !has(rows.fallback.kind, rows.fallback.target) || rows.ranks[rows.defaultRank] === undefined
    || new Set(rows.eliteIds).size !== rows.eliteIds.length || rows.eliteIds.length !== Object.keys(rows.elites).length
    || rows.eliteIds.some(id => rows.elites[id] === undefined)) throw new Error('Invalid contract catalogue references');
  return rows;
}

const pageId = v.pipe(v.string(), v.minLength(1), v.maxLength(256)), finite = v.pipe(v.number(), v.finite());
const caption = v.pipe(v.string(), v.maxLength(2048));
/** Build admission for the existing board panel and feedback data. Panel bytes
 * are also admitted by the shared panel product before page construction. */
export const ContractBoardPageSchema: v.StrictObjectSchema<{ readonly contracts: v.GenericSchema<ContractBoardPageDataInput['contracts'], ContractBoardPageData['contracts']>; readonly panel: v.GenericSchema<ContractBoardPageDataInput['panel'], ContractBoardPageData['panel']>; readonly store: v.GenericSchema<ContractBoardPageDataInput['store'], ContractBoardPageData['store']>; readonly at: v.GenericSchema<ContractBoardPageDataInput['at'], ContractBoardPageData['at']>; readonly label: v.GenericSchema<ContractBoardPageDataInput['label'], ContractBoardPageData['label']>; readonly filled: v.GenericSchema<ContractBoardPageDataInput['filled'], ContractBoardPageData['filled']>; readonly height: v.GenericSchema<ContractBoardPageDataInput['height'], ContractBoardPageData['height']>; readonly radius: v.GenericSchema<ContractBoardPageDataInput['radius'], ContractBoardPageData['radius']>; readonly ammunition: v.ExactOptionalSchema<v.GenericSchema<Exclude<ContractBoardPageDataInput['ammunition'], undefined>, Exclude<ContractBoardPageData['ammunition'], undefined>>, undefined>; readonly finishes: v.GenericSchema<ContractBoardPageDataInput['finishes'], ContractBoardPageData['finishes']>; readonly notices: v.GenericSchema<ContractBoardPageDataInput['notices'], ContractBoardPageData['notices']>; }, undefined> = v.strictObject({ contracts: ContractCatalogueSchema, panel: v.unknown(),
  store: v.strictObject({ slot: pageId, state: pageId }),
  at: v.strictObject({ x: finite, z: finite, yaw: finite }),
  label: caption, filled: caption, height: finite, radius: v.pipe(finite, v.minValue(Number.MIN_VALUE)),
  ammunition: v.exactOptional(v.strictObject({ loadout: pageId, kind: pageId })),
  finishes: v.record(pageId, caption),
  notices: v.strictObject({ claimed: caption, filled: caption, progress: caption }),
});
/** Already-admitted catalogue, panel and entered-service identities. */
export type ContractBoardPageRows = Omit<v.InferOutput<typeof ContractBoardPageSchema>, 'panel'> & { readonly panel: PanelDefinition };
/** Validate author rows before publishing; runtime keeps only live owner checks. */
export function parseContractBoardPage(input: unknown): ContractBoardPageRows {
  if (!isJsonData(input)) throw new Error('Quest board requires JSON rows');
  const rows = v.parse(ContractBoardPageSchema, input), contracts = parseContractCatalogue(rows.contracts), panel = parsePanelDefinition(rows.panel);
  for (const [key, allowed] of [['claimed', ['claimed', 'streak']], ['filled', ['goal']], ['progress', ['goal', 'have', 'need']]] as const)
    for (const token of rows.notices[key].matchAll(/\{([^{}]+)\}/gu)) if (!allowed.some(name => name === token[1])) throw new Error('Unknown board notice field');
  for (const key of [...contracts.rows.flatMap(row => row.reward.skin === undefined ? [] : [row.reward.skin]), ...contracts.milestones.map(row => row.skin)])
    if (!Object.hasOwn(rows.finishes, key)) throw new Error('Quest board lacks finish feedback');
  if (rows.ammunition === undefined && contracts.rows.some(row => row.reward.bolts > 0)) throw new Error('Quest board requires its declared ammunition owner');
  return { ...rows, contracts, panel };
}

/** Admitted data contracts, independent of validator implementation metadata. */
export type ContractRewardInput = ContractReward;
interface ContractRewardFields {
    items: ({
        id: string;
        n: number;
    })[];
    bolts: number;
    skin?: string;
}
export type ContractReward = { [Key in keyof ContractRewardFields]: ContractRewardFields[Key] };
interface ContractCatalogueInputFields {
    program?: v.InferInput<typeof ReturnProgramSchema>;
    id: string;
    store: string;
    slots: number;
    attempts: number;
    initial: ({
        kind: string;
        target: string;
    })[];
    fallback: {
        kind: string;
        target: string;
    };
    draws: ({
        below: number;
        kind: string;
        targets: (string)[];
    })[];
    ranks: Record<string, number>;
    defaultRank: string;
    tags?: ({
        tag: string;
        any: (({
            kind: string;
            variant?: string;
            label?: string;
        }) | ({
            kind?: string;
            variant: string;
            label?: string;
        }) | ({
            kind?: string;
            variant?: string;
            label: string;
        }))[];
    })[];
    matches: ({
        kind: string;
        match: 'species' | 'rarity' | 'elite' | 'tag';
        excludeTags: (string)[];
        excludeElite: boolean;
        belowRank?: number;
    })[];
    milestones: ({
        claimed: number;
        skin: string;
    })[];
    species: ({
        id: string;
        plural: string;
        need: number;
        title: string;
    })[];
    rarity: ({
        id: string;
        need: number;
        title: string;
    })[];
    elites: Record<string, {
        name: string;
        kind: string;
        variant: string;
    }>;
    eliteIds: (string)[];
    rows: ({
        id: string;
        kind: string;
        target: string;
        need: number;
        title: string;
        goal: string;
        reward: ContractRewardInput;
    })[];
}
export type ContractCatalogueInput = { [Key in keyof ContractCatalogueInputFields]: ContractCatalogueInputFields[Key] };
interface ContractCatalogueFields {
    program?: v.InferOutput<typeof ReturnProgramSchema>;
    id: string;
    store: string;
    slots: number;
    attempts: number;
    initial: ({
        kind: string;
        target: string;
    })[];
    fallback: {
        kind: string;
        target: string;
    };
    draws: ({
        below: number;
        kind: string;
        targets: (string)[];
    })[];
    ranks: Record<string, number>;
    defaultRank: string;
    tags?: ({
        tag: string;
        any: (({
            kind: string;
            variant?: string;
            label?: string;
        }) | ({
            kind?: string;
            variant: string;
            label?: string;
        }) | ({
            kind?: string;
            variant?: string;
            label: string;
        }))[];
    })[];
    matches: ({
        kind: string;
        match: 'species' | 'rarity' | 'elite' | 'tag';
        excludeTags: (string)[];
        excludeElite: boolean;
        belowRank?: number;
    })[];
    milestones: ({
        claimed: number;
        skin: string;
    })[];
    species: ({
        id: string;
        plural: string;
        need: number;
        title: string;
    })[];
    rarity: ({
        id: string;
        need: number;
        title: string;
    })[];
    elites: Record<string, {
        name: string;
        kind: string;
        variant: string;
    }>;
    eliteIds: (string)[];
    rows: ({
        id: string;
        kind: string;
        target: string;
        need: number;
        title: string;
        goal: string;
        reward: ContractReward;
    })[];
}
export type ContractCatalogue = { [Key in keyof ContractCatalogueFields]: ContractCatalogueFields[Key] };
interface ContractBoardPageDataInputFields {
    contracts: ContractCatalogueInput;
    panel: unknown;
    store: {
        slot: string;
        state: string;
    };
    at: {
        x: number;
        z: number;
        yaw: number;
    };
    label: string;
    filled: string;
    height: number;
    radius: number;
    ammunition?: {
        loadout: string;
        kind: string;
    };
    finishes: Record<string, string>;
    notices: {
        claimed: string;
        filled: string;
        progress: string;
    };
}
export type ContractBoardPageDataInput = { [Key in keyof ContractBoardPageDataInputFields]: ContractBoardPageDataInputFields[Key] };
interface ContractBoardPageDataFields {
    contracts: ContractCatalogue;
    panel: unknown;
    store: {
        slot: string;
        state: string;
    };
    at: {
        x: number;
        z: number;
        yaw: number;
    };
    label: string;
    filled: string;
    height: number;
    radius: number;
    ammunition?: {
        loadout: string;
        kind: string;
    };
    finishes: Record<string, string>;
    notices: {
        claimed: string;
        filled: string;
        progress: string;
    };
}
export type ContractBoardPageData = { [Key in keyof ContractBoardPageDataFields]: ContractBoardPageDataFields[Key] };
