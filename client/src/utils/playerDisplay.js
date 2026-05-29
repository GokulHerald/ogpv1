/**
 * Prefer legal/display name from registration, then gamer tag (username).
 */
export function formatPlayerDisplayName(user) {
  if (!user || typeof user === 'string') return 'TBD';

  const first = String(user.firstName || '').trim();
  const last = String(user.lastName || '').trim();
  const fullName = [first, last].filter(Boolean).join(' ');
  if (fullName) return fullName;

  const username = String(user.username || '').trim();
  if (username) return username;

  return 'TBD';
}

export function playerInitials(user) {
  const name = formatPlayerDisplayName(user);
  if (name === 'TBD') return '?';
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
