export function genSource(root: string, options?: { check?: boolean; changed?: readonly string[]; committed?: boolean }):
  Promise<{ touched: string[]; owned: string[] }>;
