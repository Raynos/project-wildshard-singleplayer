import type { Animal } from '@wildshard/engine/entities/AnimalView';
import type { AnimalManager } from '@wildshard/engine/entities/AnimalManager';
import type { Player } from '@wildshard/engine/player/Player';
import type { InputService } from '@wildshard/engine/input/InputService';
import type { LevelContext } from '@wildshard/engine/level/context';
import { admitRenderedHerds, admitRidingWind, createPageTaming, type PageTamingOwner } from '@wildshard/game/riding/client';
import type { TamingPrograms } from '@wildshard/game/riding/taming';
import type { HerdController } from '../runtime/groupRegistry';
import type { Mount } from '@wildshard/game/riding/mount';
import { wildEnv } from '../creatures/env';
import { tulparSave as savedSlot } from './saves';

interface TamingOpts {
  binding: unknown; ctx: LevelContext; programs: TamingPrograms; player: Player; mount: Mount; animals: AnimalManager;
  herds: readonly HerdController[]; rest: { x: number; z: number; face: { x: number; z: number } };
  bond?: { read: () => string | null; write: (value: string) => void }; toast: (text: string) => void;
}
/** Nalati persists and reports the data effects of the shared riding owner. */
export class Taming {
  readonly owner: PageTamingOwner;
  onBonded?: (horse: Animal) => void;
  onBreaking?: (on: boolean) => void;
  constructor(private readonly opts: TamingOpts) {
    admitRenderedHerds(opts.ctx.scope, 'nalati.herds', opts.herds); admitRidingWind(opts.ctx.scope, wildEnv.wind);
    let savedBond: string | null = null;
    try { savedBond = opts.bond?.read() ?? savedSlot.read('nalati-grasslands'); } catch { /* unavailable storage */ }
    this.owner = createPageTaming(opts.ctx, opts.player, opts.animals, opts.mount, { herds: 'nalati.herds', programs: opts.programs,
      binding: opts.binding, savedBond, rest: opts.rest, thrownLabel: 'Thrown from the saddle',
      adopted: { kind: 'horse', variant: 'tulpar', upgrade: { scale: 1.3, colour: [.62, .64, .72] } } });
  }
  get phase(): PageTamingOwner['phase'] { return this.owner.phase; }
  get tulpar(): Animal | null { return this.owner.companion; }
  get isArgymaq(): boolean { return this.owner.upgraded; }
  get view(): PageTamingOwner['view'] { return this.owner.view; }
  get interactable(): PageTamingOwner['interactable'] { return this.owner.interactable; }
  private currentInput: InputService | null = null;
  get input(): InputService | null { return this.currentInput; }
  set input(value: InputService | null) { this.currentInput = value; this.owner.setInput(value); }
  private effects(): void {
    for (const event of this.owner.drainEvents()) {
      if (event.kind === 'bond') this.opts.bond?.write(event.value);
      else if (event.kind === 'notice') this.opts.toast(event.text);
      else if (event.kind === 'breaking') this.onBreaking?.(event.on);
      else { const actor = this.owner.companion; if (actor?.entityId === event.actor) this.onBonded?.(actor); }
    }
  }
  update(dt: number): void { this.owner.update(dt); this.effects(); }
  noteEvent(name: string, x: number, z: number): void { this.owner.noteEvent(name, x, z); this.effects(); }
  noteShot(x: number, z: number): void { this.owner.noteShot(x, z); this.effects(); }
  forceBreak(): void { this.owner.forceBreak(); this.effects(); }
}
