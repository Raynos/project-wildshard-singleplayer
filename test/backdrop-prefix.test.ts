import { describe, expect, it } from 'vitest';
import { prefixBackdrop } from '../vite/backdropPrefix';

describe('prefixBackdrop (E327: Chrome / Android HUD glass)', () => {
  it('puts -webkit- first in an unprefixed-first pair', () => {
    expect(prefixBackdrop('.a { background: red; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }'))
      .toBe('.a { background: red; -webkit-backdrop-filter: blur(8px);backdrop-filter: blur(8px);  }');
  });
  it('keeps a prefixed-first pair as one pair', () => {
    const out = prefixBackdrop('.b{-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}');
    expect(out.match(/-webkit-backdrop-filter/g)).toHaveLength(1);
    expect(out.indexOf('-webkit-backdrop-filter')).toBeLessThan(out.search(/[^-]backdrop-filter/));
  });
  it('adds the prefix to a lone unprefixed declaration', () => {
    expect(prefixBackdrop('.c{backdrop-filter:blur(2px) saturate(1.2)}')).toBe('.c{-webkit-backdrop-filter:blur(2px) saturate(1.2);backdrop-filter:blur(2px) saturate(1.2)}');
  });
  it('leaves a lone prefixed declaration and other blocks alone', () => {
    const css = '.d{-webkit-backdrop-filter:blur(3px)}\n.e{color:red}';
    expect(prefixBackdrop(css)).toBe(css);
  });
});
