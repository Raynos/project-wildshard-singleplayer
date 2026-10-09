// site/tools/copy.ts — the marketing site's words come from site/COPY.md (Jake edits it by hand), so the file and the
// page's slots must match exactly, and the text must render safely.
// oxlint-disable-next-line import/no-nodejs-modules -- The test reads the committed COPY.md and page template.
import { readFileSync } from 'node:fs';
import { fillCopy, inline, parseCopy, plain, unusedCopy } from '../site/tools/copy';
import { describe, expect, it } from 'vitest';

/** every page of the site (site/vite.config.ts PAGES) */
const PAGES = ['site/index.html', 'site/press/index.html'];

describe('parseCopy', () => {
  it('reads `## Name` entries, skips notes and `# Section` lines', () => {
    const copy = parseCopy('# Hero\n\n<!-- a note -->\n## Hero · title\n\nWildshard\n\n## Hero · tagline\nOne world.\nEvery shard.\n# Next\n');
    expect([...copy.entries()]).toEqual([['Hero · title', 'Wildshard'], ['Hero · tagline', 'One world.\nEvery shard.']]);
  });
  it('refuses a heading used twice', () => {
    expect(() => parseCopy('## A\nx\n## A\ny\n')).toThrow(/appears twice/u);
  });
});

describe('fillCopy', () => {
  const copy = new Map([['T', 'Say **hi** to `wildshard` & <you>'], ['L', '- one\n- **two**'], ['Q', 'it\'s "quoted"']]);
  it('fills text, attribute, script and list slots, escaped for each', () => {
    const { html, used } = fillCopy('<p>{{T}}</p><img alt="{{@T}}"><script>x = {{$Q}};</script><ul>{{list:L}}</ul>', copy);
    expect(html).toBe(String.raw`<p>Say <b>hi</b> to <code>wildshard</code> &amp; &lt;you&gt;</p><img alt="Say hi to wildshard &amp; &lt;you&gt;"><script>x = "it's \"quoted\"";</script><ul><li>one</li><li><b>two</b></li></ul>`);
    expect([...used].sort()).toEqual(['L', 'Q', 'T']);
  });
  it('names every slot with no entry', () => {
    expect(() => fillCopy('{{Missing one}} {{@Missing two}}', copy)).toThrow(/"## Missing one", "## Missing two"/u);
  });
  it('inline: links, a ✓ in the accent, a blank line breaks', () => {
    expect(inline('see [the game](https://x.test) ✓\n\nnext')).toBe('see <a href="https://x.test" target="_blank" rel="noopener">the game</a> <span class="ok">✓</span><br><br>next');
    expect(plain('**a** `b` [c](d)')).toBe('a b c');
  });
});

describe('site/COPY.md and the pages', () => {
  it('every slot on every page has an entry, and every entry has a slot on some page', () => {
    const copy = parseCopy(readFileSync('site/COPY.md', 'utf8'));
    const used = new Set<string>();
    for (const page of PAGES) for (const k of fillCopy(readFileSync(page, 'utf8'), copy).used) used.add(k);
    expect(unusedCopy(copy, used)).toEqual([]);
  });
});

describe('the pages', () => {
  it('every link to the game opens in a new tab (Jake: "All the play icons should always open a new tab")', () => {
    const links = PAGES.flatMap((page) => readFileSync(page, 'utf8').match(/<a [^>]*href="https:\/\/wildshard-singleplayer\.vercel\.app[^"]*"[^>]*>/gu) ?? []);
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) expect(a).toContain('target="_blank"');
  });
});
