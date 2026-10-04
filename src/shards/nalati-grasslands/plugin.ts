import RuntimePlugin from './runtime/index';

/** The ordinary manifest keeps the original trusted plugin hooks after their imports-only extraction. */
export class NalatiPlugin extends RuntimePlugin {}

// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default NalatiPlugin;
