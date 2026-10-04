import LegacyPlugin from '../plugin';

/** Explicit first-party continuation entry; the legacy manifest still chooses the same plugin. */
class PineRuntime extends LegacyPlugin {}
// oxlint-disable-next-line import/no-default-export -- The declared trusted runtime loader consumes a constructor.
export default PineRuntime;
