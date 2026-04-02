import { requireAuth } from '../auth.js';
import { apiFetch } from '../api.js';
import { bindSidebar } from '../sidebar.js';

function esc(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function initials(name) {
  return (name || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

const session = await requireAuth();
bindSidebar();

const avatar = document.querySelector('.topbar-right .avatar');
if (avatar) {
  avatar.textContent = initials(session?.user?.user_metadata?.name || 'Builder');
  avatar.classList.remove('is-loading');
}

const container = document.querySelector('.teams-grid');
const mainContent = document.querySelector('.main-content');

function showPageError(message) {
  const safe = esc(message || 'Unknown error');
  let alertEl = document.getElementById('teams-page-error');
  if (!alertEl) {
    alertEl = document.createElement('div');
    alertEl.id = 'teams-page-error';
    alertEl.className = 'alert alert-error';
    mainContent?.prepend(alertEl);
  }
  alertEl.innerHTML = `<span>!</span><span>${safe}</span>`;
}

function clearPageError() {
  document.getElementById('teams-page-error')?.remove();
}

async function acceptRequest(matchId) {
  await apiFetch('/feedback', { method: 'POST', body: { match_id: matchId, signal: 'connection_accepted' } });
  await apiFetch('/teams', { method: 'POST', body: { match_id: matchId } });
}

async function declineRequest(matchId) {
  await apiFetch('/feedback', { method: 'POST', body: { match_id: matchId, signal: 'dismissed' } });
}

function renderTeams(data) {
  const teams = data.teams || [];
  const pendingReceived = data.pending?.received || [];
  const pendingSent = data.pending?.sent || [];

  container.innerHTML = `
    ${
      teams.length
        ? teams
            .map(
              (team) => `
                <article class="team-cluster slide-up">
                  <div class="team-row">
                    <div class="team-info">
                      <div class="team-icon-wrap">T</div>
                      <div>
                        <div class="team-name">${esc(team.name || 'Unnamed Team')}</div>
                        <div class="team-idea">${team.members.length} members</div>
                      </div>
                    </div>
                    <div class="team-meta">
                      <div class="meta-item">
                        <span class="meta-value">${team.members.length}</span>
                        <span class="meta-label">Members</span>
                      </div>
                      <div class="meta-item">
                        <span class="meta-value">${team.formed_at ? (!isNaN(new Date(team.formed_at).getTime()) ? new Date(team.formed_at).toLocaleDateString() : '-') : '-'}</span>
                        <span class="meta-label">Formed</span>
                      </div>
                    </div>
                  </div>
                  <section class="team-detail-panel">
                    <div class="detail-header">
                      <div class="detail-title">Members</div>
                    </div>
                    ${team.members
                      .map(
                        (member) => `
                          <div class="member-row">
                            <div class="avatar">${esc(initials(member.name))}</div>
                            <div>
                              <div class="member-name">${esc(member.name)}</div>
                            </div>
                          </div>
                        `,
                      )
                      .join('')}
                  </section>
                </article>
              `,
            )
            .join('')
        : '<div class="empty-state"><div class="empty-icon">T</div><div class="empty-title">No teams yet</div><div class="empty-text">Accept a connection request to form your first team.</div></div>'
    }

    <section class="pending-section">
      <h2 class="pending-heading">Pending connection requests</h2>
      ${
        pendingReceived.length
          ? pendingReceived
              .map(
                (item) => `
                  <article class="team-row pending-card-received slide-up">
                    <div class="team-info">
                      <div class="avatar">${esc(item.sender.name.charAt(0).toUpperCase())}</div>
                      <div>
                        <div class="team-name">${esc(item.sender.name)}</div>
                        <div class="team-idea">Wants to connect on: ${esc(item.my_idea.problem)}</div>
                      </div>
                    </div>
                    <div class="team-actions">
                      <button class="btn btn-primary btn-sm" data-action="accept" data-match-id="${item.match_id}">Accept</button>
                      <button class="btn btn-ghost btn-sm" data-action="decline" data-match-id="${item.match_id}">Decline</button>
                    </div>
                  </article>
                `,
              )
              .join('')
          : '<p class="muted">No pending incoming requests.</p>'
      }

      ${
        pendingSent.length
          ? pendingSent
              .map(
                (item) => `
                  <article class="team-row pending-card-sent slide-up">
                    <div class="team-info">
                      <div class="avatar">${esc(item.receiver.name.charAt(0).toUpperCase())}</div>
                      <div>
                        <div class="team-name">${esc(item.receiver.name)}</div>
                        <div class="team-idea">You sent a request</div>
                      </div>
                    </div>
                    <div class="team-actions">
                      <span class="badge badge-partial"><span class="badge-dot"></span> Pending</span>
                    </div>
                  </article>
                `,
              )
              .join('')
          : ''
      }
    </section>
  `;

  for (const button of container.querySelectorAll('button[data-action="accept"]')) {
    button.addEventListener('click', async () => {
      button.setAttribute('disabled', 'disabled');
      clearPageError();
      try {
        await acceptRequest(button.dataset.matchId);
        await load();
      } catch (error) {
        button.removeAttribute('disabled');
        showPageError(error.message || 'Failed to accept request.');
      }
    });
  }

  for (const button of container.querySelectorAll('button[data-action="decline"]')) {
    button.addEventListener('click', async () => {
      button.setAttribute('disabled', 'disabled');
      clearPageError();
      try {
        await declineRequest(button.dataset.matchId);
        await load();
      } catch (error) {
        button.removeAttribute('disabled');
        showPageError(error.message || 'Failed to decline request.');
      }
    });
  }
}

async function load() {
  const data = await apiFetch('/teams');
  renderTeams(data);
}

try {
  clearPageError();
  await load();
} catch (error) {
  container.innerHTML = `<div class="empty-state"><div class="empty-icon">!</div><div class="empty-title">Unable to load teams</div><div class="empty-text">${esc(error.message || 'Unknown error')}</div></div>`;
}
