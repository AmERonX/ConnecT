/**
 * Shared utility functions for ConnecT frontend pages.
 */

/**
 * Escapes a value for safe HTML insertion.
 */
export function esc(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/**
 * Returns up to 2 uppercase initials from a display name.
 */
export function initials(name) {
  return (name || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'U';
}

/**
 * Returns href-safe external URL or null if not http(s).
 */
export function safeExternalUrl(value) {
  const normalized = String(value || '').trim();
  return /^https?:\/\//i.test(normalized) ? normalized : null;
}
