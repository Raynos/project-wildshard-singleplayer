import { dbg } from '../ui/Debug';

/**
 * Two "don't suspend me" attempts for the iOS home-screen app, both reported in the resume modal:
 *  - a screen wake lock while playing (the display never dims mid-hunt; also a hint that we're active)
 *  - optional keep-alive audio (DBG "keep"): a silent looping <audio> element. On some iOS builds a
 *    web app that is playing audio keeps its content process warm across an app switch, which is
 *    exactly the difference between a 2 s black restore and an instant one. Off by default.
 */
export class KeepAlive {
  wakeLock: 'ok' | 'failed' | 'unsupported' | 'off' = 'off';
  audio: 'playing' | 'blocked' | 'off' = 'off';
  private lock?: { release(): Promise<void> };
  private el?: HTMLAudioElement;

  /** call from a user gesture (ENTER WORLD) — both APIs need one */
  async start() {
    const nav = navigator as unknown as { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void>; addEventListener(t: string, f: () => void): void }> } };
    if (!nav.wakeLock) this.wakeLock = 'unsupported';
    else {
      try { const l = await nav.wakeLock.request('screen'); this.lock = l; this.wakeLock = 'ok'; l.addEventListener('release', () => { this.wakeLock = 'off'; }); } catch { this.wakeLock = 'failed'; }
    }
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && this.wakeLock !== 'unsupported') this.start(); }); // locks are released on hide
    if (dbg.keepalive) this.startAudio();
  }

  startAudio() {
    if (this.el) return;
    // 1 s of silence as a WAV data URL, looped
    const rate = 8000, n = rate, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
    const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); str(36, 'data'); v.setUint32(40, n, true);
    for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
    const el = document.createElement('audio');
    el.src = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })); el.loop = true; el.volume = 0.01;
    el.setAttribute('playsinline', ''); el.style.display = 'none';
    document.body.appendChild(el);
    el.play().then(() => { this.audio = 'playing'; }, () => { this.audio = 'blocked'; });
    this.el = el;
  }

  describe() { return `wakeLock ${this.wakeLock} · keep-alive audio ${this.audio}`; }
}
