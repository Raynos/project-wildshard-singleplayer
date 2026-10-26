import original from './nalati-specimens-original.json' with {type:'json'};
import {parse,record,string} from 'valibot';
import {SpecimenCatalogueSchema,PackedSpecimenSchema,SpecimenMaterialSchema,SpecimenAssetSchema} from '../../src/format/specimenCatalogue';

/** Complete historical specimen wire, admitted independently of the live far-model file locations. */
export const nalatiSpecimens={catalogue:parse(SpecimenCatalogueSchema,original.catalogue),packed:parse(PackedSpecimenSchema,original.packed),
  materials:parse(record(string(),SpecimenMaterialSchema),original.materials),assets:parse(record(string(),SpecimenAssetSchema),original.assets)};
