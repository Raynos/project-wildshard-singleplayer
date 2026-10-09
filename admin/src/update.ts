interface UpdatePorts { read: () => Promise<unknown>; reload: () => void }
const browserPorts: UpdatePorts = {
  read: async () => {
    const response = await fetch('/version.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`version.json: HTTP ${response.status}`);
    return response.json() as Promise<unknown>;
  },
  reload: () => { window.location.reload(); },
};
/** The home-screen PWA has no browser chrome: always expose reload, and check new data on foreground / every 5 min. */
export function installUpdates(build: string, ports?: UpdatePorts): () => void {
  const io = ports ?? browserPorts;
  const banner = document.getElementById('data-update'), reload = document.getElementById('reload');
  const abort = new AbortController();
  let checking = false, newer = false, disposed = false, reloading = false;
  const active = (): boolean => !disposed;
  const check = async (): Promise<void> => {
    if (disposed || checking || newer || !navigator.onLine) return;
    checking = true;
    try {
      const version = await io.read();
      if (active() && typeof version === 'object' && version !== null && 'build' in version
        && typeof version.build === 'string' && version.build !== '' && version.build !== build) {
        newer = true;
        if (banner) banner.hidden = false;
      }
    } catch { /* Offline: the reload button stays available and the next foreground check can try again. */ }
    finally { checking = false; }
  };
  const update = (): void => {
    if (reloading) return;
    reloading = true;
    io.reload();
  };
  for (const button of [reload, banner]) {
    button?.addEventListener('pointerup', update, { signal: abort.signal });
    button?.addEventListener('click', update, { signal: abort.signal });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check();
  }, { signal: abort.signal });
  window.addEventListener('pageshow', () => { void check(); }, { signal: abort.signal });
  const timer = window.setInterval(() => { void check(); }, 5 * 60 * 1000);
  void check();
  return () => { disposed = true; abort.abort(); window.clearInterval(timer); };
}
