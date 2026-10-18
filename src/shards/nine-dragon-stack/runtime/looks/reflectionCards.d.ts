export interface StairCardPlan {
  readonly flights: readonly { readonly x0: number; readonly x1: number; readonly y0: number }[];
  readonly landings: readonly { readonly x0: number; readonly x1: number; readonly y: number }[];
  readonly rise: number;
  readonly run: number;
  readonly z0: number;
  readonly z1: number;
}
