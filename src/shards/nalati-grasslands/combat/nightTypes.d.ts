/** Product-only night view data; executable policy is admitted by ReturnProgram. */
export interface NightRows {
  program: unknown;
  patrol: unknown;
  motion: unknown;
  slots: unknown;
  parameters: Readonly<Record<string, number>>;
  view: { tell: object };
  ride: unknown;
  cues: unknown;
  respawn: number;
}
