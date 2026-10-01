import { Vector3 } from 'three';
import type { Game } from '../../core/Game';
import type { LevelContext } from '../../level/context';
import { brainInspection } from '../inspect';

export interface DebugActor { position: Vector3; state: string; alive: boolean; hidden: boolean; kind: string; scale: number }
export interface AiDebugHost { game: Game; actors: () => readonly DebugActor[]; player: { position: Vector3 } }
export interface AiDebugView { update: () => void; dispose: () => void }

class Labels implements AiDebugView {
  private readonly root = document.createElement('div');
  private readonly labels = new Map<DebugActor, HTMLDivElement>();
  private readonly point = new Vector3();
  private readonly host: AiDebugHost;
  constructor(host: AiDebugHost) {
    this.host = host;
    this.root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:40';
    (document.getElementById('hud') ?? document.body).append(this.root);
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
      label.textContent = `${actor.kind} · ${info.state}\n${picks}\n${String(info.brainHz)} HZ · ${info.pinned ? 'PINNED' : 'FREE'}`;
      label.style.left = `${String(rect.left + (this.point.x + 1) * 0.5 * rect.width)}px`;
      label.style.top = `${String(rect.top + (1 - this.point.y) * 0.5 * rect.height)}px`;
    }
    for (const [actor, label] of this.labels) if (!present.has(actor)) { label.remove(); this.labels.delete(actor); }
  }
  dispose(): void { this.labels.clear(); this.root.remove(); }
}

/** Off creates no visual objects and registers no per-frame system. */
export function installAiDebug(ctx: Pick<LevelContext, 'app' | 'scope' | 'debugRow'>, host: AiDebugHost, view: (host: AiDebugHost) => AiDebugView = (value) => new Labels(value)): void {
  let stop = (): void => { /* Off initially. */ };
  const change = (value: string): void => {
    stop(); stop = () => { /* Already stopped. */ };
    if (value !== 'on' || ctx.scope.disposed) return;
    const scope = ctx.scope.child('ai-overlay'), labels = view(host);
    scope.onDispose(() => { labels.dispose(); }); stop = () => { scope.dispose(); };
    ctx.app.addSystem({ id: `engine.ai.debug.${ctx.scope.name}`, phase: 'late',
      when: (app) => app.levelScope === ctx.scope && ['play', 'practice', 'explore'].includes(app.state),
      run: () => { labels.update(); } }, scope);
  };
  ctx.scope.onDispose(() => { stop(); });
  ctx.debugRow({ ask: 'E357', reviewBy: '2026-12-30', id: 'ai.brains', group: 'tools', label: 'AI brains', initial: 'off',
    choices: [{ value: 'off', text: 'Off' }, { value: 'on', text: 'On' }], change,
    note: 'E357 · state, top three utility picks, tick rate and pinned status within 60 m' });
}
