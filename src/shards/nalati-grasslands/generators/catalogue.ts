import { SpecimenCatalogueSchema } from '@wildshard/format/specimenCatalogue';
import rows from '../data/campCatalogue.json' with { type: 'json' };
import type { CatalogueParams } from './campParams';

// The defining schema's standard interface avoids a runtime catalogue and
// admits every header before any author painter can use its parameter data.
const checked = await SpecimenCatalogueSchema['~standard'].validate(rows);
if (checked.issues !== undefined) throw new Error('Invalid Nalati author catalogue');
const declarations = checked.value;
if (declarations.length > 1024 || new Set(declarations.map(row => row.key)).size !== declarations.length
  || new Set(declarations.map(row => row.model.id)).size !== declarations.length) throw new Error('Duplicate Nalati author model');
const catalogue = {
  model<K extends keyof CatalogueParams>(key: K) {
    const row = declarations.find(candidate => candidate.key === key);
    if (row === undefined) throw new Error(`Missing Nalati author model: ${key}`);
    const { defaults, variants, surface: modelSurface, seed, specimenYaw, ...metadata } = row.model;
    return { ...metadata,
      ...(modelSurface === undefined ? {} : { surface: modelSurface }), ...(seed === undefined ? {} : { seed }),
      ...(specimenYaw === undefined ? {} : { specimenYaw }),
      // The author parameter map is the same constrained generic boundary used
      // by the runtime host; geometry still comes from the defining painters.
      defaults: defaults as CatalogueParams[K],
      ...(variants === undefined ? {} : { variants: variants.map(variant => ({ id: variant.id, label: variant.label, params: variant.params as Partial<CatalogueParams[K]> })) }),
      ...(row.colliders === undefined ? {} : { colliders: () => (row.colliders ?? []).map(collider => {
        const { surface, yaw, ...shape } = collider;
        return Object.assign(shape, surface === undefined ? {} : { surface }, yaw === undefined ? {} : { yaw });
      }) }),
      build: () => { throw new Error('Author metadata cannot construct a runtime specimen'); },
    };
  },
};
/** Preserve the defining parameter map for every concrete model declaration. */
interface CatalogueShape<K extends keyof CatalogueParams> { build: () => never; colliders?: () => ({ kind: "box"; x: number; y: number; z: number; hx: number; hy: number; hz: number; } & (({ surface?: never; } | { surface: "edge" | "grass" | "water" | "wood" | "rock" | "felt" | "stone" | "earth" | "sand" | "ground" | "metal" | "flesh" | "wetSand" | "planks" | "shell"; }) & ({ yaw?: never; } | { yaw: number; })))[]; variants?: { id: string; label: string; params: Partial<CatalogueParams[K]>; }[]; defaults: CatalogueParams[K]; specimenYaw?: number; seed?: number; surface?: "edge" | "grass" | "water" | "wood" | "rock" | "felt" | "stone" | "earth" | "sand" | "ground" | "metal" | "flesh" | "wetSand" | "planks" | "shell"; id: string; name: string; file: string; category: "buildings" | "nature" | "creatures" | "people" | "gear" | "props"; pipeline: ("code" | "blender" | "trellis" | "hunyuan" | "cc0") | (("code" | "blender" | "trellis" | "hunyuan" | "cc0")[]); }
/** A mapped shape preserves the original object literal implicit index signature. */
type CatalogueModel<K extends keyof CatalogueParams> = { [P in keyof CatalogueShape<K>]: CatalogueShape<K>[P] };

