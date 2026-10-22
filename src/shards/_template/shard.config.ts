// oxlint-disable-next-line unicorn/prefer-export-from -- E434 forbids re-export barrels.
import product from './generators/product';
import { BUILD_OPTIONS } from './generators/buildOptions';

// Edit the build-time declaration to author this project's data.
// oxlint-disable-next-line import/no-default-export -- The author CLI loads this project entry.
export default product;

/** Explicit standalone AssemblyScript policy, consumed only by the author build. */
export const buildOptions = { ...BUILD_OPTIONS };
