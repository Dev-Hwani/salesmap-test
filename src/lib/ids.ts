export function parseId(value: string) {
  const id = Number(value);
  return Number.isNaN(id) ? null : id;
}
