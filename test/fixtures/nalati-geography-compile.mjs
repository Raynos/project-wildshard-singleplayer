// Build current scalar inputs once in native Node; never record a test outcome.
import { nalatiGeographySources } from '../../src/shards/nalati-grasslands/generators/geographySource.ts';

process.stdout.write(`${JSON.stringify([...nalatiGeographySources()].map(([name, bytes]) =>
  [name, Buffer.from(bytes).toString('base64')]))}\n`);
