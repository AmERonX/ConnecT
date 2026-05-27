import { requireAuth } from '../auth.js?v=1779876340960';
import { apiFetch } from '../api.js?v=1779876340960';
import { bindSidebar } from '../sidebar.js?v=1779876340960';
import { bindTopbarProfile } from '../topbar.js?v=1779876340960';
import { initials } from '../utils.js?v=1779876340960';

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
bindTopbarProfile(session);

const metaName = session.user?.user_metadata?.name || 'Builder';
const avatarText = initials(metaName);

const avatarNode = document.getElementById('welcome-avatar');
if (avatarNode) {
  avatarNode.textContent = avatarText;
}

const welcomeTitle = document.getElementById('welcome-title');
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

const statIdeas = document.getElementById('stat-ideas');
if (statIdeas) statIdeas.textContent = String(ideas.length || 0);

const statSent = document.getElementById('stat-sent');
if (statSent) {
  const sentCount = (feedback.recent || []).filter((item) => item.signal === 'connection_sent').length;
  statSent.textContent = String(sentCount);
}

const statReceived = document.getElementById('stat-received');
if (statReceived) statReceived.textContent = String((feedback.pending_received || []).length);

const statTeams = document.getElementById('stat-teams');
if (statTeams) statTeams.textContent = String((teams.teams || []).length);

const activityList = document.querySelector('.activity-list');
if (activityList) {
  const events = (feedback.recent || []).slice(0, 6);
  const warning = errors.length
    ? `
      <div class="activity-item slide-up">
        <div class="activity-dot" style="background:var(--fill-amber)"></div>
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
            <div class="activity-dot" style="background:var(--brand)"></div>
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
