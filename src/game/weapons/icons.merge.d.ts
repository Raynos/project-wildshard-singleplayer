// The game starter equipment rows own the sword icon key. The compatibility kit still registers its unchanged
// drawing; game compilation must not depend on the higher layer's icon merge (SF54 / E434).
import type { IconId } from '@wildshard/engine/ui/icons';

declare module '@wildshard/engine/ui/icons' {
  interface IconMap { sword: true }
}
