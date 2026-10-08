// A tiny DOM builder: elements from data, text always set as text (report strings are never parsed as HTML).

type Child = Node | string | null | undefined | false;
type Attrs = Record<string, string | number | boolean | null | undefined | EventListener>;

const SVG_NS = 'http://www.w3.org/2000/svg';

function apply(el: Element, attrs: Attrs): void {
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (typeof v === 'function') {
      el.addEventListener(k.replace(/^on/, ''), v);
    } else {
      el.setAttribute(k, v === true ? '' : String(v));
    }
  }
}

function append(el: Element, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c);
  }
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  apply(el, attrs);
  append(el, children);
  return el;
}

export function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  apply(el, attrs);
  append(el, children);
  return el;
}

/** Text with `code` spans rendered as <code>. */
export function rich(text: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  text.split(/(`[^`]+`)/).forEach((part) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 1) frag.append(h('code', {}, part.slice(1, -1)));
    else if (part) frag.append(part);
  });
  return frag;
}

export const MB = 1_000_000;

/** Decimal megabytes, the reports' unit. */
export function mb(bytes: number, digits = 1): string {
  return (bytes / MB).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
