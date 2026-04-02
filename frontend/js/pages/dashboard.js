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
  avatar.classList.remove('is-loading');
}

const welcomeTitle = document.querySelector('.welcome-title');
if (welcomeTitle) {
  welcomeTitle.textContent = `Welcome back, ${metaName}`;
}

try {
  const [ideas, feedback, teams] = await Promise.all([
    apiFetch('/ideas/me'),
    apiFetch('/feedback/me'),
    apiFetch('/teams'),
  ]);

  const statValues = document.querySelectorAll('.stat-value');
  if (statValues[0]) statValues[0].textContent = String(ideas?.length || 0);
  if (statValues[1]) {
    const sentCount = (feedback?.recent || []).filter((item) => item.signal === 'connection_sent').length;
    statValues[1].textContent = String(sentCount);
  }
  if (statValues[2]) statValues[2].textContent = String((feedback?.pending_received || []).length);
  if (statValues[3]) statValues[3].textContent = String((teams?.teams || []).length);

  const activityList = document.querySelector('.activity-list');
  if (activityList) {
    const events = (feedback?.recent || []).slice(0, 6);
    activityList.innerHTML = events.length
      ? events
          .map(
            (item) => `
              <div class="activity-item slide-up">
                <div class="activity-dot activity-dot-primary"></div>
                <span>${eventLabel(item)}</span>
                <span class="activity-time">${new Date(item.created_at).toLocaleString()}</span>
              </div>
            `,
          )
          .join('')
      : `
          <div class="activity-item slide-up">
            <div class="activity-dot"></div>
            <span>No recent activity yet.</span>
          </div>
        `;
  }
} catch (error) {
  const activityList = document.querySelector('.activity-list');
  if (activityList) {
    const message = (error.message || 'Unknown error')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    activityList.innerHTML = `
      <div class="activity-item slide-up">
        <div class="activity-dot activity-dot-danger"></div>
        <span>Failed to load dashboard data: ${message}</span>
      </div>
    `;
  }
}
