import { uiScope, mountUi } from '../../ui/ownership';
import { engineString } from '../../strings';
import { Vector3 } from 'three';
import { withOwner } from '../../app/ownership';
import type { Scope } from '../../app/scope';
import type { Game } from '../../core/Game';
import type { LevelContext } from '../../level/context';
import { brainInspection } from '../inspect';

export interface DebugActor { position: Vector3; state: string; alive: boolean; hidden: boolean; kind: string; scale: number }
export interface AiDebugHost { game: Game; actors: () => readonly DebugActor[]; player: { position: Vector3 } }
export interface AiDebugView { update: () => void; dispose: () => void }

class Labels implements AiDebugView {
  readonly scope = uiScope('aiLabels');
  private readonly root = document.createElement('div');
  private readonly labels = new Map<DebugActor, HTMLDivElement>();
  private readonly point = new Vector3();
  private readonly host: AiDebugHost;
  constructor(host: AiDebugHost) {
    this.host = host;
    this.root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:calc(var(--ws-layer-hud) + 40)';
    mountUi(this.root, this.scope);
  }
  update(): void {
    const { game, actors, player } = this.host, present = new Set<DebugActor>();
    const rect = game.canvas.getBoundingClientRect();
    for (const actor of actors()) {
      if (!actor.alive || actor.hidden || actor.position.distanceToSquared(player.position) > 60 * 60) continue;
      this.point.copy(actor.position); this.point.y += 1.7 * actor.scale; this.point.project(game.camera);
      if (this.point.z < -1 || this.point.z > 1 || Math.abs(this.point.x) > 1.1 || Math.abs(this.point.y) > 1.1) continue;
      present.add(actor);
      let label = this.labels.get(actor);
      if (label === undefined) {
        label = document.createElement('div');
        label.style.cssText = 'position:absolute;white-space:pre;font:10px monospace;color:#8fe3ff;background:#0d1b26dd;padding:4px;border:1px solid #8fe3ff;transform:translate(-50%,-100%)';
        this.root.append(label); this.labels.set(actor, label);
      }
      const info = brainInspection(actor, actor.state);
      const picks = info.picks.slice(0, 3).map((pick) => `${pick.id} ${pick.score.toFixed(2)}`).join('\n') || '—';
      label.textContent = engineString('s_362ebababd70', [actor.kind, info.state, picks, String(info.brainHz), info.pinned ? engineString('s_feb050500e22') : engineString('s_19f1fa5ec989')]);
      label.style.left = `${String(rect.left + (this.point.x + 1) * 0.5 * rect.width)}px`;
      label.style.top = `${String(rect.top + (1 - this.point.y) * 0.5 * rect.height)}px`;
    }
    for (const [actor, label] of this.labels) if (!present.has(actor)) { label.remove(); this.labels.delete(actor); }
  }
  dispose(): void { this.labels.clear(); this.root.remove(); }
}

/** Off creates no visual objects; an optional installer scopes enabled overlays to the current entered lifetime. */
export function installAiDebug(ctx: Pick<LevelContext, 'app' | 'scope' | 'debugRow'>, host: AiDebugHost,
  view: (host: AiDebugHost) => AiDebugView = (value) => new Labels(value), entered?: (install: (scope: Scope) => void) => void): void {
  let stop = (): void => { /* Off initially. */ };
  let parent: Scope | undefined = entered === undefined ? ctx.scope : undefined;
  let selected = 'off';
  const change = (value: string): void => {
    selected = value;
    stop(); stop = () => { /* Already stopped. */ };
    if (value !== 'on' || ctx.scope.disposed || parent === undefined) return;
    const scope = parent.child('ai-overlay');
    const labels = entered === undefined ? view(host) : withOwner(scope, () => view(host));
    scope.onDispose(() => { labels.dispose(); }); stop = () => { scope.dispose(); };
    ctx.app.addSystem({ id: `engine.ai.debug.${ctx.scope.name}`, phase: 'late',
      when: (app) => app.levelScope === ctx.scope && ['play', 'practice', 'explore'].includes(app.state),
      run: () => { labels.update(); } }, scope);
  };
  if (entered !== undefined) entered((scope) => {
    parent = scope; change(selected);
    scope.onDispose(() => { stop(); if (parent === scope) parent = undefined; });
  });
  ctx.scope.onDispose(() => { stop(); });
  ctx.debugRow({ ask: 'E357', reviewBy: '2026-12-30', id: 'ai.brains', group: 'tools', label: engineString('s_4a74d7223bec'), initial: 'off',
    choices: [{ value: 'off', text: engineString('s_ca7981b46ecf') }, { value: 'on', text: engineString('s_130011756125') }], change,
    note: engineString('s_2cdb96d9e16c') });
}
