// Nine Dragon authoring row shapes; these declarations have no runtime dependency.
/** The shard’s touch-label row, structurally checked by the trusted host. */
interface TouchRelabel { label: string; icon?: string; tone?: 'rest' | 'ready' | 'active'; accent?: string }
/** Nine Dragon’s authored GrappleAimRow row shape. */
export interface GrappleAimRow {
  /** hooks whose sight (and, when stale, landing) are re-tested per frame: a round robin over the course */
  readonly scanPerFrame: number;
  /** a cached landing is re-found once the player has moved this far (m) from where it was found */
  readonly landingStale: number;
  /** the small in-reach markers on screen at once */
  readonly marks: number;
  /** the touch LOCK disc's labels (rest, a hook ready, locked, armed with no hook) and JUMP's (zip, fire) */
  readonly hints: { readonly rest: TouchRelabel; readonly ready: TouchRelabel; readonly locked: TouchRelabel; readonly zip: TouchRelabel; readonly armed: TouchRelabel; readonly fire: TouchRelabel };
  /** the candidate's chip: its class, inline style, words and colours */
  readonly chip: {
    readonly className: string; readonly style: Readonly<Record<string, string>>; readonly candidate: string; readonly lockedTouch: string; readonly lockedDesk: string;
    readonly color: string; readonly lockedColor: string;
  };
  /** an in-reach marker: its class, inline style, glyph and colour */
  readonly mark: { readonly className: string; readonly style: Readonly<Record<string, string>>; readonly glyph: string; readonly color: string };
  /** the toasts: a miss, armed with no hook and a hook locked (touch and desktop words) */
  readonly toasts: { readonly miss: string; readonly armedTouch: string; readonly armedDesk: string; readonly lockedTouch: string; readonly lockedDesk: string };
  /** where the line leaves the hand, in the camera's space (m) */
  readonly muzzle: readonly [number, number, number];
  /** the rope's slack while the claw flies, while it reels back, and on a held line */
  readonly slack: { readonly fire: number; readonly reel: number; readonly hold: number };
  /** the rope's points */
  readonly ropePoints: number;
  /** the claw's and the lock halo's colours (hex) */
  readonly claw: number;
  readonly halo: number;
  /** the flashes' colours (hex): the muzzle, the bite, the dock */
  readonly flashes: { readonly muzzle: number; readonly bite: number; readonly dock: number };
  /** the bite's sparks */
  readonly sparks: number;
  /** the prefix of every mesh name (`<prefix>:filament`, `<prefix>:flying-claw`, …) */
  readonly name: string;
  /** the tool's systems: the input, the rope's fixed step and the frame */
  readonly systems: { readonly input: string; readonly rope: string; readonly update: string };
  /** the debug name the hooks and the phase are exposed under */
  readonly debug: string;
}
