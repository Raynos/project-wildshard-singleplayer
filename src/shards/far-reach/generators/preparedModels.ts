import { PREPARED_MODEL_INPUTS, preparedModelSource } from './preparedModelProgram';

/** The offline predecessor fixture consumes the defining owned source program. */
export function bakePreparedModels(read: (url: string) => Uint8Array): Promise<Uint8Array> {
  return preparedModelSource(new Map(PREPARED_MODEL_INPUTS.map(url => [url, read(url)])));
}

