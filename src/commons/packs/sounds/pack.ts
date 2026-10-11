import type { CommonsPack } from '@wildshard/sdk/commons';

/** The three shared score recordings; optional shard-specific stings are not part of this pack. */
export interface ScoreStingsSource { stings: { pickup: string; death: string; chunk: string } }

/** Read existing encoded recordings into a v1 pack; never decode, resample or change playback metadata. */
export async function scoreStingsPack(style: string, source: ScoreStingsSource,
  read: (file: string) => Promise<Uint8Array>, provenance: { credit: string; licence: string }): Promise<CommonsPack> {
  if (!/^[a-z][a-z0-9-]{0,63}$/u.test(style)) throw new Error('Invalid score style');
  const rows = (['pickup', 'death', 'chunk'] as const).map(id => {
    const file = source.stings[id];
    if (!/^[a-z0-9][a-z0-9-]{0,120}\.(?:m4a|wav)$/u.test(file)) throw new Error('Score sting must name a local recording');
    return { id, file };
  });
  // Validate every path before the reader performs any I/O. Ordered results are deterministic.
  const entries = await Promise.all(rows.map(async ({ id, file }) => ({ id, kind: 'audio' as const,
    bytes: (await read(file)).slice(), credit: provenance.credit, licence: provenance.licence })));
  return { id: `score-stings/${style}`, version: '1.0.0', entries };
}
