import * as v from 'valibot';
import { isJsonData } from './json';
import { NavigationSchema } from './navigation';
import { parseCapturePoses, type CapturePoseRows } from './minimap';

const text = v.pipe(v.string(), v.minLength(1), v.maxLength(4096));
const finite = v.pipe(v.number(), v.finite());
const nonnegative = v.pipe(finite, v.minValue(0));
const strings = v.pipe(v.array(text), v.maxLength(8192));
const numbers = v.record(text, nonnegative);
const tierBudget = v.strictObject({ fps: nonnegative, variability: nonnegative, cpuMs: nonnegative, gcMs: nonnegative,
  systems: numbers, vertexShare: nonnegative, lanes: numbers, linkMs: nonnegative });
const ceiling = v.strictObject({ draws: v.exactOptional(nonnegative), tris: v.exactOptional(nonnegative),
  programs: v.exactOptional(nonnegative), gpuMB: v.exactOptional(nonnegative) });
const ceilings = v.record(text, ceiling);
const budgets = v.strictObject({ phone: v.exactOptional(tierBudget), desktop: v.exactOptional(tierBudget),
  ceilings: v.exactOptional(v.strictObject({ phone: v.exactOptional(ceilings), desktop: v.exactOptional(ceilings) })),
  load: v.exactOptional(v.strictObject({ coldPlay4G: v.nullable(nonnegative), fixedSeconds: nonnegative, cpuRatio: nonnegative, bytesPerSecond: nonnegative })) });
const rgb = v.strictTuple([finite, finite, finite]), pair = v.strictTuple([finite, finite]);
const stroke = v.strictObject({ width: finite, style: text, dash: v.exactOptional(pair) });
const palette = v.object({ ground: v.object({ base: rgb, layers: v.array(v.object({ by: v.picklist(['height', 'slope', 'distance', 'wave']), color: v.union([rgb, v.object({ base: rgb, layers: v.array(v.unknown()) })]) })) }),
  segments: v.array(v.object({ from: pair, to: pair, strokes: v.array(stroke) })), trails: v.array(stroke),
  marks: v.array(v.object({ kind: v.picklist(['square', 'box', 'ring', 'dot']), x: finite, z: finite })),
  pois: v.array(v.object({ x: finite, z: finite, label: text, color: text })) });
