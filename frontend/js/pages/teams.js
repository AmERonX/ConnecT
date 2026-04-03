import { requireAuth } from '../auth.js';
import { apiFetch } from '../api.js';
import { bindSidebar } from '../sidebar.js';
import { bindTopbarProfile } from '../topbar.js';

function esc(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function firstLetter(value) {
  return String(value || 'U').trim().charAt(0).toUpperCase() || 'U';
}

const session = await requireAuth();
bindSidebar();
bindTopbarProfile(session);

const container = document.querySelector('.teams-grid');

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
      <div class="team-row slide-up">
        <div class="team-info">
          <div class="team-icon-wrap" style="background:rgba(108,99,255,0.12)">👥</div>
          <div>
            <div class="team-name">${esc(team.name || 'Unnamed Team')}</div>
            <div class="team-idea">${(team.members || []).length} members</div>
          </div>
        </div>
        <div class="team-meta">
          <div class="meta-item">
            <span class="meta-value">${(team.members || []).length}</span>
            <span class="meta-label">Members</span>
          </div>
          <div class="meta-item">
            <span class="meta-value">${new Date(team.formed_at).toLocaleDateString()}</span>
            <span class="meta-label">Formed</span>
          </div>
        </div>
      </div>
      <div class="team-detail-panel">
        <div class="detail-header">
          <div class="detail-title">Members</div>
        </div>
        ${(team.members || [])
          .map(
            (member) => `
          <div class="member-row">
            <div class="avatar">${esc(firstLetter(member.name))}</div>
            <div>
              <div class="member-name">${esc(member.name || 'Unknown member')}</div>
            </div>
          </div>
        `,
          )
          .join('')}
      </div>
    `,
            )
            .join('')
        : '<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-title">No teams yet</div><div class="empty-text">Accept a connection request to form your first team.</div></div>'
    }

    <div style="margin-top:16px">
      <h2 style="font-size:1rem;font-weight:700;margin-bottom:14px">Pending Connection Requests</h2>
      ${
        pendingReceived.length
          ? pendingReceived
              .map(
                (item) => `
          <div class="team-row slide-up" style="border-color:rgba(0,212,255,0.15)">
            <div class="team-info">
              <div class="avatar">${esc(firstLetter(item.sender?.name))}</div>
              <div>
                <div class="team-name">${esc(item.sender?.name || 'Unknown user')}</div>
                <div class="team-idea">Wants to connect on: ${esc(item.my_idea?.problem || 'Unknown idea')}</div>
              </div>
            </div>
            <div class="team-actions">
              <button class="btn btn-primary btn-sm" data-action="accept" data-match-id="${item.match_id}">Accept</button>
              <button class="btn btn-ghost btn-sm" data-action="decline" data-match-id="${item.match_id}">Decline</button>
            </div>
          </div>
        `,
              )
              .join('')
          : '<p style="color:var(--text-secondary);font-size:0.875rem">No pending incoming requests.</p>'
      }

      ${
        pendingSent.length
          ? pendingSent
              .map(
                (item) => `
          <div class="team-row slide-up" style="margin-top:10px;border-color:rgba(245,158,11,0.15)">
            <div class="team-info">
              <div class="avatar">${esc(firstLetter(item.receiver?.name))}</div>
              <div>
                <div class="team-name">${esc(item.receiver?.name || 'Unknown user')}</div>
                <div class="team-idea">You sent a request</div>
              </div>
            </div>
            <div class="team-actions">
              <span class="badge badge-partial"><span class="badge-dot"></span> Pending</span>
            </div>
          </div>
        `,
              )
              .join('')
          : ''
      }
    </div>
  `;

  for (const button of container.querySelectorAll('button[data-action="accept"]')) {
    button.addEventListener('click', async () => {
      button.setAttribute('disabled', 'disabled');
      try {
        await acceptRequest(button.dataset.matchId);
        await load();
      } catch (error) {
        alert(error.message || 'Failed to accept request.');
        button.removeAttribute('disabled');
      }
    });
  }

  for (const button of container.querySelectorAll('button[data-action="decline"]')) {
    button.addEventListener('click', async () => {
      button.setAttribute('disabled', 'disabled');
      try {
        await declineRequest(button.dataset.matchId);
        await load();
      } catch (error) {
        alert(error.message || 'Failed to decline request.');
        button.removeAttribute('disabled');
      }
    });
  }
}

async function load() {
  const data = await apiFetch('/teams');
  renderTeams(data);
}

try {
  await load();
} catch (error) {
  container.innerHTML = `<div class="empty-state"><div class="empty-icon">!</div><div class="empty-title">Unable to load teams</div><div class="empty-text">${esc(error.message || 'Unknown error')}</div></div>`;
}
