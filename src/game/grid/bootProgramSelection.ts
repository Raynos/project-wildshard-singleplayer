/** A saved diagnostic cannot select an unadmitted cell or run outside Developer. */
export function selectedBootCell(cells: readonly { readonly instance: string }[], value: unknown, developer: boolean): string | null {
  return developer && typeof value === 'string' && cells.some(cell => cell.instance === value) ? value : null;
}
