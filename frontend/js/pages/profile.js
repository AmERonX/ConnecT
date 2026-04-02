import { requireAuth, logout } from '../auth.js';
import { apiFetch } from '../api.js';
import { bindSidebar } from '../sidebar.js';

await requireAuth();
bindSidebar();

const editBtn = document.getElementById('edit-btn');
const deleteBtn = document.getElementById('delete-account-btn');
const modalRoot = document.getElementById('modal-root');

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

function setProfileField(selector, value) {
  const el = document.querySelector(selector);
  if (el) {
    el.textContent = value;
  }
}

function closeModal() {
  if (!modalRoot) return;
  modalRoot.classList.remove('open');
  modalRoot.setAttribute('aria-hidden', 'true');
  modalRoot.innerHTML = '';
  document.body.classList.remove('modal-open');
}

function openModal(markup) {
  if (!modalRoot) return;
  modalRoot.innerHTML = markup;
  modalRoot.classList.add('open');
  modalRoot.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  modalRoot.onclick = (event) => {
    if (event.target === modalRoot || event.target.closest('[data-close-modal]')) {
      closeModal();
    }
  };
}

function showMessageModal(title, message) {
  openModal(`
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-header">
        <div>
          <h2 class="modal-title" id="modal-title">${esc(title)}</h2>
          <p class="modal-subtitle">${esc(message)}</p>
        </div>
        <button class="modal-close" type="button" data-close-modal aria-label="Close">X</button>
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary btn-sm" type="button" data-close-modal>Close</button>
      </div>
    </div>
  `);
}

async function loadProfile() {
  const [user, ideas, teams, skills] = await Promise.all([
    apiFetch('/users/me'),
    apiFetch('/ideas/me'),
    apiFetch('/teams'),
    apiFetch('/users/me/skills'),
  ]);

  setProfileField('.profile-name', user.name);
  setProfileField('.profile-email', user.email);
  setProfileField('.profile-avatar-lg', initials(user.name));

  const stats = document.querySelectorAll('.p-stat-val');
  if (stats[0]) stats[0].textContent = String((teams.teams || []).length);
  if (stats[1]) stats[1].textContent = String((ideas || []).length);
  if (stats[2]) stats[2].textContent = String((skills || []).length);

  const skillsGrid = document.querySelector('#skills-section .skills-grid');
  if (skillsGrid) {
    skillsGrid.innerHTML = (skills || []).length
      ? skills
          .map(
            (skill) => `
              <button type="button" class="skill-tag" data-skill-id="${skill.id}" title="Remove skill">
                ${esc(skill.skill_name)}${skill.level ? ` (${esc(skill.level)})` : ''}
              </button>
            `,
          )
          .join('')
      : '<span class="muted">No skills added yet.</span>';

    for (const tag of skillsGrid.querySelectorAll('.skill-tag')) {
      tag.addEventListener('click', () => openRemoveSkillModal(tag.dataset.skillId, tag.textContent.trim()));
    }
  }

  const githubRow = document.querySelector('#links-section .social-value');
  if (githubRow) {
    githubRow.innerHTML = user.github_url
      ? `<a href="${esc(user.github_url)}" target="_blank" rel="noreferrer">${esc(user.github_url)}</a>`
      : '<span class="muted">Not added</span>';
  }

  const preferenceValues = document.querySelectorAll('#preferences-section .social-value');
  if (preferenceValues[0]) {
    preferenceValues[0].textContent = user.team_size_preference ? `${user.team_size_preference} people` : 'Not set';
  }
  if (preferenceValues[1]) {
    preferenceValues[1].textContent = user.working_style || 'Not set';
  }
  if (preferenceValues[2]) {
    preferenceValues[2].textContent = user.has_existing_team ? 'Yes' : 'No';
  }

  return user;
}

let currentProfile = null;

const VALID_STYLES = ['async', 'sync', 'flexible'];
const VALID_LEVELS = ['beginner', 'intermediate', 'advanced'];

function openEditProfileModal() {
  if (!currentProfile) return;

  openModal(`
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-header">
        <div>
          <h2 class="modal-title" id="modal-title">Edit profile</h2>
          <p class="modal-subtitle">Update the details teammates use to understand your working style.</p>
        </div>
        <button class="modal-close" type="button" data-close-modal aria-label="Close">X</button>
      </div>
      <form class="modal-form" id="edit-profile-form">
        <div class="form-group">
          <label class="form-label" for="profile-name-input">Name</label>
          <input class="form-input" id="profile-name-input" value="${esc(currentProfile.name || '')}">
        </div>
        <div class="form-group">
          <label class="form-label" for="profile-github-input">GitHub URL</label>
          <input class="form-input" id="profile-github-input" value="${esc(currentProfile.github_url || '')}" placeholder="https://github.com/username">
        </div>
        <div class="form-group">
          <label class="form-label" for="profile-team-size-input">Preferred team size</label>
          <input class="form-input" id="profile-team-size-input" type="number" min="1" max="20" value="${currentProfile.team_size_preference || ''}" placeholder="3">
        </div>
        <div class="form-group">
          <label class="form-label" for="profile-working-style-input">Working style</label>
          <select class="form-select" id="profile-working-style-input">
            <option value="">Choose a style</option>
            ${VALID_STYLES.map((style) => `<option value="${style}" ${currentProfile.working_style === style ? 'selected' : ''}>${style}</option>`).join('')}
          </select>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost btn-sm" type="button" data-close-modal>Cancel</button>
          <button class="btn btn-primary btn-sm" type="submit">Save changes</button>
        </div>
      </form>
    </div>
  `);

  document.getElementById('edit-profile-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = document.getElementById('profile-name-input')?.value?.trim();
    const github = document.getElementById('profile-github-input')?.value?.trim() || null;
    const teamSizeRaw = document.getElementById('profile-team-size-input')?.value;
    const workingStyle = document.getElementById('profile-working-style-input')?.value || null;
    const teamSize = teamSizeRaw ? Number(teamSizeRaw) || null : null;

    if (workingStyle && !VALID_STYLES.includes(workingStyle)) {
      showMessageModal('Invalid working style', 'Choose one of: async, sync, or flexible.');
      return;
    }

    try {
      await apiFetch('/users/me', {
        method: 'PATCH',
        body: {
          name,
          github_url: github,
          team_size_preference: teamSize,
          working_style: workingStyle,
        },
      });
      closeModal();
      currentProfile = await loadProfile();
    } catch (error) {
      showMessageModal('Unable to update profile', error.message || 'Unknown error');
    }
  });
}

