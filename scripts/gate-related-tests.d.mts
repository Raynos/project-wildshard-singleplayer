export function capRelated(related: string[], changed: string[], durations: Map<string, number>, seconds: number, workers: number):
  { run: string[]; left: string[] };
