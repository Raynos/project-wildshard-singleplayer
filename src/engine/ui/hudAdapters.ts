import { Vector3 } from 'three';
import type { Game } from '../core/Game';
import type { Scope } from '../app/scope';
import type { LevelAdapters } from '../level/context';
import { hudSlots, type DiscSpot, type TouchRelabel } from './hudSlots';

/** Scope-owned projection and relabels; content supplies only world positions and elements. */
export function hudAdapters(game: Game, scope: Scope, root: HTMLElement,
  relabel: (spot: DiscSpot, hint: TouchRelabel | null) => void): NonNullable<LevelAdapters['hud']> {
  const pins = new Set<{ at: Vector3 | (() => Vector3 | null); el: HTMLElement; x: number; y: number; shown: boolean }>();
  const point = new Vector3();
  game.app.addSystem({ id: 'engine.hud.pins', phase: 'late', run: () => {
    for (const pin of pins) {
      const at = typeof pin.at === 'function' ? pin.at() : pin.at;
      if (at !== null) point.copy(at).project(game.camera);
      const shown = at !== null && point.z >= -1 && point.z <= 1;
      if (shown !== pin.shown) { pin.shown = shown; pin.el.style.display = shown ? 'block' : 'none'; }
      if (!shown) continue;
      const x = Math.round((point.x + 1) * innerWidth / 2), y = Math.round((1 - point.y) * innerHeight / 2);
      if (x !== pin.x || y !== pin.y) { pin.x = x; pin.y = y; pin.el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`; }
    }
  } }, scope);
  const labels = new Map<DiscSpot, { hint: TouchRelabel }[]>();
  return {
    widget: (band, el, order) => { if (band === 'status') hudSlots.statusRow(el, order); else root.append(el); return () => el.remove(); },
    disc: (opts) => { const button = hudSlots.disc(opts); return { button, dispose: () => button.remove() }; },
    relabel: (spot, label, icon, appearance) => {
      const entry = { hint: appearance ?? { label, icon, tone: 'rest' as const } };
      const list = labels.get(spot) ?? []; labels.set(spot, list); list.push(entry); relabel(spot, entry.hint);
      return () => { const at = list.indexOf(entry); if (at !== -1) list.splice(at, 1); relabel(spot, list.at(-1)?.hint ?? null); };
    },
    verb: (slot, opts) => {
      const button = hudSlots.disc({ ...opts, cls: 'ws-verb', spot: slot === 'verb.1' ? 'lean-l' : 'lean-r' });
      hudSlots.show(button, true); return () => button.remove();
    },
    pin: (at, el) => {
      Object.assign(el.style, { position: 'fixed', left: '0', top: '0', display: 'none', pointerEvents: 'none', willChange: 'transform' });
      const pin = { at, el, x: Number.NaN, y: Number.NaN, shown: false }; pins.add(pin); root.append(el);
      return () => { pins.delete(pin); el.remove(); };
    },
  };
}
