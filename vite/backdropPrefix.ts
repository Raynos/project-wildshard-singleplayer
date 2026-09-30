/**
 * The HUD glass on Chrome / Android (E327, PINE-HOLLOW-FOLLOWUPS F-G10). The stylesheets write
 * `backdrop-filter: X; -webkit-backdrop-filter: X;`, and the build's CSS minifier (lightningcss) reads a prefixed
 * declaration after the unprefixed one as its override: it keeps only `-webkit-backdrop-filter`, which Chrome ignores,
 * so no HUD glass was drawn anywhere but Safari. With `-webkit-` first it keeps both. This rewrites every pair (and a
 * lone unprefixed one) to `-webkit-backdrop-filter: X; backdrop-filter: X` before the minifier sees it, so the order
 * in the source no longer matters.
 */
import type { Plugin } from 'vite';

const PREFIXED = /(^|[;{\s])-webkit-backdrop-filter\s*:[^;}]*;?/g;
const UNPREFIXED = /(^|[;{\s])backdrop-filter\s*:([^;}]*)/g;

const BLOCK = /\{[^{}]*\}/g;

/** Per rule block: one that has an unprefixed `backdrop-filter` gets it re-emitted `-webkit-` first (its own prefixed
 *  copy dropped); a block with only the prefixed one is left alone. */
export function prefixBackdrop(css: string): string {
  if (!css.includes('backdrop-filter')) return css;
  return css.replace(BLOCK, (block) => {
    UNPREFIXED.lastIndex = 0;
    if (!UNPREFIXED.test(block)) return block;
    return block.replace(PREFIXED, '$1')
      .replace(UNPREFIXED, (_m, lead: string, value: string) => `${lead}-webkit-backdrop-filter:${value};backdrop-filter:${value}`);
  });
}

export const backdropPrefixPlugin = (): Plugin => ({
  name: 'backdrop-prefix',
  enforce: 'pre',
  transform(code, id) {
    if (!/\.css(\?|$)/.test(id)) return null;
    const out = prefixBackdrop(code);
    return out === code ? null : { code: out, map: null };
  },
});
