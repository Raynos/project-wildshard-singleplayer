import { NalatiPlugin } from '../plugin';

/** Trusted legacy world entry; SF29 moves only its audio policy into format data. */
// oxlint-disable-next-line import/no-default-export -- The first-party loader requires its runtime entry constructor.
export default class NalatiRuntime extends NalatiPlugin {}
