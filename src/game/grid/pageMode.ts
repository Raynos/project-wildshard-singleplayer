/**
 * This page's mode, decided once at boot (grid/boot.ts `bootPageMode`): 'grid' when the page boots into a grid cell, else
 * 'shard'. A leaf module, so what reads it at a shard's boot (a reload variant's grid default, G180) does not pull the
 * grid's own closure in; grid/boot.ts `pageMode()` reads the same value.
 */
export type PageMode = 'grid' | 'shard';
let mode: PageMode = 'shard';
export function currentPageMode(): PageMode { return mode; }
/** @internal grid/boot.ts bootPageMode only */
export function setPageMode(next: PageMode): void { mode = next; }
