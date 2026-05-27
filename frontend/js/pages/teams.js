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
              (team) => {
                const myMember = (team.members || []).find(m => m.id === session.user.id);
                const myPartComplete = myMember ? myMember.marked_complete : false;
                return `
      <div class="team-card slide-up">
        <div class="team-card-header">
          <div style="display:flex;align-items:center;gap:12px;width:100%">
            <div class="team-name" id="team-name-text-${team.id}" style="font-size:1.1rem">${esc(team.name || 'Unnamed Team')}</div>
            <div style="color:var(--text-secondary);font-size:0.9rem">(${(team.members || []).length} Members)</div>
            ${team.completed ? '<span class="tag tag-fresh">Completed</span>' : `<button class="btn-ghost" style="padding:0;border:none;font-size:0.875rem;color:var(--brand);background:transparent" data-action="edit-name" data-team-id="${team.id}">Edit Name</button>`}
            
            <div class="team-actions" style="margin-left:auto;display:flex;gap:8px">
              ${!team.completed ? (
                myPartComplete 
                  ? `<button class="btn btn-outline btn-sm" data-action="unmark-complete" data-team-id="${team.id}">Reopen My Part</button>`
                  : `<button class="btn btn-primary btn-sm" data-action="mark-complete" data-team-id="${team.id}">Mark My Part Complete</button>`
              ) : `<button class="btn btn-outline btn-sm" data-action="unmark-complete" data-team-id="${team.id}">Reopen Project</button>`}
              <button class="btn btn-danger btn-sm" data-action="leave-team" data-team-id="${team.id}">Leave</button>
            </div>
          </div>
        </div>

        <div class="team-card-body">
          <div style="display:flex;flex-direction:column;gap:16px">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div class="detail-title">Idea Details</div>
              ${team.idea ? `<a href="/idea-editor.html?id=${team.idea.id}" class="btn btn-ghost btn-sm">Edit Idea</a>` : ''}
            </div>
            ${team.idea ? `
              <div>
                <h4 style="font-size:0.875rem;margin-bottom:4px;font-weight:600;color:var(--text-muted);text-transform:uppercase">PROBLEM</h4>
                <p style="font-size:0.875rem;color:var(--text-secondary);line-height:1.5;margin:0">${esc(team.idea.problem)}</p>
              </div>
              <div>
                <h4 style="font-size:0.875rem;margin-bottom:4px;font-weight:600;color:var(--text-muted);text-transform:uppercase">SOLUTION IDEA</h4>
                <p style="font-size:0.875rem;color:var(--text-secondary);line-height:1.5;margin:0">${esc(team.idea.solution_idea || 'No solution idea provided.')}</p>
              </div>
            ` : '<p style="font-size:0.875rem;color:var(--text-secondary)">No active idea found for this team.</p>'}
          </div>

          <div>
            <div class="detail-title" style="margin-bottom:16px">Members List</div>
            <div style="display:flex;flex-direction:column;gap:12px">
              ${(team.members || []).map(member => `
                <div class="member-row" style="padding:8px 12px;border:0.5px solid var(--border);border-radius:8px;background:var(--bg-card);justify-content:space-between">
                  <div style="display:flex;align-items:center;gap:12px">
                    <div class="avatar avatar-36 av-blue">${esc(firstLetter(member.name))}</div>
                    <div class="member-name" style="display:flex;flex-direction:column;gap:2px">
                      <div style="display:flex;align-items:center;gap:6px;font-size:0.9rem">
                        ${esc(member.name || 'Unknown member')}
                        ${member.id === session.user.id ? '<span style="color:var(--text-muted);font-weight:400;font-size:0.8rem">(You)</span>' : ''}
                      </div>
                      <div style="display:flex;gap:6px">
                        ${member.marked_complete ? '<span class="tag tag-fresh" style="font-size:0.65rem">Done</span>' : ''}
                        ${member.is_leader ? '<span class="tag tag-serious" style="background:var(--fill-amber);color:var(--text-amber);font-size:0.65rem">👑 Leader</span>' : ''}
                      </div>
                    </div>
                  </div>
                  ${team.completed && member.id !== session.user.id ? (
                    member.rated_by_me 
                    ? '<span style="font-size:0.8125rem;color:var(--green,#10b981)">✓ Rated</span>'
                    : `<button class="btn btn-outline btn-sm" data-action="rate-peer" data-team-id="${team.id}" data-user-id="${member.id}" data-user-name="${esc(member.name)}">Rate Peer</button>`
                  ) : (!team.completed && member.id !== session.user.id && myMember && myMember.is_leader ? (
                    `<button style="background:none;border:none;color:var(--red);cursor:pointer;font-size:0.875rem;text-decoration:underline;padding:4px" data-action="kick-member" data-team-id="${team.id}" data-user-id="${member.id}">Kick</button>`
                  ) : '')}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
              }
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
              <div class="avatar avatar-36 av-amber">${esc(firstLetter(item.sender?.name))}</div>
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
              <div class="avatar avatar-36 av-pink">${esc(firstLetter(item.receiver?.name))}</div>
              <div>
                <div class="team-name">${esc(item.receiver?.name || 'Unknown user')}</div>
                <div class="team-idea">You sent a request</div>
              </div>
            </div>
            <div class="team-actions">
              <span class="tag tag-partial"> Pending</span>
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

  for (const button of container.querySelectorAll('button[data-action="mark-complete"]')) {
    button.addEventListener('click', async () => {
      button.setAttribute('disabled', 'disabled');
      try {
        await apiFetch(`/teams/${button.dataset.teamId}/members/me/complete`, { method: 'PATCH', body: { complete: true } });
        await load();
      } catch (error) {
        showTeamsError(error.message || 'Failed to mark complete.');
        button.removeAttribute('disabled');
      }
    });
  }

  for (const button of container.querySelectorAll('button[data-action="unmark-complete"]')) {
    button.addEventListener('click', async () => {
      button.setAttribute('disabled', 'disabled');
      try {
        await apiFetch(`/teams/${button.dataset.teamId}/members/me/complete`, { method: 'PATCH', body: { complete: false } });
        await load();
      } catch (error) {
        showTeamsError(error.message || 'Failed to reopen project.');
        button.removeAttribute('disabled');
      }
    });
  }

  for (const button of container.querySelectorAll('button[data-action="leave-team"]')) {
    button.addEventListener('click', async () => {
      button.setAttribute('disabled', 'disabled');
      try {
        await apiFetch(`/teams/${button.dataset.teamId}/members/me`, { method: 'DELETE' });
        await load();
      } catch (error) {
        showTeamsError(error.message || 'Failed to leave team.');
        button.removeAttribute('disabled');
      }
    });
  }

  for (const button of container.querySelectorAll('button[data-action="kick-member"]')) {
    button.addEventListener('click', async () => {
      button.setAttribute('disabled', 'disabled');
      try {
        await apiFetch(`/teams/${button.dataset.teamId}/members/${button.dataset.userId}`, { method: 'DELETE' });
        await load();
      } catch (error) {
        showTeamsError(error.message || 'Failed to kick member.');
        button.removeAttribute('disabled');
      }
    });
  }

  const modal = document.getElementById('peer-rating-modal');
  const targetNameEl = document.getElementById('rating-target-name');
  const form = document.getElementById('rating-form');
  const cancelBtn = document.getElementById('cancel-rating');
  const teamIdInput = document.getElementById('rating-team-id');
  const userIdInput = document.getElementById('rating-user-id');

  for (const button of container.querySelectorAll('button[data-action="rate-peer"]')) {
    button.addEventListener('click', () => {
      targetNameEl.textContent = button.dataset.userName;
      teamIdInput.value = button.dataset.teamId;
      userIdInput.value = button.dataset.userId;
      form.reset();
      modal.style.display = 'flex';
    });
  }

  if (cancelBtn) {
    cancelBtn.onclick = () => {
      modal.style.display = 'none';
    };
  }

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('submit-rating');
      submitBtn.setAttribute('disabled', 'disabled');
      
      const payload = {
        rated_user_id: userIdInput.value,
        reliability: parseInt(document.getElementById('rating-reliability').value, 10),
        communication: parseInt(document.getElementById('rating-communication').value, 10),
        contribution: parseInt(document.getElementById('rating-contribution').value, 10),
        overall_score: parseInt(document.getElementById('rating-overall').value, 10),
      };

      try {
        await apiFetch(`/teams/${teamIdInput.value}/ratings`, { method: 'POST', body: payload });
        modal.style.display = 'none';
        await load();
      } catch (error) {
        alert(error.message || 'Failed to submit rating.');
      } finally {
        submitBtn.removeAttribute('disabled');
      }
    };
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
