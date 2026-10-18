import { isDev, onDev } from '@wildshard/engine/core/devMode';
import { app } from '@wildshard/engine/app/runtime';
import type { Scope } from '@wildshard/engine/app/scope';
import { mountUi } from '@wildshard/engine/ui/ownership';
import type { TrainingArena, PracticeOpponent } from '@wildshard/engine/practice/TrainingArena';
import './practicePicker.css';

export interface PracticeChoice { readonly id: string; readonly label: string; readonly unavailable?: string }
/** Developer-only selection, before room entry. Content adapters own admission and loading. */
export function installPracticePicker(options: {
  readonly owner: Scope;
  readonly arena: TrainingArena;
  readonly choices: readonly PracticeChoice[];
  readonly load: (id: string) => Promise<PracticeOpponent | null>;
  readonly clear: () => void;
  readonly retry: () => void;
  readonly tick: (update: () => void) => void;
}): { status: (message: string) => void } {
  const scope = options.owner.child('practice-picker');
  const panel = document.createElement('details'); panel.className = 'ws-practice-picker';
  const summary = document.createElement('summary'); summary.textContent = 'Developer · practice opponent';
  const select = document.createElement('select'); select.setAttribute('aria-label', 'Practice opponent');
  const baseline = document.createElement('option'); baseline.value = ''; baseline.textContent = 'Three training dummies'; select.append(baseline);
  for (const row of options.choices) {
    const option = document.createElement('option'); option.value = row.id;
    option.textContent = row.unavailable === undefined ? row.label : `${row.label} · unavailable`;
    option.disabled = row.unavailable !== undefined; option.title = row.unavailable ?? ''; select.append(option);
  }
  const status = document.createElement('p'); status.textContent = 'Experimental. Practice rewards stay in this bout.';
  const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Retry this opponent';
  scope.listen(retry, 'click', () => {
    if (!options.arena.entered) return;
    try { options.retry(); } catch (error: unknown) { status.textContent = error instanceof Error ? error.message : 'Retry failed.'; }
  });
  panel.append(summary, select, retry, status); mountUi(panel, scope);
  let loading = false, request = 0;
  scope.listen(select, 'change', () => {
    if (options.arena.entered) return;
    const token = ++request, id = select.value;
    options.arena.setOpponent(null); options.clear();
    if (id === '') { loading = false; status.textContent = 'Three training dummies selected.'; return; }
    loading = true; status.textContent = 'Preparing isolated opponent…';
    const prepare = async (): Promise<void> => {
      try {
        const opponent = await options.load(id);
        if (scope.disposed || token !== request) return;
        if (options.arena.entered) { options.clear(); status.textContent = 'Exit the arena and select again.'; return; }
        options.arena.setOpponent(opponent);
        status.textContent = opponent === null ? 'Opponent unavailable.' : 'One opponent ready. Enter Practice from Explore.';
      } catch (error: unknown) {
        if (token === request) status.textContent = error instanceof Error ? error.message : 'Opponent could not load.';
      } finally { if (token === request) loading = false; }
    };
    void prepare();
  });
  const update = (): void => {
    panel.hidden = !isDev() || (app.state !== 'explore' && !options.arena.entered);
    select.disabled = loading || options.arena.entered;
    retry.hidden = !options.arena.entered || select.value === '';
    retry.disabled = loading;
  };
  options.tick(update); const stopDev = onDev(update); scope.onDispose(stopDev); update();
  scope.onDispose(() => { request++; options.clear(); });
  return { status: message => { status.textContent = message; } };
}
