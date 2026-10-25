import { assembleOutputShardfile, parseOutputDescriptorIndex } from '@wildshard/format/outputIndex';
import { loadingStage, loadingUnits, waitFor } from '@wildshard/engine/boot/waits';
import { validateCustomSchema, validateCustomSchemaPaced, validateNamedJsonSchemaPaced } from './customSchema';
import type { OutputDescriptorChecks, OutputDescriptorReader } from './outputDescriptor';
import type { NamedJsonCheck } from './namedJsonChecks';

/** Preserve named-JSON validation in native author bundles, regardless of their
 * build tool's browser-shaped constants. */
export const nodeNamedJsonCheck: NamedJsonCheck = (schema, bytes, pause) => validateNamedJsonSchemaPaced(schema, bytes, pause);

// Independent checked readers share the original schema queue; a caller's paint
// policy cannot refill one interval with several complete schema compilations.
let schemaChecks = Promise.resolve();
function checkCustomSection(work: () => unknown, pause: OutputDescriptorReader['pause']): Promise<unknown> {
  if (pause === undefined) return Promise.resolve().then(work);
  const checked = schemaChecks.then(async () => {
    await pause();
    const value = await loadingStage('admission', work);
    await pause();
    return value;
  });
  schemaChecks = checked.then(() => undefined, () => undefined);
  return checked;
}

/** Explicit native/author capability. The browser's default descriptor reader
 * refuses unproved data instead of importing this checked ingestion closure. */
export const nodeOutputDescriptorChecks: OutputDescriptorChecks = {
  parseIndex(input) { return parseOutputDescriptorIndex(input); },
  assemble(index, sections) { return assembleOutputShardfile(index, sections); },
  async custom(index, sections, schemas, pause) {
    const custom = index.sections.filter(row => row.name.startsWith('custom/'));
    if (custom.length === 0) return;
    await loadingStage('admission', async () => {
      const progress = loadingUnits('Product schemas', custom.length);
      progress(0);
      for (const [at, row] of custom.entries()) {
        await waitFor(`Validate ${row.name}`, checkCustomSection(async () => {
          const value = pause === undefined
            ? validateCustomSchema(schemas.get(row.schema), sections.get(row.name))
            : await validateCustomSchemaPaced(schemas.get(row.schema), sections.get(row.name), pause);
          progress(at + 1, row.name);
          return value;
        }, pause), 'admission');
      }
    });
  },
};
