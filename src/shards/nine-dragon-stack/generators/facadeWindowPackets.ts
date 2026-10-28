import { facadeWindowBlobs, type NineWindowLayout } from './facadeWindows';
import type { AuthorWorldScenes as WorldScenesSection } from '@wildshard/sdk/worldScenes';

interface Packet { readonly file: string; readonly storage: 'f32'; readonly byteOffset: number; readonly count: number }
type InstanceAttribute = WorldScenesSection['steps'][number]['instanceAttributes'][number] & { readonly packet: Packet };
export interface WindowPacketRow { readonly id: string; readonly count: number; readonly attributes: readonly InstanceAttribute[] }

/** Binary instance sources retain the original column offsets and instance counts. */
export function facadeWindowPackets(source: NineWindowLayout): readonly WindowPacketRow[] {
  return facadeWindowBlobs(source).map(({ file, bytes }, index) => {
    const name = file.name;
    if (name === undefined) throw new Error('Nine window packets require named files');
    const count = bytes.length / (26 * 4);
    const packet = (offset: number): Packet => ({ file: name, storage: 'f32', byteOffset: count * offset * 4, count });
    return { id: `windows-${index}`, count, attributes: [
      { part: `windows-${index}`, target: 'instanceMatrix', width: 16, packet: packet(0) },
      { part: `windows-${index}`, name: 'aWin', width: 4, packet: packet(16) },
      { part: `windows-${index}`, name: 'aWall', width: 3, packet: packet(20) },
      { part: `windows-${index}`, target: 'instanceColor', width: 3, packet: packet(23) },
    ] };
  });
}
