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
export const ribbonPole = catalogue.model('ribbonPole');
export const eaglePerch = catalogue.model('eaglePerch');
export const stove = catalogue.model('stove');
export const campBench = catalogue.model('campBench');
export const rugRack = catalogue.model('rugRack');
export const feltRug = catalogue.model('feltRug');
export const cart = catalogue.model('cart');
export const barrel = catalogue.model('barrel');
export const hitchingRail = catalogue.model('hitchingRail');
export const waterTrough = catalogue.model('waterTrough');
export const saddleRack = catalogue.model('saddleRack');
export const corral = catalogue.model('corral');
export const hayPile = catalogue.model('hayPile');
export const feedTrough = catalogue.model('feedTrough');
export const rugLine = catalogue.model('rugLine');
export const choppingBlock = catalogue.model('choppingBlock');
export const milkCans = catalogue.model('milkCans');
export const tetherLine = catalogue.model('tetherLine');
export const kurtBoard = catalogue.model('kurtBoard');
export const ribbonPost = catalogue.model('ribbonPost');
export const eagleRock = catalogue.model('eagleRock');
export const windCairn = catalogue.model('windCairn');
export const cragLedge = catalogue.model('cragLedge');
export const leopardCave = catalogue.model('leopardCave');
export const kurganEntrance = catalogue.model('kurganEntrance');
export const kurganKerb = catalogue.model('kurganKerb');
export const fieldstoneBaked = catalogue.model('fieldstoneBaked');
export const fallenLog = catalogue.model('fallenLog');
export const stump = catalogue.model('stump');
export const ovoo = catalogue.model('ovoo');
export const viewpointPole = catalogue.model('viewpointPole');
export const skyGateway = catalogue.model('skyGateway');
export const campClutter = catalogue.model('campClutter');
export const fence = catalogue.model('fence');
export const graniteOutcrop = catalogue.model('graniteOutcrop');
export const roundedBoulder = catalogue.model('roundedBoulder');
export const kokparGoal = catalogue.model('kokparGoal');
export const kokparPost = catalogue.model('kokparPost');
export const stoneStep = catalogue.model('stoneStep');
export const signpostBaked = catalogue.model('signpostBaked');
export const kazan = catalogue.model('kazan');
export const chest = catalogue.model('chest');
export const firewood = catalogue.model('firewood');
export const kumisChurn = catalogue.model('kumisChurn');
export const groundSaddle = catalogue.model('groundSaddle');
export const perchedEagle = catalogue.model('perchedEagle');
export const watchtower = catalogue.model('watchtower');
export const saddledHorse = catalogue.model('saddledHorse');
export const kokparRider = catalogue.model('kokparRider');
export const yurt = catalogue.model('yurt');
export const kunesBridge = catalogue.model('kunesBridge');
export const herdHorse = catalogue.model('herdHorse');
export const snowLotus = catalogue.model('snowLotus');
