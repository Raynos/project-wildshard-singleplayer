/** Screen wake lock while playing: the display never dims mid-hunt. */
export class KeepAlive {
  wakeLock: 'ok' | 'failed' | 'unsupported' | 'off' = 'off';

  /** call from a user gesture (ENTER WORLD) — both APIs need one */
  async start(): Promise<void> {
    if (!('wakeLock' in navigator)) this.wakeLock = 'unsupported';
    else {
      try { const l = await navigator.wakeLock.request('screen'); this.wakeLock = 'ok'; l.addEventListener('release', () => { this.wakeLock = 'off'; }); } catch { this.wakeLock = 'failed'; }
    }
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && this.wakeLock !== 'unsupported') void this.start(); }); // locks are released on hide
  }

  describe(): string { return `wakeLock ${this.wakeLock}`; }
}
