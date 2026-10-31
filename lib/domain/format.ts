export function maskPhone(phone: string | null): string | null {
  if (phone === null || phone === '') return null;
  if (phone.length <= 4) return phone;
  return '*'.repeat(phone.length - 4) + phone.slice(-4);
}

export function formatINR(n: number): string {
  return '₹' + n.toLocaleString('en-IN');
}

export function formatRs(n: number): string {
  return 'Rs ' + n.toLocaleString('en-IN');
}
