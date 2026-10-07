// The kit's icon ids, merged into the engine's IconMap (E434: a merge-only declaration file; the shard project includes
// src/kit/**/*.merge.d.ts). src/kit/icons.ts draws and registers them. (The import makes this file a module, so the block merges into the
// engine's IconMap instead of replacing it.)
import type { IconId } from '@wildshard/engine/ui/icons';

declare module '@wildshard/engine/ui/icons' {
  interface IconMap {
    deer: true;
    elk: true;
    boar: true;
    bear: true;
    ghost: true;
    ironhide: true;
    meat: true;
    hide: true;
    tusk: true;
    antlers: true;
    bolt: true;
    claw: true;
    shell: true;
    coconut: true;
    coin: true;
    seaglass: true;
    rope: true;
    whetstone: true;
    chart: true;
    bearclaw: true;
    boartusk: true;
    crossbow: true;
    rifle: true;
    lever: true;
    longbow: true;
    hat: true;
    cape: true;
    charm: true;
    necklace: true;
    glyph: true;
    purse: true;
    talon: true;
    leopard: true;
    wolf: true;
    eagle: true;
    rider: true;
    horse: true;
    grapple: true;
  }
}
