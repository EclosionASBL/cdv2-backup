export const digitsOnly = (s: string) => s.replace(/\D/g, '');

export const formatNRN = (raw: string) => {
  const d = digitsOnly(raw).padEnd(11, ' ');
  return `${d.slice(0,2)}.${d.slice(2,4)}.${d.slice(4,6)}-${d.slice(6,9)}-${d.slice(9,11)}`.trimEnd();
};

export const unformatNRN = digitsOnly;