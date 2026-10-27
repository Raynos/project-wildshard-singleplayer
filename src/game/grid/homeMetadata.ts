import type { SessionState } from '../session/context';

interface MetadataOwner { readonly disposed: boolean; onDispose: (release: () => void) => void }
interface MetadataLease { readonly release: () => void }

/** Match the original initial-home entry condition; road recovery needs no home. */
export function initialHomeMetadataRequired(session: Pick<SessionState, 'ownedGridHome' | 'recovery'>): boolean {
  return session.ownedGridHome === true && (session.recovery === undefined || session.recovery.saved?.location.kind === 'cell');
}

/** Start only a known initial home's required metadata. Keep its original
 * rejection for the Home barrier, and its one real lease on the page owner. */
export function prepareHomeMetadata(owner: MetadataOwner, read: () => Promise<MetadataLease | null> | null): Promise<void> {
  const ready = Promise.resolve().then(() => {
    if (owner.disposed) throw new Error('Initial home metadata owner left');
    return read();
  }).then(metadata => {
    if (metadata === null) return undefined;
    if (owner.disposed) { metadata.release(); throw new Error('Initial home metadata owner left'); }
    owner.onDispose(metadata.release);
    return undefined;
  });
  // The consumer still awaits this exact rejected promise at its original
  // barrier. An earlier page-setup failure cannot leave an unhandled rejection.
  void ready.catch(() => undefined);
  return ready;
}
