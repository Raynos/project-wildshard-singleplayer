#!/usr/bin/env node
/**
 * check-css — every UI screen owns one stylesheet and one class prefix; a class may only be DEFINED in the
 * file that owns its prefix. Runs as `prebuild` (pnpm runs it before `pnpm build`) and standalone:
 *
 *   node scripts/check-css.mjs            # exit 1 on a strict violation, 0 otherwise
 *
 * Rules, per file in FILES (`@keyframes` bodies are skipped):
 *   1. every `.ws-*` class token anywhere in a selector must be a shared primitive (SHARED, defined only in
 *      base.css) or carry a prefix of SOME screen file — cross-screen references are fine
 *      (`.ws-game-prompt.show ~ .ws-touch .ws-touch-btn.use` is legal in touch.css);
 *   2. the rule's subject — the rightmost compound that carries a `.ws-*` class — must belong to THIS file's
 *      prefix (or its root: `.ws-menu` for `ws-menu-`). The one exception is a shared primitive scoped under
 *      this file's own prefix (`.ws-game-health .ws-label { … }`), which is an override, not a definition;
 *   3. base.css may only define SHARED classes (and the page resets); a screen file may not have a selector
 *      without any `.ws-*` class;
 *   4. no `.ws-*` class is defined by more than one file;
 *   5. (warn) every `ws-*` string literal in src/**\/*.ts must be a class some stylesheet defines — typo guard.
 *
 * Bare state classes (`.selected`, `.show`, `.on`, `.down`, …) are ignored: they only ever ride on a prefixed
 * element (`.ws-menu-card.selected`) and the lint only looks at `ws-` tokens.
 *
 * WARN-mode files print their violations but never fail the build — that is the loading screen, which is
 * mid-rename by its owner, and perf.css, whose one stray rule is reported below.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

/** shared primitives — the only unprefixed classes, and only base.css may define them */
const SHARED = new Set(['ws-glass', 'ws-label', 'ws-mono', 'ws-display', 'ws-wordmark', 'ws-bar']);