function openAddSkillModal() {
  openModal(`
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-header">
        <div>
          <h2 class="modal-title" id="modal-title">Add skill</h2>
          <p class="modal-subtitle">Make it easier for others to understand what you can contribute.</p>
        </div>
        <button class="modal-close" type="button" data-close-modal aria-label="Close">X</button>
      </div>
      <form class="modal-form" id="add-skill-form">
        <div class="form-group">
          <label class="form-label" for="skill-name-input">Skill name</label>
          <input class="form-input" id="skill-name-input" placeholder="Python, React, UX research">
        </div>
        <div class="form-group">
          <label class="form-label" for="skill-level-input">Skill level</label>
          <select class="form-select" id="skill-level-input">
            <option value="">Optional</option>
            ${VALID_LEVELS.map((level) => `<option value="${level}">${level}</option>`).join('')}
          </select>
        </div>
        <div class="modal-actions">
          <button class="btn btn-ghost btn-sm" type="button" data-close-modal>Cancel</button>
          <button class="btn btn-primary btn-sm" type="submit">Add skill</button>
        </div>
      </form>
    </div>
  `);

  document.getElementById('add-skill-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const skillName = document.getElementById('skill-name-input')?.value?.trim();
    const level = document.getElementById('skill-level-input')?.value || null;

    if (!skillName) {
      showMessageModal('Skill name required', 'Enter a skill before saving.');
      return;
    }

    try {
      await apiFetch('/users/me/skills', {
        method: 'POST',
        body: { skill_name: skillName, level },
      });
      closeModal();
      await loadProfile();
    } catch (error) {
      showMessageModal('Unable to add skill', error.message || 'Unknown error');
    }
  });
}

function openRemoveSkillModal(skillId, skillLabel) {
  openModal(`
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-header">
        <div>
          <h2 class="modal-title" id="modal-title">Remove skill</h2>
          <p class="modal-subtitle">${esc(skillLabel)} will be removed from your public profile.</p>
        </div>
        <button class="modal-close" type="button" data-close-modal aria-label="Close">X</button>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost btn-sm" type="button" data-close-modal>Cancel</button>
        <button class="btn btn-danger btn-sm" type="button" id="confirm-remove-skill">Remove</button>
      </div>
    </div>
  `);

  document.getElementById('confirm-remove-skill')?.addEventListener('click', async () => {
    try {
      await apiFetch(`/users/me/skills/${skillId}`, { method: 'DELETE' });
      closeModal();
      await loadProfile();
    } catch (error) {
      showMessageModal('Unable to remove skill', error.message || 'Unknown error');
    }
  });
}

function openDeleteAccountModal() {
  openModal(`
    <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div class="modal-header">
        <div>
          <h2 class="modal-title" id="modal-title">Delete account</h2>
          <p class="modal-subtitle">This permanently deletes your account, ideas, and team data.</p>
        </div>
        <button class="modal-close" type="button" data-close-modal aria-label="Close">X</button>
      </div>
      <div class="alert alert-error">
        <span>!</span>
        <span>This action cannot be undone.</span>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost btn-sm" type="button" data-close-modal>Cancel</button>
        <button class="btn btn-danger btn-sm" type="button" id="confirm-delete-account">Delete account</button>
      </div>
    </div>
  `);

  document.getElementById('confirm-delete-account')?.addEventListener('click', async () => {
    try {
      await apiFetch('/users/me', { method: 'DELETE' });
      closeModal();
      await logout();
    } catch (error) {
      showMessageModal('Unable to delete account', error.message || 'Unknown error');
    }
  });
}

editBtn?.addEventListener('click', openEditProfileModal);
deleteBtn?.addEventListener('click', openDeleteAccountModal);
document.getElementById('add-skill-btn')?.addEventListener('click', openAddSkillModal);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && modalRoot?.classList.contains('open')) {
    closeModal();
  }
});

try {
  currentProfile = await loadProfile();
} catch (error) {
  const skillsSection = document.getElementById('skills-section');
  if (skillsSection) {
    skillsSection.innerHTML = `<div class="alert alert-error"><span>!</span><span>${esc(error.message || 'Failed to load profile')}</span></div>`;
  }
}

