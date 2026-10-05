import RuntimePlugin from './runtime/index';

/** Compatibility callers keep the original Pine world and gameplay hooks. */
export class PineHollow extends RuntimePlugin {}

// oxlint-disable-next-line import/no-default-export -- Manifest plugin loaders share a default constructor contract.
export default PineHollow;