/** file → { prefix, strict }. `prefix: null` = base.css (shared list only). */
const FILES = [
  { file: join(ROOT, 'src/engine/ui/styles/base.css'), prefix: null, strict: true },
  { file: join(ROOT, 'src/engine/ui/styles/game.css'), prefix: 'ws-game-', strict: true },
  { file: join(ROOT, 'src/engine/ui/styles/menu.css'), prefix: 'ws-menu-', strict: true },
  { file: join(ROOT, 'src/engine/ui/styles/gmenu.css'), prefix: 'ws-gmenu-', strict: true }, // the in-game menu (src/engine/ui/Menu.ts): map / inventory / achievements / settings
  { file: join(ROOT, 'src/engine/ui/styles/touch.css'), prefix: 'ws-touch-', strict: true },
  { file: join(ROOT, 'src/engine/ui/styles/update.css'), prefix: 'ws-update-', strict: true },
  { file: join(ROOT, 'src/engine/ui/styles/minimap.css'), prefix: 'ws-minimap-', strict: true },
  { file: join(ROOT, 'src/engine/ui/styles/combat.css'), prefix: 'ws-combat-', strict: true }, // hunting feedback (src/engine/ui/Combat.ts), imported by the module
  { file: join(ROOT, 'src/engine/ui/styles/feedback.css'), prefix: 'ws-fb-', strict: true }, // the review inbox: ✎ disc + the lazy composer (src/engine/ui/review.ts, Feedback.ts)
  { file: join(ROOT, 'src/shards/nalati-grasslands/stealth.css'), prefix: 'ws-stealth-', strict: true }, // Nalati grass stealth: the eye pip, GRASS meter, vignette (src/shards/nalati-grasslands/stealth.ts, B9)
  { file: join(ROOT, 'src/engine/ui/styles/boss.css'), prefix: 'ws-boss-', strict: true }, // the boss system (src/engine/ui/BossBar.ts, src/game/Boss.ts): the wide top bar, name / retry / reward cards
  { file: join(ROOT, 'src/engine/ui/styles/elite.css'), prefix: 'ws-elite-', strict: true }, // named elites (src/engine/ui/EliteBar.ts, src/game/Elite.ts): the named bar, the NEARBY banner, the edge chevron, the minimap skulls
  { file: join(ROOT, 'src/engine/ui/styles/explore.css'), prefix: 'ws-x-', strict: true }, // Explore World, the viewer (src/engine/explore/Explore.ts), imported by the lazy chunk
  { file: join(ROOT, 'src/engine/ui/styles/rotate.css'), prefix: 'ws-rotate-', strict: true }, // the portrait-only gate on landscape phones (index.html, src/engine/ui/RotateGate.ts)
  { file: join(ROOT, 'src/engine/ui/styles/quest.css'), prefix: 'ws-quest-', strict: true }, // the adventure layer: objective line, NPC dialogue, reward caption (src/game/quest/*)
  { file: join(ROOT, 'src/game/complete/complete.css'), prefix: 'ws-complete-', strict: true }, // the "<shard> complete" card (src/game/complete/ShardComplete.ts, E132)
  { file: join(ROOT, 'src/engine/ui/styles/resume.css'), prefix: 'ws-resume-', strict: true }, // the app-switch resume screen (src/engine/ui/Resume.ts, index.html; E54 / E61)
  { file: join(ROOT, 'src/game/compendium/compendium.css'), prefix: 'ws-cmp-', strict: true }, // the Compendium: the book + its skins, the trophy wall's tip, the journal disc (src/ui/compendium/*)
  { file: join(ROOT, 'src/shards/pine-hollow/quest/pinehollow.css'), prefix: 'ws-ph-', strict: true }, // Pine Hollow's hamlet screens + the collectibles counter (src/shards/pine-hollow/quest/ui.ts)
  { file: join(ROOT, 'src/engine/ui/styles/debug.css'), prefix: 'ws-dbg-', strict: true }, // pause ▸ Settings ▸ Debug's groups (src/engine/ui/DebugMenu.ts, the registry src/engine/ui/debugOptions.ts; E162)
  { file: join(ROOT, 'src/engine/ui/styles/playgrounds.css'), prefix: 'ws-pg-', strict: true }, // the feature playgrounds' run chip (src/engine/practice/playground/hud.ts, E307)
  { file: join(ROOT, 'src/engine/ui/styles/hints.css'), prefix: 'ws-hint-', strict: true }, // first-time control hints on the touch controls (src/engine/ui/FirstHints.ts, E308)
  { file: join(ROOT, 'src/game/loot/loot.css'), prefix: 'ws-loot-', strict: true }, // the purse on the HUD: the coin chip + the "+n" pop (src/game/loot/CoinChip.ts, E314)
  { file: join(ROOT, 'src/engine/ui/styles/itemcard.css'), prefix: 'ws-icard-', strict: true }, // the big item card: shop tiles + the pickup card (src/engine/ui/ItemCard.ts, SF28 / G87)
  { file: join(ROOT, 'src/game/loot/ui/shop.css'), prefix: 'ws-shop-', strict: true }, // the trader's counter on Driftwood (src/shards/driftwood-isle/loot/ShopPanel.ts, E314 stage 2)
  { file: join(ROOT, 'src/game/saves.css'), prefix: 'ws-saves-', strict: true }, // pause ▸ Settings ▸ SAVES and the New game sheet (src/game/savesSettings.ts, SF33b / G83)
  { file: join(ROOT, 'src/game/grid/gridHud.css'), prefix: 'ws-grid-', strict: true }, // the grid's HUD moments: the sky-down reveal, SAFE ZONE, the title card, speed lines (src/game/grid/reveal.ts, gridHud.ts; SF21a / SF20a)
  // loading screen: owned by src/engine/ui/Loading.ts — warn only while its owner finishes the ws-load-* rename
  { file: join(ROOT, 'src/engine/ui/loading.css'), prefix: 'ws-load-', strict: false },
  // frame meter (src/engine/ui/Perf.ts) — warn only; not part of the HUD split
  { file: join(ROOT, 'src/engine/ui/perf.css'), prefix: 'ws-perf-', strict: false },
];

