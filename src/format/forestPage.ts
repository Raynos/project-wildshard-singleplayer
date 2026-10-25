import * as v from 'valibot';
import { BuildingLifeLookSchema, BuildingLifeRowsSchema } from './buildings';
import { WorldSceneWeldSchema } from './worldSceneWeld';
import { PageWaterBindingSchema } from './pagePreparation';
import { isJsonData } from './json';

const n = v.pipe(v.number(), v.finite()), id = v.pipe(v.string(), v.minLength(1), v.maxLength(512));
const point = { x: n, y: n, z: n }, count = v.pipe(n, v.integer(), v.minValue(0));
const floor = v.strictObject({ ...point, hw: n, hd: n, rot: n }), tier = v.picklist(['phone', 'desktop']);
const place: v.GenericSchema<GroundPlacementInput, GroundPlacement> = v.strictObject({ ...point, nx: n, ny: n, nz: n, rot: n, scale: n, r: n, g: n, b: n, matrix: v.pipe(v.array(n), v.length(16)) });
/** Client-only forest cover and living settlements, with native resources by id. */
export const ForestPageSchema: v.GenericSchema<ForestPageRowsInput, ForestPageRows> = v.pipe(v.unknown(), v.check(isJsonData, 'Forest page requires JSON rows'), v.strictObject({
  water: PageWaterBindingSchema, treeLooks: v.pipe(v.array(v.strictObject({ look: id, band: v.picklist(['trunk', 'cards', 'twigs', 'far']), fade: id, viewer: id })), v.maxLength(4)),
  id, graphs: v.array(id), wildlife: id,
  streams: v.strictObject({ group: id, water: id, spray: id }),
  sliceMs: v.pipe(n, v.minValue(1), v.maxValue(100)), ground: v.strictObject({ appearance: id, layout: id, sources: v.array(id), kinds: v.pipe(v.array(v.strictObject({ id, geometry: id, model: id, name: id })), v.maxLength(6)),
    far: id, shadow: id, cells: v.strictObject({ size: n, pad: n, extraFar: n }) }),
  buildings: v.strictObject({ id, root: id, shells: id, life: BuildingLifeLookSchema,
    shared: id, shadow: id, sites: id,
    variants: v.pipe(v.array(v.strictObject({ tier: v.picklist(['phone', 'desktop']), shadow: v.boolean(), shared: v.boolean(), file: id })), v.maxLength(8)),
    light: v.strictObject({ count: v.pipe(count, v.maxValue(4)), color: n, intensity: n, distance: n, decay: n }),
    hearth: id, sunParam: id, lampsParam: id, shadeParam: id, nightShade: n, sightSlack: n,
    material: id, save: id, floors: v.pipe(v.array(floor), v.maxLength(128)), firePits: v.pipe(v.array(v.strictObject(point)), v.maxLength(16)),
  }), props: v.pipe(v.array(id), v.maxLength(3)),
  lanterns: v.strictObject({ texture: id, color: n, size: n, order: n, range: n, day: n, flicker: v.tuple([n, n, n, n]),
    light: v.strictObject({ color: n, intensity: n, distance: n, decay: n }), rows: v.pipe(v.array(v.strictObject({ id, at: v.tuple([n, n, n]) })), v.maxLength(16)) }),
  landmarks: v.pipe(v.array(v.union([v.strictObject({ place: id, tier: v.exactOptional(tier) }), v.strictObject({ object: id, tier: v.exactOptional(tier) })])), v.maxLength(48)),
}));

/** Layout counts remain independently admitted and bounded across all kinds. */
const groundCounts = (row: { readonly counts: readonly number[]; readonly layout: Readonly<Record<string, readonly unknown[]>> }): boolean => {
  const total = Object.values(row.layout).reduce((sum, entries) => sum + entries.length, 0);
  return total <= 40_000 && row.counts.length === Object.keys(row.layout).length && total === row.counts.reduce((sum, amount) => sum + amount, 0);
};
export const ForestGroundLayoutSchema: v.GenericSchema<ForestGroundLayoutInput, ForestGroundLayout> = v.pipe(v.strictObject({ counts: v.array(count), layout: v.record(id, v.pipe(v.array(place), v.maxLength(40_000))) }),
  v.check(row => groundCounts(row), 'Invalid forest ground counts'));

const GroundShellSchema = v.pipe(v.strictObject({ counts: v.array(count), layout: v.record(id, v.pipe(v.array(v.unknown()), v.maxLength(40_000))) }),
  v.check(row => groundCounts(row), 'Invalid forest ground counts'));
const GROUND_STEP = 1024, groundPlacements = v.array(place);
/** `ForestGroundLayoutSchema` in steps of 1024 placements, the same rules and output: Pine's layout (up to 40k
 *  placements) was one ~90 ms parse in a drawn frame. */
