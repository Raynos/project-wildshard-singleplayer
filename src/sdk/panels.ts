import type { Scope } from '@wildshard/engine/app/scope';
import { declarePanel as declare, type PanelChild as Child, type PanelNode as Node, type PanelStyle as Style, type PanelSvg as Svg, type PanelView as View } from '@wildshard/engine/ui/panel';
import { mountUi, uiScope } from '@wildshard/engine/ui/ownership';

/** One declared panel element: tag, classes, strings, attributes, static style, children and a ref (SF28). */
export type PanelNode = Node;
/** A built panel: its root and the verbs a shard drives it with; it never touches the elements. */
export type PanelView = View;
/** An inline SVG icon as data (tag, attributes, children). */
export type PanelSvg = Svg;
/** A panel element's child: an element or an SVG icon. */
export type PanelChild = Child;
/** Static inline style (camelCase keys). */
export type PanelStyle = Style;

/** Build a declared panel from data (detached). Place its root with `mountPanel`, `ctx.hud.widget` or `ctx.hud.pin`. */
export function declarePanel(spec: PanelNode): PanelView { return declare(spec); }
/** A UI scope under the current owner (the level, else the engine): a panel's lifetime. */
export function panelScope(name: string): Scope { return uiScope(name); }
/**
 * Mount a panel on the shared HUD root (band 1) for the scope's life; `parent` mounts it inside another HUD element,
 * `before` keeps an exact insertion position.
 */
export function mountPanel(view: PanelView, scope: Scope, parent?: HTMLElement, before?: ChildNode | null): void {
  mountUi(view.root, scope, parent, before);
}
