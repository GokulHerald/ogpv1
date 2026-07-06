/** Client-side hint normalization (server is source of truth). */
export function formatPhoneHint(value) {
  const v = String(value || '').trim();
  if (!v || v.includes('@')) return v;
  if (v.startsWith('+977')) return v;
  const digits = v.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('9')) return `+977${digits}`;
  return v;
}
