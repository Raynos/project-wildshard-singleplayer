/** One explicit title-document handoff before measurement; never replays a tap. */
export function handoffFloorGridNavigation(driver: {
  evaluate: (expression: string) => Promise<unknown>;
  tapGrid: () => Promise<unknown>;
  followed: () => Promise<unknown>;
}): Promise<void>;
/** The existing grid-button tap submitted as a synchronous protocol command. */
export const FLOOR_GRID_TAP: string;
