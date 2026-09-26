// debug-settings.mjs — set pause ▸ Settings ▸ Debug options before the game page loads (E162: the game reads no URL
// switches; a variant is a saved option, src/ui/Settings.ts OPTION_VALUES, declared in src/ui/debugOptions.ts).
//
//   import { debugSettings } from './debug-settings.mjs';
//   const page = await context.newPage();
//   await debugSettings(page, { creatures: 'proc', lut: 'off' });   // merged into localStorage ws.settings.v1 on every load
//   await page.goto(url);
//
// Works on a Playwright Page or BrowserContext (anything with addInitScript). The picks merge over what is saved.

/** @param {{ addInitScript: (fn: (p: Record<string, string | boolean | number>) => void, arg: Record<string, string | boolean | number>) => Promise<void> }} target */
export async function debugSettings(target, picks) {
  await target.addInitScript((p) => {
    try {
      const key = 'ws.settings.v1';
      const cur = JSON.parse(localStorage.getItem(key) ?? '{}');
      localStorage.setItem(key, JSON.stringify({ ...cur, ...p }));
    } catch { /* storage blocked: the defaults */ }
  }, picks);
}