/** `ws-` strings in TS that are not CSS classes (event names) or are JS-only hooks with no rule */
const NOT_CLASSES = new Set(['ws-sw-waiting']);

const PREFIXES = FILES.map((f) => f.prefix).filter(Boolean);
const rootOf = (prefix) => prefix.slice(0, -1); // 'ws-menu-' → 'ws-menu'
/** @param {string} cls */
const ownerOf = (cls) => {
  if (SHARED.has(cls)) return 'shared';
  return PREFIXES.find((p) => cls.startsWith(p) || cls === rootOf(p)) ?? null;
};

// ── tiny CSS walker: yields { selector, line } for every style rule, skipping @keyframes ──
function* rules(css) {
  const src = css.replaceAll(/\/\*[\s\S]*?\*\//g, (m) => m.replaceAll(/[^\n]/g, ' ')); // keep line numbers
  let i = 0, depth = 0, start = 0;
  const skip = []; // depth at which a @keyframes block was opened
  const lineAt = (pos) => src.slice(0, pos).split('\n').length;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"' || ch === "'") { // string: jump to its end
      const q = ch; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
      i++; continue;
    }
    if (ch === '{') {
      const prelude = src.slice(start, i).trim();
      depth++;
      if (/^@keyframes\b/.test(prelude)) skip.push(depth);
      else if (!prelude.startsWith('@') && skip.length === 0) yield { selector: prelude, line: lineAt(start + (src.slice(start, i).match(/^\s*/)[0].length)) };
      start = i + 1; i++; continue;
    }
    if (ch === '}') { if (skip[skip.length - 1] === depth) skip.pop(); depth--; start = i + 1; i++; continue; }
    if (ch === ';') { start = i + 1; i++; continue; }
    i++;
  }
}

