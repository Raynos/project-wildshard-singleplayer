/** Elapsed clocks and eased percentages are deliberately absent from the progress signature. */
export class LoadingStall {
  private signature = '';
  private at: number;
  constructor(now: number) { this.at = now; }
  quietMs(signature: string, now: number): number {
    if (signature !== this.signature) { this.signature = signature; this.at = now; }
    return Math.max(0, now - this.at);
  }
}
