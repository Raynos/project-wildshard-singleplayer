import type { Scope } from '@wildshard/engine/app/scope';
import { DialogueBox } from '@wildshard/engine/quest/view/ui';
import type { ShardContext } from '@wildshard/game/shard/context';
import { installEnteredRuntimeService } from '@wildshard/game/shard/retainedHooks';

/** the quest chip and the reward captions it retains: their roots for the slot, their own verbs to reset them */
export interface RetainedChip { readonly root: HTMLElement; hide: (on: boolean) => void }
export interface RetainedCaption { readonly root: HTMLElement; show: (on: boolean) => void }
/** Retain quest state and exact HUD positions while dialogue input and reward timers belong only to the entered cell. */
export function installEnteredAdventure(ctx: ShardContext, chip: RetainedChip): {
  readonly dialogue: DialogueBox; caption: (caption: RetainedCaption) => void; timeout: (ms: number, run: () => void) => void;
} {
  const roots = new Map<HTMLElement, { parent: Node | null; before: ChildNode | null; reset: () => void }>();
  let entered: Scope | undefined, dialogue: DialogueBox | undefined;
  const retain = (root: HTMLElement, reset: () => void): void => { roots.set(root, { parent: root.parentNode, before: root.nextSibling, reset }); };
  retain(chip.root, () => { chip.hide(false); });
  installEnteredRuntimeService(ctx, (scope) => {
    entered = scope;
    for (const [root, position] of roots) {
      const before = position.before?.parentNode === position.parent ? position.before : null;
      position.parent?.insertBefore(root, before);
    }
    dialogue = new DialogueBox(scope.child('nalati.dialogue'));
    scope.onDispose(() => {
      entered = undefined; dialogue = undefined;
      roots.forEach(({ reset }, root) => { reset(); root.remove(); });
    });
  });
  return {
    get dialogue() { if (dialogue === undefined) throw new Error('Nalati dialogue left its cell'); return dialogue; },
    caption: (c) => { retain(c.root, () => { c.show(false); }); },
    timeout: (ms, run) => { if (entered === undefined) throw new Error('Nalati reward left its cell'); entered.timeout(ms, run); },
  };
}