/** split a selector list on top-level commas, then each selector into compounds on combinators */
const splitTop = (s, seps) => {
  const out = []; let d = 0, cur = '';
  for (const ch of s) {
    if (ch === '(') d++; else if (ch === ')') d--;
    if (d === 0 && seps.includes(ch)) { if (cur.trim()) out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
};
const compoundsOf = (sel) => splitTop(sel.replaceAll(/\s*([>+~])\s*/g, ' $1 '), [' ', '>', '+', '~']).filter((c) => !/^[>+~]$/.test(c));
const wsClasses = (compound) => [...compound.matchAll(/\.(ws-[\w-]+)/g)].map((m) => m[1]);
/** ws- classes of the compound itself, ignoring what's inside :not()/:has() */
const ownWsClasses = (compound) => wsClasses(compound.replaceAll(/:[\w-]+\([^)]*\)/g, ''));

// ── run ──
let errors = 0, warnings = 0;
const definedIn = new Map(); // class → Set(file)
const report = (strict, file, line, msg) => {
  const tag = strict ? 'error' : 'warn';
  if (strict) errors++; else warnings++;
  console.log(`${tag}: ${relative(ROOT, file)}:${line}: ${msg}`);
};

for (const { file, prefix, strict } of FILES) {
  let css;
  try { css = readFileSync(file, 'utf8'); } catch { report(strict, file, 0, 'missing file'); continue; }
  /** @param {string} cls */
  const mine = (cls) => prefix ? cls.startsWith(prefix) || cls === rootOf(prefix) : SHARED.has(cls);
  for (const { selector, line } of rules(css)) {
    for (const sel of splitTop(selector, [','])) {
      const comps = compoundsOf(sel);
      const all = comps.flatMap(wsClasses);
      // 1. every referenced class must belong to someone
      for (const cls of all) if (!ownerOf(cls)) report(strict, file, line, `unknown class .${cls} — not shared and no screen prefix (in \`${sel}\`)`);
      // 2. subject must be defined here
      const subjectIdx = comps.map((c) => ownWsClasses(c).length > 0).lastIndexOf(true);
      if (subjectIdx === -1) {
        if (prefix) report(strict, file, line, `unscoped selector \`${sel}\` — every rule here must target a .${prefix}* class`);
        continue;
      }
      const subject = ownWsClasses(comps[subjectIdx]);
      const defined = subject.filter(mine);
      if (defined.length > 0) {
        for (const cls of defined) { if (!definedIn.has(cls)) definedIn.set(cls, new Set()); definedIn.get(cls).add(file); }
        continue;
      }
      const scopedOverride = prefix && subject.every((c) => SHARED.has(c)) && comps.slice(0, subjectIdx).some((c) => ownWsClasses(c).some(mine));
      if (scopedOverride) continue;
      const what = subject.map((c) => `.${c}`).join('');
      report(strict, file, line, prefix
        ? `\`${sel}\` defines ${what}, which is not ${prefix}* — move it to the file that owns it, or scope it under a .${prefix}* element if it is a shared primitive`
        : `\`${sel}\` defines ${what} — base.css may only define the shared primitives (${[...SHARED].join(', ')})`);
    }
  }
}

// 4. one definition site per class
for (const [cls, files] of definedIn) {
  if (files.size > 1) {
    const strict = [...files].every((f) => FILES.find((x) => x.file === f).strict);
    report(strict, [...files][1], 0, `.${cls} is defined in more than one file: ${[...files].map((f) => relative(ROOT, f)).join(', ')}`);
  }
}

// 5. typo guard over src/**/*.ts (warn only)
const tsFiles = [];
(function walk(dir) { for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith('.ts')) tsFiles.push(p); } })(join(ROOT, 'src'));
for (const file of tsFiles) {
  const src = readFileSync(file, 'utf8').replaceAll(/\/\*[\s\S]*?\*\//g, (m) => m.replaceAll(/[^\n]/g, ' ')).replaceAll(/(^|\s)\/\/.*$/gm, '$1');
  src.split('\n').forEach((text, i) => {
    for (const m of text.matchAll(/(?<![\w-])(ws-[a-z0-9-]+)/g)) {
      const cls = m[1];
      if (NOT_CLASSES.has(cls) || definedIn.has(cls)) continue;
      report(false, file, i + 1, `'${cls}' is used here but no stylesheet defines it (typo? or a JS-only hook — use a data- attribute instead)`);
    }
  });
}

// X2: all source styles use the five layer tokens plus in-layer order.
const cssFiles = [];
(function walkCss(dir) { for (const name of readdirSync(dir)) { const file = join(dir, name); if (statSync(file).isDirectory()) walkCss(file); else if (file.endsWith('.css')) cssFiles.push(file); } })(join(ROOT, 'src'));
for (const file of cssFiles) {
  const source = readFileSync(file, 'utf8').replaceAll(/\/\*[\s\S]*?\*\//gu, (comment) => comment.replaceAll(/[^\n]/gu, ' '));
  for (const match of source.matchAll(/\bz-index\s*:\s*[-+]?\d+/gu)) {
    report(true, file, source.slice(0, match.index).split('\n').length, 'z-index must use a UI layer token plus in-layer order');
  }
}

const n = definedIn.size;
if (errors) { console.log(`\ncheck-css: ${errors} error(s), ${warnings} warning(s) — ${n} classes checked`); process.exit(1); }
console.log(`check-css: ok — ${n} classes across ${FILES.length} stylesheets${warnings ? `, ${warnings} warning(s) (non-blocking)` : ''}`);
