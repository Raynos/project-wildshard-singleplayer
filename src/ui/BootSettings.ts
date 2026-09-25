/**
 * Main menu ▸ SETTINGS (E55): the picks that are read once while the page loads — renderer, quality tier, render scale,
 * anti-aliasing, touch controls — with APPLY & RELOAD. The title's SETTINGS link (src/ui/HUD.ts showIntro) opens it.
 * The live toggles (audio, look speed, time of day, painted horizon) are the pause menu's (src/ui/Menu.ts); the user,
 * 2026-09-23: "Settings in the main menu can be different from settings in the pause menu, to reduce chaos."
 *
 *   openBootSettings()   // one overlay on <body>, built on first open; Close / Esc / the backdrop close it
 *
 * Every pick is saved at once (src/ui/Settings.ts OPTIONS, src/core/tier.ts gfxPrefs) but only a reload builds it:
 * APPLY & RELOAD loads the page without the URL params that would override the saved picks (`settingsReloadUrl`) nor the
 * ones that skip the title, so the reload lands back on this title screen. Reuses the in-game menu's look (gmenu.css).
 */
import { AUTO_TIER, TIER, gfxPrefs, saveGfxPrefs } from '../core/tier';
import { RELOAD_PARAM } from '../core/GpuRecovery';
import { getActiveChunk } from '../chunks/registry';
import { askReload } from './ReloadPrompt';
import { devSwitchRows } from './devSwitch';
import { MUSIC_CREDIT, sfxCredit } from '../audio/credits';
import { BOOT_OPTIONS, getSfxSet, pendingReload, saveSetting, savedSetting, setting, settingFromUrl, settingParams, settingsReloadUrl, type OptionKey, type OptionValue } from './Settings';

const el = (cls: string, html = '', tag = 'div'): HTMLElement => { const e = document.createElement(tag); e.className = cls; if (html) e.innerHTML = html; return e; };

type BootKey = 'tier' | 'gpu' | 'touch';
interface Row<K extends BootKey> { label: string; experimental?: boolean; options: { v: OptionValue<K>; text: string }[] }
const LABELS: { [K in BootKey]: Row<K> } = {
  tier: { label: 'Quality', options: [{ v: 'auto', text: `Auto · ${AUTO_TIER}` }, { v: 'phone', text: 'Phone' }, { v: 'desktop', text: 'Desktop' }] },
  gpu: { label: 'Renderer', experimental: true, options: [{ v: 'webgl', text: 'WebGL' }, { v: 'webgpu', text: 'WebGPU' }, { v: 'webgpu-gl', text: 'WebGPU · GL' }] },
  touch: { label: 'Touch controls', options: [{ v: 'auto', text: 'Auto' }, { v: 'on', text: 'Always' }] },
};
const optionLabel = (k: OptionKey): string => (k === 'tier' || k === 'gpu' || k === 'touch' ? LABELS[k].label : k);
const NAMES: Record<string, string> = { webgl: 'WebGL', webgpu: 'WebGPU', 'webgpu-gl': 'WebGPU · GL' };
/** the render scale / AA picks this page was built with (tier.ts applied them at import) */
const BOOT_GFX = { ...gfxPrefs };
/** params that skip the title (dev / deep links): APPLY & RELOAD lands on the title screen */
const TITLE_SKIPPERS = ['skipintro', 'tour', 'explore', 'cam', 'model', 'at', RELOAD_PARAM, 'v'];

let root: HTMLElement | undefined;

export function openBootSettings(): void {
  const r = root ?? build();
  root = r;
  r.classList.add('show');
  r.inert = false;
}

function close(): void {
  if (!root) return;
  root.classList.remove('show');
  root.inert = true;
}

