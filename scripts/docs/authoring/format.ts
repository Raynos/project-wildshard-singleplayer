import { Director } from '@wildshard/sdk/director';
import { DirectorStagesSchema, parseDirectorStages } from '@wildshard/format/directorStages';
import { formatJsonSchema } from '@wildshard/sdk/formatJsonSchema';

/** A structural editor schema plus the defining admission verdict for Template 1's first stage. */
export function formatExample() {
  const row = new Director({ id: 'template.door-wave', inputs: {}, stages: [{ id: 'door' }] }).toJSON();
  return { schema: formatJsonSchema(DirectorStagesSchema), row: parseDirectorStages(row) };
}
