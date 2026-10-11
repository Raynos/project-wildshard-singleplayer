import { Director } from '@wildshard/sdk/director';
import { generateDirectorAbi } from '@wildshard/sdk/directorAbi';

/** The actual Template 1 door/wave declaration, with the host-provided flags. */
export function directorsExample() {
  const director = new Director({
    id: 'template.door-wave',
    inputs: { doorOpen: 'flag:template.door-open', waveDead: 'flag:template.blob' },
    stages: [
      { id: 'door' },
      { id: 'wave', when: 'doorOpen', do: [{ flag: { key: 'template.wave-started', value: true } }] },
      { id: 'complete', when: 'waveDead', do: [{ flag: { key: 'template.wave-complete', value: true } }] },
    ],
  });
  return { row: director.toJSON(), assemblyScript: generateDirectorAbi(director.toJSON()) };
}