export const ribbonPole: CatalogueModel<'ribbonPole'> = catalogue.model('ribbonPole');
export const eaglePerch: CatalogueModel<'eaglePerch'> = catalogue.model('eaglePerch');
export const stove: CatalogueModel<'stove'> = catalogue.model('stove');
export const campBench: CatalogueModel<'campBench'> = catalogue.model('campBench');
export const rugRack: CatalogueModel<'rugRack'> = catalogue.model('rugRack');
export const feltRug: CatalogueModel<'feltRug'> = catalogue.model('feltRug');
export const cart: CatalogueModel<'cart'> = catalogue.model('cart');
export const barrel: CatalogueModel<'barrel'> = catalogue.model('barrel');
export const hitchingRail: CatalogueModel<'hitchingRail'> = catalogue.model('hitchingRail');
export const waterTrough: CatalogueModel<'waterTrough'> = catalogue.model('waterTrough');
export const saddleRack: CatalogueModel<'saddleRack'> = catalogue.model('saddleRack');
export const corral: CatalogueModel<'corral'> = catalogue.model('corral');
export const hayPile: CatalogueModel<'hayPile'> = catalogue.model('hayPile');
export const feedTrough: CatalogueModel<'feedTrough'> = catalogue.model('feedTrough');
export const rugLine: CatalogueModel<'rugLine'> = catalogue.model('rugLine');
export const choppingBlock: CatalogueModel<'choppingBlock'> = catalogue.model('choppingBlock');
export const milkCans: CatalogueModel<'milkCans'> = catalogue.model('milkCans');
export const tetherLine: CatalogueModel<'tetherLine'> = catalogue.model('tetherLine');
export const kurtBoard: CatalogueModel<'kurtBoard'> = catalogue.model('kurtBoard');
export const ribbonPost: CatalogueModel<'ribbonPost'> = catalogue.model('ribbonPost');
export const eagleRock: CatalogueModel<'eagleRock'> = catalogue.model('eagleRock');
export const windCairn: CatalogueModel<'windCairn'> = catalogue.model('windCairn');
export const cragLedge: CatalogueModel<'cragLedge'> = catalogue.model('cragLedge');
export const leopardCave: CatalogueModel<'leopardCave'> = catalogue.model('leopardCave');
export const kurganEntrance: CatalogueModel<'kurganEntrance'> = catalogue.model('kurganEntrance');
export const kurganKerb: CatalogueModel<'kurganKerb'> = catalogue.model('kurganKerb');
export const fieldstoneBaked: CatalogueModel<'fieldstoneBaked'> = catalogue.model('fieldstoneBaked');
export const fallenLog: CatalogueModel<'fallenLog'> = catalogue.model('fallenLog');
export const stump: CatalogueModel<'stump'> = catalogue.model('stump');
export const ovoo: CatalogueModel<'ovoo'> = catalogue.model('ovoo');
export const viewpointPole: CatalogueModel<'viewpointPole'> = catalogue.model('viewpointPole');
export const skyGateway: CatalogueModel<'skyGateway'> = catalogue.model('skyGateway');
export const campClutter: CatalogueModel<'campClutter'> = catalogue.model('campClutter');
export const fence: CatalogueModel<'fence'> = catalogue.model('fence');
export const graniteOutcrop: CatalogueModel<'graniteOutcrop'> = catalogue.model('graniteOutcrop');
export const roundedBoulder: CatalogueModel<'roundedBoulder'> = catalogue.model('roundedBoulder');
export const kokparGoal: CatalogueModel<'kokparGoal'> = catalogue.model('kokparGoal');
export const kokparPost: CatalogueModel<'kokparPost'> = catalogue.model('kokparPost');
export const stoneStep: CatalogueModel<'stoneStep'> = catalogue.model('stoneStep');
export const signpostBaked: CatalogueModel<'signpostBaked'> = catalogue.model('signpostBaked');
export const kazan: CatalogueModel<'kazan'> = catalogue.model('kazan');
export const chest: CatalogueModel<'chest'> = catalogue.model('chest');
export const firewood: CatalogueModel<'firewood'> = catalogue.model('firewood');
export const kumisChurn: CatalogueModel<'kumisChurn'> = catalogue.model('kumisChurn');
export const groundSaddle: CatalogueModel<'groundSaddle'> = catalogue.model('groundSaddle');
export const perchedEagle: CatalogueModel<'perchedEagle'> = catalogue.model('perchedEagle');
export const watchtower: CatalogueModel<'watchtower'> = catalogue.model('watchtower');
export const saddledHorse: CatalogueModel<'saddledHorse'> = catalogue.model('saddledHorse');
export const kokparRider: CatalogueModel<'kokparRider'> = catalogue.model('kokparRider');
export const yurt: CatalogueModel<'yurt'> = catalogue.model('yurt');
export const kunesBridge: CatalogueModel<'kunesBridge'> = catalogue.model('kunesBridge');
export const herdHorse: CatalogueModel<'herdHorse'> = catalogue.model('herdHorse');
export const snowLotus: CatalogueModel<'snowLotus'> = catalogue.model('snowLotus');
