import { NdPlugin } from '../plugin';

/** Trusted legacy fragment entry; SF29 moves only its audio policy into data. */
// oxlint-disable-next-line import/no-default-export -- First-party loader requires its registered runtime entry constructor.
export default class NdAudioRuntime extends NdPlugin {}
