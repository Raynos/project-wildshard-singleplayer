import { parse } from 'valibot';
import { SpecimenBookSchema, type SpecimenBookRows, type SpecimenModelMetadataRows } from '@wildshard/format/specimenCatalogue';
import { namedJsonSchema } from '../formatJsonSchema';
import { encodeCanonicalJson } from '../immutable';
import { nameBlob, type NamedBlob, type BlobOptions } from '../blobs';

/** A build-time catalogue: admitted rows and metadata, without runtime registration or model construction. */
export interface AuthoredSpecimenCatalogue {
  readonly book: SpecimenBookRows;
  readonly model: (key: string) => SpecimenModelMetadataRows;
}

/** Admit a complete specimen book once; model lookups retain its ordered authored metadata. */
export function defineSpecimenCatalogue(input: unknown): AuthoredSpecimenCatalogue {
  const book = parse(SpecimenBookSchema, input), models = new Map<string, SpecimenModelMetadataRows>();
  for (const row of book.rows) {
    if (models.has(row.key)) throw new Error(`Duplicate authored specimen ${row.key}`);
    models.set(row.key, row.model);
  }
  return { book, model(key) {
    const model = models.get(key);
    if (model === undefined) throw new Error(`Missing authored specimen ${key}`);
    return model;
  } };
}

/** Emit admitted book data with its defining schema and caller-owned tier/dependencies. */
export function nameSpecimenBook(name: string, input: unknown, options: Pick<BlobOptions, 'tier' | 'dependencies'> = {}): NamedBlob {
  const book = defineSpecimenCatalogue(input).book;
  return nameBlob(name, 'json', new TextEncoder().encode(encodeCanonicalJson(book)), {
    ...options, jsonSchema: namedJsonSchema(SpecimenBookSchema),
  });
}
