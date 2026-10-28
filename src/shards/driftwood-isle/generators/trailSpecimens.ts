import { trailSpecimenBank } from './trailsideModels';

/** Original ordered Explorer aliases owned by the trail specimen bank. */
export type TrailSpecimenAliases = Readonly<Record<'fencePost' | 'two' | 'one' | 'three' | 'light' | 'dark', string>>;

/** Refuse missing or ambiguous content rather than borrowing a public file. */
export function trailSpecimensFrom(byUrl: Readonly<Record<string, string>>): TrailSpecimenAliases {
  const file = (hash: string): string => {
    const matches = Object.keys(byUrl).filter(url => url.endsWith(`/trail-${hash}.glb`));
    const [url] = matches;
    if (matches.length !== 1 || url === undefined) throw new Error('Trail content identity requires one owned alias');
    return url;
  };
  return {
    fencePost: file('71195c5f474dcd59692f73db2ac16ac5c4a488b49e6c00bad155e86dfb873ea4'),
    two: file('a388307316b578e92a35be49f3e35d75992f50c6498c6e961c2bdaabb97cf78c'),
    one: file('f1645c1601d885caa3c32b2fdacb99a5ac354c10e770eec99b53cffa39c972bf'),
    three: file('3b31606dd2e7bab937624a0cf40e503ea8ff1c5a152c9a86b04d4898187b9c11'),
    light: file('0239a5bb72a630612f7e2303d248fdb6f93ab57672f1cd967c8ea71be3678c2d'),
    dark: file('bcd26672d7cc0fa1190447ec2dc52216bd2031689ef2b8bc3fdaefb54d794acf'),
  };
}
export const TRAIL_SPECIMENS = trailSpecimensFrom(trailSpecimenBank().byUrl);