const sourceRows = v.record(text, v.array(v.union([text, v.strictObject({ gpu: text })])));
const modes = <S extends v.GenericSchema>(schema: S) => v.strictObject({ modes: v.strictObject({
  phone: v.strictObject({ img: schema, ktx2: schema }), desktop: v.strictObject({ img: schema, ktx2: schema }),
}) });
/** Declared rows as plain bounded JSON objects; their game builders own the row grammar. */
const declaredRows = v.pipe(v.unknown(), v.check(input => typeof input === 'object' && input !== null && !Array.isArray(input) && isJsonData(input), 'declared rows are a JSON object'));
const sources = v.union([modes(v.record(text, strings)), v.strictObject({
  tiers: v.strictObject({ phone: sourceRows, desktop: sourceRows }), gpuFiles: v.exactOptional(v.record(text, v.unknown())),
})]);
const files = v.union([strings, modes(strings), v.strictObject({ sources, tier: v.picklist(['phone', 'desktop']), tex: v.picklist(['img', 'ktx2']) })]);
const gpuUrl = v.pipe(text, v.regex(/^\/[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*$/u),
  v.check(url => !url.split('/').some(part => part === '.' || part === '..'), 'GPU mapping URL escapes its root'));
// A table key names a public source file or a procedural texture (`procedural:<its public name>`, e.g. a baked coat),
// optionally one view of it (`#layer`: the file as a texture-array layer).
const gpuKey = v.pipe(text, v.check(key => {
  const name = key.startsWith('procedural:') ? key.slice('procedural:'.length) : key, view = /#[a-z]+$/u.exec(name);
  return v.is(gpuUrl, view === null ? name : name.slice(0, view.index));
}, 'GPU mapping key must be a public or procedural URL'));
const gpuTier = v.pipe(v.custom<Record<string, string>>(input => typeof input === 'object' && input !== null && !Array.isArray(input), 'GPU tier must be an object'), v.record(gpuKey, gpuUrl), v.check(rows => Object.keys(rows).length <= 8192, 'GPU mapping inventory exceeds cap'));
const gpuFiles = v.strictObject({ phone: gpuTier, desktop: gpuTier });

// These are build results, never module paths or runtime loaders. Keep the
// complete JSON values: the existing runtime contracts still own their values
// and defaults; validation must not strip palette extensions or source modes.
const fields = {
  budgets: v.exactOptional(budgets),
  navigation: v.exactOptional(v.objectWithRest({ navigation: NavigationSchema, url: text }, v.unknown())),
  mapPalette: v.exactOptional(v.pipe(v.unknown(), v.check(input => v.is(palette, input), 'Invalid discovery palette'))),
  poses: v.exactOptional(v.pipe(v.unknown(), v.transform(parseCapturePoses))),
  audioCues: v.exactOptional(v.record(text, text)),
  ktx2: v.exactOptional(gpuFiles),
  'boot.files': v.exactOptional(files), 'boot.sources': v.exactOptional(sources),
  'boot.lateReads': v.exactOptional(v.union([strings, modes(strings)])),
  'boot.explore': v.exactOptional(v.strictObject({ art: strings })),
  // A page-mode shard's boot and KTX2 rows for both page modes (src/game/shard/pageBoot.ts checks the exact source keys).
  'boot.pageModes': v.exactOptional(v.strictObject({ shard: modes(v.record(text, strings)), grid: modes(v.record(text, strings)),
    bakedUnreadPrefixes: v.pipe(strings, v.minLength(1)) })),
  'ktx2.pageModes': v.exactOptional(v.strictObject({ shard: gpuFiles, grid: gpuFiles })),
  // G33: declared ground, forest-query and pond-clip rows a program computes; the game's declared builders validate them.
  'ground.rows': v.exactOptional(declaredRows), 'forestQueries.rows': v.exactOptional(declaredRows), 'pondClip.rows': v.exactOptional(declaredRows),
};
const schema: v.GenericSchema<DiscoveryValuesInput, DiscoveryValues> = v.strictObject(fields);

/** Source programs may supply only these finite data bindings, not entry/load/render authority. */
export type DiscoveryInput = Readonly<Partial<Record<keyof DiscoveryValues, unknown>>>;

/** Admit and detach generated discovery values before storing them in the product receipt. */
export function parseDiscoveryValues(input: unknown): DiscoveryValues {
  if (!isJsonData(input)) throw new Error('Discovery values must be plain bounded JSON');
  const checked = v.parse(schema, input);
  return structuredClone(checked);
}

/** One page mode's boot sources by tier and texture mode. */
interface PageModeSources { modes: { phone: { img: Record<string, string[]>; ktx2: Record<string, string[]> }; desktop: { img: Record<string, string[]>; ktx2: Record<string, string[]> } } }
/** One page mode's GPU file tables by tier. */
interface PageModeGpu { phone: Record<string, string>; desktop: Record<string, string> }
/** Exact admitted data, independent of validator implementation metadata. */
interface DiscoveryValuesInputFields {
    ktx2?: { phone: Record<string, string>; desktop: Record<string, string> };
    budgets?: {
        phone?: {
            fps: number;
            variability: number;
            cpuMs: number;
            gcMs: number;
            systems: Record<string, number>;
            vertexShare: number;
            lanes: Record<string, number>;
            linkMs: number;
        };
        desktop?: {
            fps: number;
            variability: number;
            cpuMs: number;
            gcMs: number;
            systems: Record<string, number>;
            vertexShare: number;
            lanes: Record<string, number>;
            linkMs: number;
        };
        ceilings?: {
            phone?: Record<string, {
                    draws?: number;
                    tris?: number;
                    programs?: number;
                    gpuMB?: number;
                }>;
            desktop?: Record<string, {
                    draws?: number;
                    tris?: number;
                    programs?: number;
                    gpuMB?: number;
                }>;
        };
        load?: {
            coldPlay4G: number | null;
            fixedSeconds: number;
            cpuRatio: number;
            bytesPerSecond: number;
        };
    };
    navigation?: {
        navigation: {
            version: 1;
            layout: "wsnm-v1-le-quantized";
            file: string;
            bounds: [
                number,
                number,
                number,
                number,
                number,
                number
            ];
            layers: {
                radius: number;
                height: number;
                climb: number;
                cellSize: number;
                cellHeight: number;
                origin: [
                    number,
                    number,
                    number
                ];
                tileSize: number;
                tiles: [
                    number,
                    number
                ][];
            }[];
        };
        url: string;
    } & Record<string, unknown>;
    mapPalette?: unknown;
    poses?: unknown;
    audioCues?: Record<string, string>;
    'boot.files'?: string[] | {
        modes: {
            phone: {
                img: string[];
                ktx2: string[];
            };
            desktop: {
                img: string[];
                ktx2: string[];
            };
        };
    } | {
        sources: {
            modes: {
                phone: {
                    img: Record<string, string[]>;
                    ktx2: Record<string, string[]>;
                };
                desktop: {
                    img: Record<string, string[]>;
                    ktx2: Record<string, string[]>;
                };
            };
        } | {
            tiers: {
                phone: Record<string, (string | {
                        gpu: string;
                    })[]>;
                desktop: Record<string, (string | {
                        gpu: string;
                    })[]>;
            };
            gpuFiles?: Record<string, unknown>;
        };
        tier: "phone" | "desktop";
        tex: "img" | "ktx2";
    };
    'boot.sources'?: {
        modes: {
            phone: {
                img: Record<string, string[]>;
                ktx2: Record<string, string[]>;
            };
            desktop: {
                img: Record<string, string[]>;
                ktx2: Record<string, string[]>;
            };
        };
    } | {
        tiers: {
            phone: Record<string, (string | {
                    gpu: string;
                })[]>;
            desktop: Record<string, (string | {
                    gpu: string;
                })[]>;
        };
        gpuFiles?: Record<string, unknown>;
    };
    'boot.lateReads'?: string[] | {
        modes: {
            phone: {
                img: string[];
                ktx2: string[];
            };
            desktop: {
                img: string[];
                ktx2: string[];
            };
        };
    };
    'boot.explore'?: {
        art: string[];
    };
    'boot.pageModes'?: { shard: PageModeSources; grid: PageModeSources; bakedUnreadPrefixes: string[] };
    'ktx2.pageModes'?: { shard: PageModeGpu; grid: PageModeGpu };
    'ground.rows'?: unknown; 'forestQueries.rows'?: unknown; 'pondClip.rows'?: unknown;
}
export type DiscoveryValuesInput = { [Key in keyof DiscoveryValuesInputFields]: DiscoveryValuesInputFields[Key] };
interface DiscoveryValuesFields {
    ktx2?: { phone: Record<string, string>; desktop: Record<string, string> };
    budgets?: {
        phone?: {
            fps: number;
            variability: number;
            cpuMs: number;
            gcMs: number;
            systems: Record<string, number>;
            vertexShare: number;
            lanes: Record<string, number>;
            linkMs: number;
        };
        desktop?: {
            fps: number;
            variability: number;
            cpuMs: number;
            gcMs: number;
            systems: Record<string, number>;
            vertexShare: number;
            lanes: Record<string, number>;
            linkMs: number;
        };
        ceilings?: {
            phone?: Record<string, {
                    draws?: number;
                    tris?: number;
                    programs?: number;
                    gpuMB?: number;
                }>;
            desktop?: Record<string, {
                    draws?: number;
                    tris?: number;
                    programs?: number;
                    gpuMB?: number;
                }>;
        };
        load?: {
            coldPlay4G: number | null;
            fixedSeconds: number;
            cpuRatio: number;
            bytesPerSecond: number;
        };
    };
    navigation?: {
        navigation: {
            version: 1;
            layout: "wsnm-v1-le-quantized";
            file: string;
            bounds: [
                number,
                number,
                number,
                number,
                number,
                number
            ];
            layers: {
                radius: number;
                height: number;
                climb: number;
                cellSize: number;
                cellHeight: number;
                origin: [
                    number,
                    number,
                    number
                ];
                tileSize: number;
                tiles: [
                    number,
                    number
                ][];
            }[];
        };
        url: string;
    } & Record<string, unknown>;
    mapPalette?: unknown;
    poses?: CapturePoseRows;
    audioCues?: Record<string, string>;
    'boot.files'?: string[] | {
        modes: {
            phone: {
                img: string[];
                ktx2: string[];
            };
            desktop: {
                img: string[];
                ktx2: string[];
            };
        };
    } | {
        sources: {
            modes: {
                phone: {
                    img: Record<string, string[]>;
                    ktx2: Record<string, string[]>;
                };
                desktop: {
                    img: Record<string, string[]>;
                    ktx2: Record<string, string[]>;
                };
            };
        } | {
            tiers: {
                phone: Record<string, (string | {
                        gpu: string;
                    })[]>;
                desktop: Record<string, (string | {
                        gpu: string;
                    })[]>;
            };
            gpuFiles?: Record<string, unknown>;
        };
        tier: "phone" | "desktop";
        tex: "img" | "ktx2";
    };
    'boot.sources'?: {
        modes: {
            phone: {
                img: Record<string, string[]>;
                ktx2: Record<string, string[]>;
            };
            desktop: {
                img: Record<string, string[]>;
                ktx2: Record<string, string[]>;
            };
        };
    } | {
        tiers: {
            phone: Record<string, (string | {
                    gpu: string;
                })[]>;
            desktop: Record<string, (string | {
                    gpu: string;
                })[]>;
        };
        gpuFiles?: Record<string, unknown>;
    };
    'boot.lateReads'?: string[] | {
        modes: {
            phone: {
                img: string[];
                ktx2: string[];
            };
            desktop: {
                img: string[];
                ktx2: string[];
            };
        };
    };
    'boot.explore'?: {
        art: string[];
    };
    'boot.pageModes'?: { shard: PageModeSources; grid: PageModeSources; bakedUnreadPrefixes: string[] };
    'ktx2.pageModes'?: { shard: PageModeGpu; grid: PageModeGpu };
    'ground.rows'?: unknown; 'forestQueries.rows'?: unknown; 'pondClip.rows'?: unknown;
}
export type DiscoveryValues = { [Key in keyof DiscoveryValuesFields]: DiscoveryValuesFields[Key] };
