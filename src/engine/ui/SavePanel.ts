import { appIdentity } from '../app/identity';
import { engineString } from '../strings';
import { currentOwner } from '../app/ownership';
import type { Scope } from '../app/scope';
import { app } from '../app/runtime';
import { markReload } from '../boot/lastEnd';
import { SAVE_STRINGS as strings } from './saveStrings';

function download(name: string, contents: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  URL.revokeObjectURL(url);
}
const button = (scope: Scope, text: string, run: () => void): HTMLButtonElement => {
  const element = document.createElement('button'); element.type = 'button'; element.className = 'ws-gmenu-btn'; element.textContent = text;
  scope.listen(element, 'click', run); return element;
};
export function buildSavePanel(): HTMLDivElement & { refresh: () => void } {
  const scope = (app.levelScope ?? currentOwner() ?? app.engineScope).child('save-panel');
  const card = document.createElement('div'); card.className = 'ws-gmenu-card';
  const title = document.createElement('div'); title.className = 'ws-gmenu-cardtitle'; title.textContent = strings.title;
  const note = document.createElement('div'); note.className = 'ws-gmenu-note'; note.textContent = strings.note;
  const row = document.createElement('div'); row.className = 'ws-gmenu-row';
  const status = document.createElement('div'); status.className = 'ws-gmenu-note'; status.setAttribute('role', 'status');
  const picker = document.createElement('input'); picker.type = 'file'; picker.accept = '.json,application/json'; picker.hidden = true;
  const reload = button(scope, strings.reload, () => { markReload('save import'); location.reload(); }); reload.hidden = true;
  const aside = document.createElement('div');
  const renderAside = (): void => {
    aside.replaceChildren(); const copies = app.saves.corrupt(); aside.hidden = copies.length === 0;
    if (copies.length === 0) return;
    const label = document.createElement('div'); label.className = 'ws-gmenu-label'; label.textContent = strings.aside; aside.append(label);
    for (const copy of copies) {
      const item = document.createElement('div'); item.className = 'ws-gmenu-note';
      const text = document.createElement('span'); text.textContent = engineString('s_6d093aa18a40', [copy.scope, copy.key, copy.at, copy.bytes]);
      item.append(text, button(scope, strings.export, () => { download(`${appIdentity().fileSlug}-corrupt-${copy.key}-${copy.at}.json`, app.saves.exportCorrupt(copy)); })); aside.append(item);
    }
  };
  row.append(button(scope, strings.export, () => { download(`${appIdentity().fileSlug}-save-${new Date().toISOString().slice(0, 10)}.json`, app.saves.exportAll()); renderAside(); }), button(scope, strings.import, () => { picker.value = ''; picker.click(); }));
  scope.listen(picker, 'change', () => {
    const file = picker.files?.[0]; if (!file) return;
    void file.text().then((json) => {
      const report = app.saves.importAll(json);
      status.textContent = [strings.imported(report.imported.length), strings.skipped(report.skipped.length), ...report.skipped.map((skip) => `${skip.key}: ${skip.reason}`)].join('\n');
      reload.hidden = report.imported.length === 0; renderAside(); return undefined;
    }).catch(() => { status.textContent = strings.failed; });
  });
  card.append(title, note, row, picker, status, reload, aside); renderAside(); return Object.assign(card, { refresh: renderAside });
}
