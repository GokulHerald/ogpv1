/**
 * Normalize Nepali mobile numbers to E.164 (+977XXXXXXXXXX).
 * Accepts: +9779800000011, 9779800000011, 9800000011, 09800000011
 */
function normalizeNepalPhone(input) {
  const raw = String(input || '').trim().replace(/[\s-().]/g, '');
  if (!raw) return '';

  if (raw.includes('@')) return raw;

  let digits = raw.replace(/\D/g, '');

  if (raw.startsWith('+')) {
    if (digits.startsWith('977') && digits.length === 13) {
      return `+${digits}`;
    }
    return raw;
  }

  if (digits.startsWith('977') && digits.length === 13) {
    return `+${digits}`;
  }

  if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }

  if (digits.length === 10 && digits.startsWith('9')) {
    return `+977${digits}`;
  }

  return raw;
}

/** All stored/login variants to match legacy phone formats in the database. */
function phoneLookupVariants(input) {
  const trimmed = String(input || '').trim();
  const normalized = normalizeNepalPhone(trimmed);
  const variants = new Set();

  if (trimmed) variants.add(trimmed);
  if (normalized) variants.add(normalized);

  if (normalized.startsWith('+977') && normalized.length === 14) {
    const local = normalized.slice(4);
    variants.add(local);
    variants.add(`977${local}`);
    variants.add(`0${local}`);
  }

  return [...variants].filter(Boolean);
}

function looksLikeEmail(value) {
  return String(value || '').includes('@');
}

module.exports = {
  normalizeNepalPhone,
  phoneLookupVariants,
  looksLikeEmail,
};
