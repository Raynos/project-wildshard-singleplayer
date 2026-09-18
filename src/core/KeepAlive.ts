/** Screen wake lock while playing: the display never dims mid-hunt. */
export class KeepAlive {
  wakeLock: 'ok' | 'failed' | 'unsupported' | 'off' = 'off';
  private lock?: { release(): Promise<void> };

  /** call from a user gesture (ENTER WORLD) — both APIs need one */
  async start() {
    const nav = navigator as unknown as { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void>; addEventListener(t: string, f: () => void): void }> } };
    if (!nav.wakeLock) this.wakeLock = 'unsupported';
    else {
      try { const l = await nav.wakeLock.request('screen'); this.lock = l; this.wakeLock = 'ok'; l.addEventListener('release', () => { this.wakeLock = 'off'; }); } catch { this.wakeLock = 'failed'; }
    }
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && this.wakeLock !== 'unsupported') this.start(); }); // locks are released on hide
  }

  describe() { return `wakeLock ${this.wakeLock}`; }
}
