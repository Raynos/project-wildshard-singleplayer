// oxlint-disable-next-line import/no-nodejs-modules -- Exercise the actual oxlint plugin on isolated authored-text fixtures.
import { spawnSync } from 'node:child_process';
// oxlint-disable-next-line import/no-nodejs-modules -- Fixtures own this temporary tree.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
// oxlint-disable-next-line import/no-nodejs-modules -- Temporary fixture ownership.
import { tmpdir } from 'node:os';
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve defining plugin and executable paths.
import { join, resolve } from 'node:path';
// oxlint-disable-next-line import/no-nodejs-modules -- Spawn the same Node executable as the test worker.
import { execPath } from 'node:process';
import { afterAll, expect, it } from 'vitest';

const root = mkdtempSync(join(tmpdir(), 'authored-html-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));
mkdirSync(join(root, 'src'), { recursive: true });
writeFileSync(join(root, 'package.json'), '{"type":"module"}');
writeFileSync(join(root, '.oxlintrc.json'), JSON.stringify({ jsPlugins: [resolve('lint/wildshard-plugin.js')], categories: { correctness: 'off' }, rules: { 'wildshard/no-authored-html': 'error' } }));
const cases = [
  { id: 'direct', code: 'declare const source: {title:string}; node.innerHTML=source.title;', count: 1 },
  { id: 'computed', code: 'declare const source: {title:string}; const key="innerHTML"; node[key]=source.title;', count: 1 },
  { id: 'alias', code: `declare const source: {text:string}; const alias=source.text; const next=alias; node.outerHTML=\`<span>\${next}</span>\`;`, count: 1 },
  { id: 'escaped', code: 'declare const source:{text:string};const esc=(s:string)=>s.replaceAll("<","&lt;");node.innerHTML=esc(source.text);', count: 1 },
  { id: 'helper', code: 'declare const source:{text:string};function render(html=""){node.innerHTML=html;}render(source.text);', count: 1 },
  { id: 'nested-helper', code: 'declare const source:{text:string};const copy=(s:string)=>s;function render(html:string){node.innerHTML=html;}render(copy(source.text));', count: 1 },
  { id: 'mutable', code: 'declare const source:{text:string};let text="fixed";text=source.text;node.innerHTML=text;', count: 1 },
  { id: 'mutated-table', code: 'declare const source:{text:string};const table={body:"fixed"};table.body=source.text;node.innerHTML=table.body;', count: 1 },
  { id: 'spread', code: 'declare const source:[string,string];function render(id:string,html:string){node.innerHTML=html;}render(...source);', count: 1 },
  { id: 'rest', code: 'declare const source:{text:string};function render(...html:string[]){node.innerHTML=html.join("");}render("fixed",source.text);', count: 1 },
  { id: 'exported', code: 'export function render(html=""){node.innerHTML=html;}render("fixed");', count: 1 },
  { id: 'append', code: 'declare const source:{text:string};node.innerHTML+=source.text;', count: 1 },
  { id: 'adjacent', code: 'declare const source:{text:string};node.insertAdjacentHTML("beforeend",source.text);', count: 1 },
  { id: 'fragment', code: 'declare const source:{text:string};document.createRange().createContextualFragment(source.text);', count: 1 },
  { id: 'assignment-object', code: 'declare const source:{text:string};Object.assign(node,{innerHTML:source.text});', count: 1 },
  { id: 'reflect-set', code: 'declare const source:{text:string};Reflect.set(node,"innerHTML",source.text);', count: 1 },
  { id: 'property-descriptor', code: 'declare const source:{text:string};Object.defineProperty(node,"innerHTML",{value:source.text});', count: 1 },
  { id: 'bound-adjacent', code: 'declare const source:{text:string};const render=node.insertAdjacentHTML.bind(node);render("beforeend",source.text);', count: 1 },
  { id: 'called-adjacent', code: 'declare const source:{text:string};node.insertAdjacentHTML.call(node,"beforeend",source.text);', count: 1 },
  { id: 'document-write-alias', code: 'declare const source:{text:string};const render=document.write;render(source.text);', count: 1 },
  { id: 'document-write-bound', code: 'declare const source:{text:string};const render=document.write.bind(document);render(source.text);', count: 1 },
  { id: 'frame', code: 'declare const source:{text:string};document.createElement("iframe").srcdoc=source.text;', count: 1 },
  { id: 'jsx', code: 'declare const source:{text:string};const payload={__html:source.text};', count: 1 },
  { id: 'projected-array', code: `declare const source:{text:string}[];node.innerHTML=source.map(row=>\`<span>\${row.text}</span>\`).join("");`, count: 1 },
  { id: 'spoofed-icon', code: 'declare const source:{swapIcon:string};node.innerHTML=source.swapIcon;', count: 1 },
  { id: 'text', code: 'declare const source:{text:string};node.textContent=source.text;', count: 0 },
  { id: 'static', code: 'const markup="<svg><path/></svg>";node.innerHTML=markup;', count: 0 },
  { id: 'static-helper', code: 'function render(html=""){node.innerHTML=html;}render("<b>fixed</b>");render();', count: 0 },
  { id: 'numeric', code: `declare const n:number;node.innerHTML=\`<b>\${n}</b>\`;`, count: 0 },
  { id: 'static-table', code: 'declare const key:string;const icons={one:"<svg/>",two:"<svg/>"};node.innerHTML=icons[key]??"";', count: 0 },
  { id: 'static-array-projection', code: 'declare const rows:{text:string}[];node.innerHTML=rows.map(row=>"<i></i>").join("");', count: 0 },
  { id: 'static-tuple-projection', code: `const rows=[["one","One"],["two","Two"]];node.innerHTML=rows.map(([id,label])=>\`<b data-id="\${id}">\${label}</b>\`).join("");`, count: 0 },
] as const;
for (const row of cases) writeFileSync(join(root, `src/${row.id}.ts`), `export {};\nconst node=document.createElement('div');\n${row.code}`);
const result = spawnSync(execPath, [resolve('node_modules/oxlint/bin/oxlint'), '-c', join(root, '.oxlintrc.json'), '-f', 'json', 'src'], { cwd: root, encoding: 'utf8', timeout: 30_000 });
interface Diagnostic { filename: string; code: string; message: string }
const diagnostics = (JSON.parse(result.stdout) as { diagnostics: Diagnostic[] }).diagnostics;
it('loads the defining HTML guard without a plugin or process failure', () => { expect(result.status, result.stderr).toBe(1); expect(result.stderr).toBe(''); });
it.each(cases)('$id', (row) => {
  expect(diagnostics.filter((site) => site.filename === `src/${row.id}.ts` && site.code === 'wildshard(no-authored-html)'), row.code).toHaveLength(row.count);
});
