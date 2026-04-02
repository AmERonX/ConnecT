export function esc(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function initials(name) {
  return (name || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export function showPageError(message) {
  const safe = esc(message || 'Unknown error');
  const mainContent = document.querySelector('.main-content');
  let alertEl = document.getElementById('page-global-error');
  if (!alertEl) {
    alertEl = document.createElement('div');
    alertEl.id = 'page-global-error';
    alertEl.className = 'alert alert-error';
    mainContent?.prepend(alertEl);
  }
  alertEl.innerHTML = `<span>!</span><span>${safe}</span>`;
}

export function clearPageError() {
  document.getElementById('page-global-error')?.remove();
}
