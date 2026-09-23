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
const STYLES = join(ROOT, 'src/ui/styles');

/** shared primitives — the only unprefixed classes, and only base.css may define them */
const SHARED = new Set(['ws-glass', 'ws-label', 'ws-mono', 'ws-display', 'ws-wordmark', 'ws-bar']);

/** file → { prefix, strict }. `prefix: null` = base.css (shared list only). */
const FILES = [
  { file: join(STYLES, 'base.css'), prefix: null, strict: true },
  { file: join(STYLES, 'game.css'), prefix: 'ws-game-', strict: true },
  { file: join(STYLES, 'menu.css'), prefix: 'ws-menu-', strict: true },
  { file: join(STYLES, 'gmenu.css'), prefix: 'ws-gmenu-', strict: true }, // the in-game menu (src/ui/Menu.ts): map / inventory / achievements / settings
  { file: join(STYLES, 'touch.css'), prefix: 'ws-touch-', strict: true },
  { file: join(STYLES, 'update.css'), prefix: 'ws-update-', strict: true },
  { file: join(STYLES, 'minimap.css'), prefix: 'ws-minimap-', strict: true },
  { file: join(STYLES, 'combat.css'), prefix: 'ws-combat-', strict: true }, // hunting feedback (src/ui/Combat.ts), imported by the module
  { file: join(STYLES, 'feedback.css'), prefix: 'ws-fb-', strict: true }, // the review inbox: ✎ disc + the lazy composer (src/ui/review.ts, Feedback.ts)
  { file: join(STYLES, 'explore.css'), prefix: 'ws-x-', strict: true }, // Explore World, the viewer (src/explore/Explore.ts), imported by the lazy chunk
  { file: join(STYLES, 'rotate.css'), prefix: 'ws-rotate-', strict: true }, // the portrait-only gate on landscape phones (index.html, src/ui/RotateGate.ts)
  { file: join(STYLES, 'quest.css'), prefix: 'ws-quest-', strict: true }, // the adventure layer: objective line, NPC dialogue, reward caption (src/game/quest/*)
  // loading screen: owned by src/ui/Loading.ts — warn only while its owner finishes the ws-load-* rename
  { file: join(ROOT, 'src/ui/loading.css'), prefix: 'ws-load-', strict: false },
  // frame meter (src/ui/Perf.ts) — warn only; not part of the HUD split
  { file: join(ROOT, 'src/ui/perf.css'), prefix: 'ws-perf-', strict: false },
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

const n = definedIn.size;
if (errors) { console.log(`\ncheck-css: ${errors} error(s), ${warnings} warning(s) — ${n} classes checked`); process.exit(1); }
console.log(`check-css: ok — ${n} classes across ${FILES.length} stylesheets${warnings ? `, ${warnings} warning(s) (non-blocking)` : ''}`);