export function* forestGroundLayoutSteps(input: unknown): Generator<void, ForestGroundLayout> {
  const shell = v.parse(GroundShellSchema, input), layout: Record<string, GroundPlacement[]> = {};
  for (const [kind, entries] of Object.entries(shell.layout)) {
    const placements: GroundPlacement[] = [];
    for (let at = 0; at < entries.length; at += GROUND_STEP) { placements.push(...v.parse(groundPlacements, entries.slice(at, at + GROUND_STEP))); yield; }
    layout[kind] = placements;
  }
  return { counts: shell.counts, layout };
}
export const LivingPageInputSchema: v.GenericSchema<LivingPageInputRowsInput, LivingPageInputRows> = v.object({ graph: WorldSceneWeldSchema, life: BuildingLifeRowsSchema,
  geometry: v.array(v.object({ key: id, id, source: v.object({ library: id, model: id }) })) });
export const LivingPageSitesSchema: v.GenericSchema<LivingPageSitesRowsInput, LivingPageSitesRows> = v.strictObject({ buildings: v.array(v.strictObject({ id, index: count, root: id, standalone: v.boolean() })),
  roofs: v.array(v.strictObject({ x: n, z: n, rot: n, w: n, d: n })) });


/** Admitted data contracts, independent of validator implementation metadata. */
export type ForestPageRowsInput = unknown;
export interface ForestPageRows {
    water: v.InferOutput<typeof PageWaterBindingSchema>;
    treeLooks: ({
        look: string;
        band: 'trunk' | 'cards' | 'twigs' | 'far';
        fade: string;
        viewer: string;
    })[];
    id: string;
    graphs: (string)[];
    wildlife: string;
    streams: {
        group: string;
        water: string;
        spray: string;
    };
    sliceMs: number;
    ground: {
        appearance: string;
        layout: string;
        sources: (string)[];
        kinds: ({
            id: string;
            geometry: string;
            model: string;
            name: string;
        })[];
        far: string;
        shadow: string;
        cells: {
            size: number;
            pad: number;
            extraFar: number;
        };
    };
    buildings: {
        id: string;
        root: string;
        shells: string;
        life: v.InferOutput<typeof BuildingLifeLookSchema>;
        shared: string;
        shadow: string;
        sites: string;
        variants: ({
            tier: 'phone' | 'desktop';
            shadow: boolean;
            shared: boolean;
            file: string;
        })[];
        light: {
            count: number;
            color: number;
            intensity: number;
            distance: number;
            decay: number;
        };
        hearth: string;
        sunParam: string;
        lampsParam: string;
        shadeParam: string;
        nightShade: number;
        sightSlack: number;
        material: string;
        save: string;
        floors: ({
            hw: number;
            hd: number;
            rot: number;
        } & {
            x: number;
            y: number;
            z: number;
        })[];
        firePits: ({
            x: number;
            y: number;
            z: number;
        })[];
    };
    props: (string)[];
    lanterns: {
        texture: string;
        color: number;
        size: number;
        order: number;
        range: number;
        day: number;
        flicker: [
            number,
            number,
            number,
            number
        ];
        light: {
            color: number;
            intensity: number;
            distance: number;
            decay: number;
        };
        rows: ({
            id: string;
            at: [
                number,
                number,
                number
            ];
        })[];
    };
    landmarks: (({
        place: string;
        tier?: 'phone' | 'desktop';
    }) | ({
        object: string;
        tier?: 'phone' | 'desktop';
    }))[];
}
export interface ForestGroundLayoutInput {
    counts: (number)[];
    layout: Record<string, (GroundPlacementInput)[]>;
}
export interface ForestGroundLayout {
    counts: (number)[];
    layout: Record<string, (GroundPlacement)[]>;
}
export interface LivingPageInputRowsInput {
    graph: v.InferInput<typeof WorldSceneWeldSchema>;
    life: v.InferInput<typeof BuildingLifeRowsSchema>;
    geometry: ({
        key: string;
        id: string;
        source: {
            library: string;
            model: string;
        };
    })[];
}
export interface LivingPageInputRows {
    graph: v.InferOutput<typeof WorldSceneWeldSchema>;
    life: v.InferOutput<typeof BuildingLifeRowsSchema>;
    geometry: ({
        key: string;
        id: string;
        source: {
            library: string;
            model: string;
        };
    })[];
}
export type LivingPageSitesRowsInput = LivingPageSitesRows;
export interface LivingPageSitesRows {
    buildings: ({
        id: string;
        index: number;
        root: string;
        standalone: boolean;
    })[];
    roofs: ({
        x: number;
        z: number;
        rot: number;
        w: number;
        d: number;
    })[];
}
export type GroundPlacementInput = GroundPlacement;
export type GroundPlacement = {
    nx: number;
    ny: number;
    nz: number;
    rot: number;
    scale: number;
    r: number;
    g: number;
    b: number;
    matrix: (number)[];
} & {
    x: number;
    y: number;
    z: number;
};
