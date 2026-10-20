import { facadeWindowBlobs } from './facadeWindows';
import type { WorldScenesSection } from '@wildshard/format/worldScenes';

interface Packet { readonly file: string; readonly storage: 'f32'; readonly byteOffset: number; readonly count: number }
type InstanceAttribute = WorldScenesSection['steps'][number]['instanceAttributes'][number] & { readonly packet: Packet };
export interface WindowPacketRow { readonly id: string; readonly count: number; readonly attributes: readonly InstanceAttribute[] }

/** Binary instance sources retain the original column offsets and instance counts. */
export function facadeWindowPackets(): readonly WindowPacketRow[] {
  return facadeWindowBlobs().map(({ file, bytes }, index) => {
    const name = file.name;
    if (name === undefined) throw new Error('Nine window packets require named files');
    const count = bytes.length / (26 * 4);
    const source = (offset: number): Packet => ({ file: name, storage: 'f32', byteOffset: count * offset * 4, count });
    return { id: `windows-${index}`, count, attributes: [
      { part: `windows-${index}`, target: 'instanceMatrix', width: 16, packet: source(0) },
      { part: `windows-${index}`, name: 'aWin', width: 4, packet: source(16) },
      { part: `windows-${index}`, name: 'aWall', width: 3, packet: source(20) },
      { part: `windows-${index}`, target: 'instanceColor', width: 3, packet: source(23) },
    ] };
  });
}
