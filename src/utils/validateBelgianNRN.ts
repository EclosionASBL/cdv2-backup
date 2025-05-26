export function validateBelgianNRN(nrn: string): boolean {
  if (!/^\d{11}$/.test(nrn)) return false;
  const body = parseInt(nrn.slice(0, 9), 10);
  const check = parseInt(nrn.slice(9), 10);
  const oldRule = (97 - (body % 97)) === check;                       // births < 2000
  const newRule = (97 - ((2_000_000_000 + body) % 97)) === check;    // births ≥ 2000
  return oldRule || newRule;
}