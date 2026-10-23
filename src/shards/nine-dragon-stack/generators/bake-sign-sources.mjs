// Portable product assembly from the retained native rasters and vertex bytes.
import { signAtlasBlobs } from './signAtlasOutput.ts';

/** The existing SDK file driver supplies confined source reads and writes. */
export function signSources(read) {
  const files = new Map(), rows = {};
  const blobs = signAtlasBlobs(file => read(`src/shards/nine-dragon-stack/data/${file}`));
  const sources = blobs.map(({ file, bytes }, index) => {
    const source = `data/signSource-${index}.generated.${file.kind}`;
    files.set(source, bytes);
    for (const tier of ['phone', 'desktop']) if (file.name === `signs/atlas-${tier}.json`) rows[tier] = JSON.parse(new TextDecoder().decode(bytes));
    const { name, kind, decoded, gpu, triangles, draws, critical, dependencies } = file;
    return { name, kind, source, options: { decoded, gpu, triangles, draws, critical, dependencies } };
  });
  files.set('data/signSources.generated.json', new TextEncoder().encode(`${JSON.stringify({ sources, rows })}\n`));
  return files;
}
