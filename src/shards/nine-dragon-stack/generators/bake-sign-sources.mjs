// Portable product assembly from the retained native rasters and vertex bytes.
import { nineSignSourceFiles } from './signsProgram.ts';

/** The existing SDK file driver supplies confined source reads and writes. */
export function signSources(read) {
  return nineSignSourceFiles(file => read(`src/shards/nine-dragon-stack/data/${file}`));
}
