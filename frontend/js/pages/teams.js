import { requireAuth } from '../auth.js';
import { apiFetch } from '../api.js';
import { bindSidebar } from '../sidebar.js';
import { bindTopbarProfile } from '../topbar.js';
import { esc, initials } from '../utils.js';

function firstLetter(value) {
  return initials(value).charAt(0) || 'U';
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
      <div class="team-card slide-up">
        <div class="team-card-header">
          <div class="team-info">
            <div class="team-icon-wrap" style="background:rgba(108,99,255,0.12)">👥</div>
            <div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
                <div class="team-name" id="team-name-text-${team.id}">${esc(team.name || 'Unnamed Team')}</div>
                <button class="btn btn-ghost btn-sm" style="padding:0 6px;height:24px" data-action="edit-name" data-team-id="${team.id}">✏️ Edit Name</button>
              </div>
              <div class="team-idea">Formed ${new Date(team.formed_at).toLocaleDateString()}</div>
            </div>
          </div>
          <div class="team-meta">
            <div class="meta-item">
              <span class="meta-value">${(team.members || []).length}</span>
              <span class="meta-label">Members</span>
            </div>
          </div>
        </div>

        <div class="team-card-body">
          <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
              <div class="detail-title">Team Idea</div>
              ${team.idea ? `<a href="/idea-editor.html?id=${team.idea.id}" class="btn btn-ghost btn-sm">Edit Idea</a>` : ''}
            </div>
            ${team.idea ? `
              <div style="margin-bottom:16px">
                <h4 style="font-size:0.9rem;margin-bottom:4px;font-weight:600">Problem</h4>
                <p style="font-size:0.875rem;color:var(--text-secondary);line-height:1.5;margin:0">${esc(team.idea.problem)}</p>
              </div>
              <div>
                <h4 style="font-size:0.9rem;margin-bottom:4px;font-weight:600">Solution Idea</h4>
                <p style="font-size:0.875rem;color:var(--text-secondary);line-height:1.5;margin:0">${esc(team.idea.solution_idea || 'No solution idea provided.')}</p>
              </div>
            ` : '<p style="font-size:0.875rem;color:var(--text-secondary)">No active idea found for this team.</p>'}
          </div>

          <div>
            <div class="detail-title" style="margin-bottom:16px">Members</div>
            <div style="display:flex;flex-direction:column;gap:12px">
              ${(team.members || []).map(member => `
                <div class="member-row" style="padding:0;border:none">
                  <div class="avatar">${esc(firstLetter(member.name))}</div>
                  <div class="member-name">${esc(member.name || 'Unknown member')}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
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

  function showTeamsError(message) {
    let toast = document.getElementById('teams-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'teams-toast';
      toast.className = 'alert alert-error';
      toast.style.marginBottom = '14px';
      container.parentNode.insertBefore(toast, container);
    }
    toast.innerHTML = `<span>!</span><span>${esc(message)}</span>`;
  }

  for (const button of container.querySelectorAll('button[data-action="accept"]')) {
    button.addEventListener('click', async () => {
      button.setAttribute('disabled', 'disabled');
      try {
        await acceptRequest(button.dataset.matchId);
        await load();
      } catch (error) {
        showTeamsError(error.message || 'Failed to accept request.');
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
        showTeamsError(error.message || 'Failed to decline request.');
        button.removeAttribute('disabled');
      }
    });
  }

  for (const button of container.querySelectorAll('button[data-action="edit-name"]')) {
    button.addEventListener('click', () => {
      const teamId = button.dataset.teamId;
      const nameContainer = document.getElementById(`team-name-text-${teamId}`);
      const currentName = nameContainer.textContent === 'Unnamed Team' ? '' : nameContainer.textContent;
      
      const inputId = `team-name-input-${teamId}`;
      nameContainer.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px">
          <input type="text" id="${inputId}" class="form-input" style="padding:2px 8px;font-size:0.9rem;height:28px;width:150px" value="${esc(currentName)}" placeholder="Team name">
          <button class="btn btn-primary btn-sm" style="padding:0 8px;height:28px" data-action="save-name">Save</button>
          <button class="btn btn-ghost btn-sm" style="padding:0 8px;height:28px" data-action="cancel-name">Cancel</button>
        </div>
      `;
      button.style.display = 'none';

      const input = document.getElementById(inputId);
      input.focus();

      const saveBtn = nameContainer.querySelector('button[data-action="save-name"]');
      const cancelBtn = nameContainer.querySelector('button[data-action="cancel-name"]');

      cancelBtn.addEventListener('click', () => {
        nameContainer.textContent = currentName || 'Unnamed Team';
        button.style.display = 'inline-block';
      });

      saveBtn.addEventListener('click', async () => {
        const newName = input.value.trim();
        if (newName !== '' && newName !== currentName) {
          saveBtn.setAttribute('disabled', 'disabled');
          cancelBtn.setAttribute('disabled', 'disabled');
          try {
            await apiFetch(`/teams/${teamId}`, { method: 'PATCH', body: { name: newName } });
            await load();
          } catch (error) {
            showTeamsError(error.message || 'Failed to rename team.');
            saveBtn.removeAttribute('disabled');
            cancelBtn.removeAttribute('disabled');
          }
        } else {
          nameContainer.textContent = currentName || 'Unnamed Team';
          button.style.display = 'inline-block';
        }
      });
      
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveBtn.click();
        if (e.key === 'Escape') cancelBtn.click();
      });
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
