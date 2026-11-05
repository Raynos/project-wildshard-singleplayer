/**
 * Native app lifecycle (docs/plans/NATIVE-APPS.md N-A) → the game's own DOM events, so nothing in the game
 * imports Capacitor:
 *
 *   app backgrounded   → `ws:background` (HUD pauses into the menu if riding) + flush the save mirror
 *   Android Back       → `ws:back`, cancelable: the HUD calls preventDefault() when it used the press (closed the
 *                        menu / paused); an unused Back (title screen) minimizes the app, like any Android game
 */
import { App } from '@capacitor/app';
import { flushSaves } from './saves';

export async function installLifecycle(): Promise<void> {
  await App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) return;
    document.dispatchEvent(new Event('ws:background'));
    void flushSaves();
  });
  await App.addListener('backButton', () => {
    const used = !document.dispatchEvent(new Event('ws:back', { cancelable: true }));
    if (!used) void App.minimizeApp();
  });
}
