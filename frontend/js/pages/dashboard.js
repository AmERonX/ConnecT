import { requireAuth } from '../auth.js';
import { apiFetch } from '../api.js';
import { bindSidebar } from '../sidebar.js';

function initials(name) {
  return (name || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function eventLabel(event) {
  if (event.signal === 'connection_sent') return 'Connection request sent';
  if (event.signal === 'connection_accepted') return 'Connection request accepted';
  if (event.signal === 'profile_viewed') return 'Viewed a teammate profile';
  if (event.signal === 'dismissed') return 'Dismissed a match';
  return event.signal;
}

const session = await requireAuth();
if (!session) {
  throw new Error('Not authenticated');
}

bindSidebar();

const metaName = session.user?.user_metadata?.name || 'Builder';
const avatarText = initials(metaName);

for (const avatar of document.querySelectorAll('.avatar, .welcome-avatar')) {
  avatar.textContent = avatarText;
}

const welcomeTitle = document.querySelector('.welcome-title');
if (welcomeTitle) {
  welcomeTitle.textContent = `Welcome back, ${metaName} 👋`;
}

async function loadWithFallback(path, fallback, errors) {
  try {
    const result = await apiFetch(path);
    return result ?? fallback;
  } catch (error) {
    errors.push(`${path}: ${error.message || 'Unknown error'}`);
    return fallback;
  }
}

const errors = [];
const ideas = await loadWithFallback('/ideas/me', [], errors);
const feedback = await loadWithFallback('/feedback/me', { recent: [], pending_received: [] }, errors);
const teams = await loadWithFallback('/teams', { teams: [] }, errors);

const statValues = document.querySelectorAll('.stat-value');
if (statValues[0]) statValues[0].textContent = String(ideas.length || 0);
if (statValues[1]) {
  const sentCount = (feedback.recent || []).filter((item) => item.signal === 'connection_sent').length;
  statValues[1].textContent = String(sentCount);
}
if (statValues[2]) statValues[2].textContent = String((feedback.pending_received || []).length);
if (statValues[3]) statValues[3].textContent = String((teams.teams || []).length);

const activityList = document.querySelector('.activity-list');
if (activityList) {
  const events = (feedback.recent || []).slice(0, 6);
  const warning = errors.length
    ? `
      <div class="activity-item slide-up">
        <div class="activity-dot" style="background:var(--yellow)"></div>
        <span>Some dashboard sections could not load.</span>
      </div>
    `
    : '';

  activityList.innerHTML = events.length
    ? warning +
      events
        .map(
          (item) => `
          <div class="activity-item slide-up">
            <div class="activity-dot" style="background:var(--primary)"></div>
            <span>${eventLabel(item)}</span>
            <span class="activity-time">${new Date(item.created_at).toLocaleString()}</span>
          </div>
        `,
        )
        .join('')
    : `
      ${warning}
      <div class="activity-item slide-up">
        <div class="activity-dot" style="background:var(--text-muted)"></div>
        <span>No recent activity yet.</span>
      </div>
    `;
}