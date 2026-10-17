/** Shape contracts for fixed authored island rows. */
export interface Isle { readonly id: string; readonly x: number; readonly z: number; readonly r: number; readonly y: number; readonly keel: number }
export interface Span { readonly id: string; readonly kind: 'rope' | 'hover'; readonly x0: number; readonly z0: number; readonly x1: number; readonly z1: number; readonly y: number; readonly y1: number; readonly width: number }
export interface Home { readonly x: number; readonly z: number; readonly r: number; readonly y: number }
