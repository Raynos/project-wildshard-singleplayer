import * as v from 'valibot';
import { isJsonData } from './json';
import { CatalogueIconSchema } from './items';

const text=v.pipe(v.string(),v.minLength(1),v.maxLength(512)),count=v.pipe(v.number(),v.safeInteger(),v.minValue(0),v.maxValue(256));
const flags=v.union([v.pipe(v.array(text),v.maxLength(256)),v.strictObject({prefix:text,count})]);
const item={label:text,icon:CatalogueIconSchema,prize:v.exactOptional(v.pipe(v.array(text),v.maxLength(16)))};
/** Static sticker metadata and native flag/ownership identities; no readers. */
export const FindsCatalogueSchema: v.GenericSchema<FindsCatalogueDataInput, FindsCatalogueData>=v.pipe(v.unknown(),v.check(isJsonData),v.strictObject({
  counters:v.pipe(v.array(v.strictObject({label:text,flags})),v.maxLength(32)),
  sections:v.pipe(v.array(v.strictObject({title:text,dense:v.exactOptional(v.boolean()),wide:v.exactOptional(v.boolean()),
    items:v.pipe(v.array(v.union([v.strictObject({...item,flag:text}),v.strictObject({...item,owned:text})])),v.maxLength(256))})),v.maxLength(32)),
  glass:v.exactOptional(v.strictObject({flags,colors:v.pipe(v.array(text),v.minLength(1),v.maxLength(256)),fallback:text})),
  next:v.exactOptional(v.strictObject({counter:count,every:v.pipe(count,v.minValue(1)),max:count,text})),
}));

/** Admit JSON before constructing the existing live catalogue projection. */
export function parseFindsCatalogue(input:unknown):FindsCatalogueData{return v.parse(FindsCatalogueSchema,input);}

/** Admitted data contracts, independent of validator implementation metadata. */
export type FindsCatalogueDataInput = unknown;
interface FindsCatalogueDataFields {
    counters: ({
        label: string;
        flags: ((string)[]) | ({
            prefix: string;
            count: number;
        });
    })[];
    sections: ({
        title: string;
        dense?: boolean;
        wide?: boolean;
        items: ((Omit<{
            label: string;
            icon: v.InferOutput<typeof CatalogueIconSchema>;
            prize?: (string)[];
        }, keyof ({
            flag: string;
        })> & {
            flag: string;
        }) | (Omit<{
            label: string;
            icon: v.InferOutput<typeof CatalogueIconSchema>;
            prize?: (string)[];
        }, keyof ({
            owned: string;
        })> & {
            owned: string;
        }))[];
    })[];
    glass?: {
        flags: ((string)[]) | ({
            prefix: string;
            count: number;
        });
        colors: (string)[];
        fallback: string;
    };
    next?: {
        counter: number;
        every: number;
        max: number;
        text: string;
    };
}
export type FindsCatalogueData = { [Key in keyof FindsCatalogueDataFields]: FindsCatalogueDataFields[Key] };
