import cameras from '../../art/legacy-goldens/compare/cameras24.json' with { type: 'json' };

const goldenShards = ['driftwood-isle', 'nalati-grasslands', 'far-reach', 'sunscar-dunes'];

/** Keep the original Nine/Pine defaults; the other shards use golden camera 1.
 * @param {string} slug @param {string} pinePose @param {string} mode */
export function censusSelection(slug = '', pinePose = 'Q4', mode = 'both') {
  if (!['P1', 'Q4'].includes(pinePose)) throw new Error('Unknown Pine census pose');
  if (!['both', 'legacy', 'shardfile'].includes(mode)) throw new Error('Unknown census mode');
  if (slug !== '' && !['nine-dragon-stack', 'pine-hollow', ...goldenShards].includes(slug)) throw new Error('Unknown census shard');
  const defaults = [
    { slug: 'nine-dragon-stack', poseName: 'P4', pose: { x: 76, y: 146, z: 6, yaw: Math.PI / 2, pitch: -10 * Math.PI / 180 } },
    { slug: 'pine-hollow', poseName: pinePose, pose: pinePose === 'P1'
      ? { x: 0, z: -235, yaw: Math.PI, pitch: 0 }
      : { x: 0, z: -28, yaw: Math.PI / 2, pitch: -4 * Math.PI / 180 } },
  ];
  if (goldenShards.includes(slug)) {
    const declared = Reflect.get(cameras.cameras, slug);
    const camera = Array.isArray(declared) ? declared[0] : undefined;
    if (!camera || camera.n !== 1) throw new Error('Missing golden census camera 1');
    const pose = camera.probe ?? (camera.feet ? {
      x: camera.feet[0], y: camera.feet[1], z: camera.feet[2],
      yaw: -camera.yaw * Math.PI / 180, pitch: camera.pitch * Math.PI / 180,
    } : undefined);
    if (!pose || ![pose.x, pose.z, pose.yaw, pose.pitch].every(Number.isFinite)) throw new Error('Golden camera is not a standing pose');
    return [{ slug, poseName: `P1:${camera.name}`, pose, modes: mode === 'both' ? ['legacy', 'shardfile'] : [mode] }];
  }
  return defaults.filter(row => slug === '' || row.slug === slug).map(row => Object.assign(row, { modes: mode === 'both' ? ['legacy', 'shardfile'] : [mode] }));
}