function build(): HTMLElement {
  const r = el('ws-gmenu');
  r.inert = true;
  const sheet = el('ws-gmenu-sheet ws-glass');
  sheet.innerHTML = `
    <div class="ws-gmenu-head">
      <div><div class="ws-gmenu-title">Settings</div><div class="ws-gmenu-sub">Main menu · applies on reload</div></div>
      <button class="ws-gmenu-close" type="button">Close</button>
    </div>`;
  const body = el('ws-gmenu-body');
  const p = el('ws-gmenu-panel scroll active');
  p.dataset['scroll'] = ''; // index.html swallows touchmove outside [data-scroll]
  body.append(p);
  sheet.append(body, el('ws-gmenu-hint', 'Sound, look speed, time of day: pause menu ▸ Settings'));
  r.append(sheet);
  document.body.append(r);

  const running = el('ws-gmenu-note');
  const gpuNow = getActiveChunk().style === 'painterly' ? 'webgl' : setting('gpu'); // Nalati always runs WebGL (Game.ts, NALATI-MERGE F1)
  running.textContent = `Running now: ${NAMES[gpuNow] ?? gpuNow} · ${TIER} quality`;
  const status = el('ws-gmenu-note');
  const apply = el('ws-gmenu-btn resume', 'Apply &amp; reload', 'button') as HTMLButtonElement; apply.type = 'button';
  const paints: (() => void)[] = [];
  const repaint = (): void => {
    for (const f of paints) f();
    const pending: string[] = pendingReload().map(optionLabel);
    if (gfxPrefs.dpr !== BOOT_GFX.dpr) pending.push('Render scale');
    if (gfxPrefs.aa !== BOOT_GFX.aa) pending.push('Anti-aliasing');
    status.textContent = pending.length > 0 ? `Reload to apply: ${pending.join(', ')}.` : 'Every pick above is running now.';
    apply.classList.toggle('exit', pending.length === 0);
  };

  const seg = (label: string, experimental: boolean, options: { v: string; text: string }[], get: () => string, set: (v: string) => void): HTMLElement => {
    const row = el('ws-gmenu-row', `<span class="ws-gmenu-swlabel">${label}${experimental ? ' <i class="ws-gmenu-chip exp">Experimental</i>' : ''}</span>`);
    const box = el('ws-gmenu-seg');
    for (const o of options) {
      const b = el('ws-gmenu-segbtn', o.text, 'button') as HTMLButtonElement; b.type = 'button'; b.dataset['v'] = o.v;
      b.addEventListener('click', () => { set(o.v); repaint(); });
      box.append(b);
    }
    paints.push(() => { for (const c of box.children) (c as HTMLElement).classList.toggle('active', (c as HTMLElement).dataset['v'] === get()); });
    row.append(box);
    return row;
  };
  const row = <K extends BootKey>(k: K, spec: Row<K>): HTMLElement =>
    seg(spec.label, spec.experimental === true, spec.options, () => savedSetting(k), (v) => { const o = spec.options.find((x) => x.v === v); if (o) { saveSetting(k, o.v); if (o.v !== setting(k)) askReload(document.body, spec.label); } });

  const dprOpts = [{ v: '1', text: '1.0×' }, { v: '1.25', text: '1.25×' }, { v: '1.5', text: '1.5×' }, { v: '2', text: '2×' }, { v: 'native', text: 'Native' }, { v: 'auto', text: 'Auto' }];
  const aaOpts = [{ v: 'on', text: 'On' }, { v: 'off', text: 'Off' }, { v: 'auto', text: 'Auto' }];
  p.append(running,
    el('ws-gmenu-label', 'Graphics'), row('tier', LABELS.tier),
    seg('Render scale', false, dprOpts, () => gfxPrefs.dpr, (v) => { if (v === 'auto' || v === '1' || v === '1.25' || v === '1.5' || v === '2' || v === 'native') { gfxPrefs.dpr = v; saveGfxPrefs(); if (v !== BOOT_GFX.dpr) askReload(document.body, 'Render scale'); } }),
    seg('Anti-aliasing', false, aaOpts, () => gfxPrefs.aa, (v) => { if (v === 'auto' || v === 'on' || v === 'off') { gfxPrefs.aa = v; saveGfxPrefs(); } }),
    el('ws-gmenu-label', 'Experimental'), row('gpu', LABELS.gpu),
    el('ws-gmenu-label', 'Controls'), row('touch', LABELS.touch),
    ...devSwitchRows()); // developer mode (E140): live, no reload
  // the agents' screenshot URLs carry params that win over the saved picks for that load: say so
  const overridden = BOOT_OPTIONS.filter((k) => settingFromUrl(k));
  if (overridden.length > 0) p.append(el('ws-gmenu-note', `This load’s address sets ${overridden.map((k) => `${optionLabel(k)} (?${settingParams(k).join(' / ?')})`).join(', ')}; Apply &amp; reload drops it.`));
  p.append(status, apply);
  // credits (E64 — Jake: "get that music attribution out of here and move it to a dedicated credits page"): the title used to
  // print them under the cards; they live here now, and in the pause menu ▸ Settings ▸ Audio next to the pickers
  p.append(el('ws-gmenu-label', 'Credits'), ...[MUSIC_CREDIT, sfxCredit(getSfxSet())].filter((t) => t !== '').map((t) => el('ws-gmenu-note', t)));

  apply.addEventListener('click', () => {
    const next = settingsReloadUrl(location.href, TITLE_SKIPPERS);
    if (next === location.href) location.reload(); else location.replace(next);
  });
  const closeBtn = sheet.querySelector('.ws-gmenu-close');
  closeBtn?.addEventListener('click', close);
  r.addEventListener('pointerdown', (e) => { if (e.target === r) close(); });
  // the title's "any key enters" listens on document: while this is open, keys stop here (Esc closes)
  window.addEventListener('keydown', (e) => {
    if (!r.classList.contains('show')) return;
    e.stopPropagation();
    if (e.code === 'Escape') { e.preventDefault(); close(); }
  }, true);
  repaint();
  return r;
}
